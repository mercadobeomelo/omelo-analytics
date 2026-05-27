import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: 'postgresql://postgres:rBoBOJUTHhsXTHylCOvlnSsfJRxvrBgS@tramway.proxy.rlwy.net:26530/railway',
  ssl: {
    rejectUnauthorized: false,
  },
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("start_date");
    const endDate = searchParams.get("end_date");

    let whereClause = "";
    let queryParams: string[] = [];

    if (startDate && endDate) {
      whereClause =
        "WHERE (m.created_at AT TIME ZONE 'Asia/Kolkata')::date >= $1::date AND (m.created_at AT TIME ZONE 'Asia/Kolkata')::date <= $2::date";
      queryParams = [startDate, endDate];
    } else {
      const days = parseInt(searchParams.get("days") || "30");
      whereClause = `WHERE m.created_at >= CURRENT_DATE - INTERVAL '${days} days'`;
    }

    const client = await pool.connect();

    try {
      // Per-day breakdown with real new vs returning users.
      // New user on day X = their very first message was on day X.
      // Returning user on day X = they had a message on day X but first appeared before day X.
      const dailyQuery = `
        WITH first_message_dates AS (
          SELECT user_id, MIN((created_at AT TIME ZONE 'Asia/Kolkata')::date) AS first_date
          FROM "Messages"
          GROUP BY user_id
        ),
        daily_activity AS (
          SELECT
            (m.created_at AT TIME ZONE 'Asia/Kolkata')::date AS date,
            COUNT(DISTINCT m.user_id) AS dau,
            COUNT(*) AS messages,
            COUNT(DISTINCT CASE WHEN fmd.first_date = (m.created_at AT TIME ZONE 'Asia/Kolkata')::date THEN m.user_id END) AS new_users,
            COUNT(DISTINCT CASE WHEN fmd.first_date < (m.created_at AT TIME ZONE 'Asia/Kolkata')::date THEN m.user_id END) AS returning_users
          FROM "Messages" m
          JOIN first_message_dates fmd ON m.user_id = fmd.user_id
          ${whereClause}
          GROUP BY (m.created_at AT TIME ZONE 'Asia/Kolkata')::date
        )
        SELECT * FROM daily_activity ORDER BY date
      `;

      // Unique users active in the selected date range
      const periodActiveQuery = `
        SELECT COUNT(DISTINCT m.user_id) AS period_active
        FROM "Messages" m
        ${whereClause}
      `;

      // MAU: fixed 30-day rolling window (independent of date picker)
      const mauQuery = `
        SELECT COUNT(DISTINCT user_id) AS mau
        FROM "Messages"
        WHERE created_at >= NOW() - INTERVAL '30 days'
      `;

      // WAU: fixed 7-day rolling window (independent of date picker)
      const wauQuery = `
        SELECT COUNT(DISTINCT user_id) AS wau
        FROM "Messages"
        WHERE created_at >= NOW() - INTERVAL '7 days'
      `;

      // Today's DAU (used for stickiness = DAU / MAU)
      const todayDauQuery = `
        SELECT COUNT(DISTINCT user_id) AS today_dau
        FROM "Messages"
        WHERE (created_at AT TIME ZONE 'Asia/Kolkata')::date = (NOW() AT TIME ZONE 'Asia/Kolkata')::date
      `;

      // D1 Retention: % of yesterday's active users who came back today
      const retentionQuery = `
        WITH today_users AS (
          SELECT DISTINCT user_id
          FROM "Messages"
          WHERE (created_at AT TIME ZONE 'Asia/Kolkata')::date = (NOW() AT TIME ZONE 'Asia/Kolkata')::date
        ),
        yesterday_users AS (
          SELECT DISTINCT user_id
          FROM "Messages"
          WHERE (created_at AT TIME ZONE 'Asia/Kolkata')::date = (NOW() AT TIME ZONE 'Asia/Kolkata')::date - 1
        )
        SELECT
          (SELECT COUNT(*) FROM yesterday_users) AS yesterday_count,
          (SELECT COUNT(*) FROM today_users t JOIN yesterday_users y ON t.user_id = y.user_id) AS retained_count
      `;

      // Cohort retention — classic N-day (industry standard):
      // A user is retained at day N if they were active on exactly that calendar day.
      // "—" shown when not enough time has elapsed for the cohort to reach that day.
      const cohortQuery = `
        WITH user_first_activity AS (
          SELECT
            user_id,
            MIN((created_at AT TIME ZONE 'Asia/Kolkata')::date) AS first_date
          FROM "Messages"
          GROUP BY user_id
        ),
        cohorts AS (
          SELECT
            ufa.first_date AS cohort_date,
            COUNT(DISTINCT ufa.user_id) AS cohort_size,
            COUNT(DISTINCT CASE
              WHEN (m.created_at AT TIME ZONE 'Asia/Kolkata')::date = ufa.first_date + 1
              THEN m.user_id
            END) AS d1_retained,
            COUNT(DISTINCT CASE
              WHEN (m.created_at AT TIME ZONE 'Asia/Kolkata')::date = ufa.first_date + 3
              THEN m.user_id
            END) AS d3_retained,
            COUNT(DISTINCT CASE
              WHEN (m.created_at AT TIME ZONE 'Asia/Kolkata')::date = ufa.first_date + 7
              THEN m.user_id
            END) AS d7_retained,
            COUNT(DISTINCT CASE
              WHEN (m.created_at AT TIME ZONE 'Asia/Kolkata')::date = ufa.first_date + 14
              THEN m.user_id
            END) AS d14_retained,
            COUNT(DISTINCT CASE
              WHEN (m.created_at AT TIME ZONE 'Asia/Kolkata')::date = ufa.first_date + 30
              THEN m.user_id
            END) AS d30_retained
          FROM user_first_activity ufa
          LEFT JOIN "Messages" m ON ufa.user_id = m.user_id
            AND (m.created_at AT TIME ZONE 'Asia/Kolkata')::date > ufa.first_date
          WHERE ufa.first_date >= (NOW() AT TIME ZONE 'Asia/Kolkata')::date - 60
          GROUP BY ufa.first_date
        )
        SELECT
          cohort_date,
          cohort_size,
          CASE WHEN cohort_size > 0 AND cohort_date <= (NOW() AT TIME ZONE 'Asia/Kolkata')::date - 1
            THEN ROUND(d1_retained::numeric / cohort_size * 100, 1) ELSE NULL END AS d1,
          CASE WHEN cohort_size > 0 AND cohort_date <= (NOW() AT TIME ZONE 'Asia/Kolkata')::date - 3
            THEN ROUND(d3_retained::numeric / cohort_size * 100, 1) ELSE NULL END AS d3,
          CASE WHEN cohort_size > 0 AND cohort_date <= (NOW() AT TIME ZONE 'Asia/Kolkata')::date - 7
            THEN ROUND(d7_retained::numeric / cohort_size * 100, 1) ELSE NULL END AS d7,
          CASE WHEN cohort_size > 0 AND cohort_date <= (NOW() AT TIME ZONE 'Asia/Kolkata')::date - 14
            THEN ROUND(d14_retained::numeric / cohort_size * 100, 1) ELSE NULL END AS d14,
          CASE WHEN cohort_size > 0 AND cohort_date <= (NOW() AT TIME ZONE 'Asia/Kolkata')::date - 30
            THEN ROUND(d30_retained::numeric / cohort_size * 100, 1) ELSE NULL END AS d30
        FROM cohorts
        WHERE cohort_size > 0
        ORDER BY cohort_date DESC
        LIMIT 30
      `;

      // New vs returning for the last day of the selected range
      const lastDayInRange = endDate || new Date().toISOString().split("T")[0];
      const newReturningLastDayQuery = `
        WITH first_message_dates AS (
          SELECT user_id, MIN((created_at AT TIME ZONE 'Asia/Kolkata')::date) AS first_date
          FROM "Messages"
          GROUP BY user_id
        ),
        last_day_users AS (
          SELECT DISTINCT user_id
          FROM "Messages"
          WHERE (created_at AT TIME ZONE 'Asia/Kolkata')::date = $1::date
        )
        SELECT
          COUNT(*) AS total_last_day,
          COUNT(CASE WHEN fmd.first_date = $1::date THEN 1 END) AS new_users_last_day
        FROM last_day_users ldu
        JOIN first_message_dates fmd ON ldu.user_id = fmd.user_id
      `;

      const [
        dailyResult,
        periodActiveResult,
        mauResult,
        wauResult,
        todayDauResult,
        retentionResult,
        newReturningResult,
        cohortResult,
      ] = await Promise.all([
        queryParams.length > 0
          ? client.query(dailyQuery, queryParams)
          : client.query(dailyQuery),
        queryParams.length > 0
          ? client.query(periodActiveQuery, queryParams)
          : client.query(periodActiveQuery),
        client.query(mauQuery),
        client.query(wauQuery),
        client.query(todayDauQuery),
        client.query(retentionQuery),
        client.query(newReturningLastDayQuery, [lastDayInRange]),
        client.query(cohortQuery),
      ]);

      const dailyData = dailyResult.rows;
      const periodActive =
        parseInt(periodActiveResult.rows[0]?.period_active) || 0;
      const mau = parseInt(mauResult.rows[0]?.mau) || 0;
      const wau = parseInt(wauResult.rows[0]?.wau) || 0;
      const todayDau = parseInt(todayDauResult.rows[0]?.today_dau) || 0;

      const { yesterday_count, retained_count } = retentionResult.rows[0] || {
        yesterday_count: 0,
        retained_count: 0,
      };
      const retentionRate =
        parseInt(yesterday_count) > 0
          ? (parseInt(retained_count) / parseInt(yesterday_count)) * 100
          : 0;

      const { total_last_day, new_users_last_day } =
        newReturningResult.rows[0] || {
          total_last_day: 0,
          new_users_last_day: 0,
        };
      const newUsersLastDay = parseInt(new_users_last_day) || 0;
      const returningUsersLastDay = parseInt(total_last_day) - newUsersLastDay;

      // Stickiness = today's DAU / MAU * 100
      const stickiness = mau > 0 ? (todayDau / mau) * 100 : 0;

      // DAU growth: last day vs second-to-last day in selected range
      const lastDayData = dailyData[dailyData.length - 1] || {};
      const previousDayData = dailyData[dailyData.length - 2] || {};
      const lastDayDau = parseInt(lastDayData?.dau) || 0;
      const previousDayDau = parseInt(previousDayData?.dau) || 0;
      const dauGrowth =
        previousDayDau > 0
          ? ((lastDayDau - previousDayDau) / previousDayDau) * 100
          : 0;

      const avgDau =
        dailyData.length > 0
          ? dailyData.reduce((sum, row) => sum + parseInt(row.dau || 0), 0) /
            dailyData.length
          : 0;

      const dateRange =
        startDate && endDate
          ? Math.ceil(
              (new Date(endDate).getTime() - new Date(startDate).getTime()) /
                (1000 * 60 * 60 * 24)
            ) + 1
          : parseInt(searchParams.get("days") || "30");

      return NextResponse.json({
        success: true,
        data: {
          summary: {
            dau_last_day: lastDayDau,
            dau_growth: Math.round(dauGrowth * 10) / 10,
            wau,
            mau,
            stickiness: Math.round(stickiness * 10) / 10,
            retention_rate: Math.round(retentionRate * 10) / 10,
            new_users_last_day: newUsersLastDay,
            returning_users_last_day: returningUsersLastDay,
            period_active_users: periodActive,
            avg_dau_period: Math.round(avgDau),
            last_day_date: lastDayInRange,
          },
          daily_data: dailyData.map((row) => ({
            date: row.date,
            dau: parseInt(row.dau) || 0,
            new_users: parseInt(row.new_users) || 0,
            returning_users: parseInt(row.returning_users) || 0,
            messages: parseInt(row.messages) || 0,
          })),
          cohort_retention: cohortResult.rows.map((row) => ({
            cohort_date: row.cohort_date,
            cohort_size: parseInt(row.cohort_size) || 0,
            d1: row.d1 !== null ? parseFloat(row.d1) : null,
            d3: row.d3 !== null ? parseFloat(row.d3) : null,
            d7: row.d7 !== null ? parseFloat(row.d7) : null,
            d14: row.d14 !== null ? parseFloat(row.d14) : null,
            d30: row.d30 !== null ? parseFloat(row.d30) : null,
          })),
          meta: {
            period_days: dateRange,
            start_date: startDate,
            end_date: endDate,
            last_updated: new Date().toISOString(),
          },
        },
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Mobile analytics error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch mobile analytics",
        details:
          process.env.NODE_ENV === "development"
            ? (error as Error).message
            : undefined,
      },
      { status: 500 }
    );
  }
}
