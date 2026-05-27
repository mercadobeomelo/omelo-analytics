import { NextResponse } from "next/server";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: 'postgresql://postgres:rBoBOJUTHhsXTHylCOvlnSsfJRxvrBgS@tramway.proxy.rlwy.net:26530/railway',
  ssl: {
    rejectUnauthorized: false,
  },
});

export async function GET() {
  try {
    const client = await pool.connect();

    try {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

      // Get basic user stats from mobile app UserInfo table
      const userStatsQuery = `
        SELECT
          COUNT(*) as total_users,
          COUNT(CASE WHEN "createdAt" >= $1 THEN 1 END) as new_users_today,
          COUNT(CASE WHEN "createdAt" >= $2 AND "createdAt" < $1 THEN 1 END) as new_users_yesterday,
          COUNT(CASE WHEN onboarded = true THEN 1 END) as completed_onboarding
        FROM "UserInfo"
      `;

      const userStatsResult = await client.query(userStatsQuery, [
        today,
        yesterday,
      ]);
      const userStats = userStatsResult.rows[0];

      // Get message stats from mobile Messages table
      const totalMessagesResult = await client.query(`
        SELECT COUNT(*) as total_messages FROM "Messages"
      `);

      // Get total pets from mobile Pets table
      const totalPetsResult = await client.query(`
        SELECT COUNT(*) as total_pets FROM "Pets"
      `);

      const messageStatsQuery = `
        SELECT
          COUNT(CASE WHEN created_at >= $1 THEN 1 END) as messages_today,
          COUNT(CASE WHEN created_at >= $2 AND created_at < $1 THEN 1 END) as messages_yesterday,
          COUNT(DISTINCT CASE WHEN created_at >= $1 THEN user_id END) as users_today
        FROM "Messages"
      `;

      const messageStatsResult = await client.query(messageStatsQuery, [
        today,
        yesterday,
      ]);
      const messageStats = messageStatsResult.rows[0];

      // Get pet stats
      const petStatsQuery = `
        SELECT
          COUNT(*) as total_pets,
          COUNT(CASE WHEN "createdAt" >= $1 THEN 1 END) as pets_added_today
        FROM "Pets"
      `;

      const petStatsResult = await client.query(petStatsQuery, [today]);
      const petStats = petStatsResult.rows[0];

      // Get peak hour (IST timezone, last 30 days)
      const peakHourQuery = `
        SELECT
          EXTRACT(HOUR FROM created_at AT TIME ZONE 'Asia/Kolkata') as hour,
          COUNT(*) as message_count
        FROM "Messages"
        WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
        GROUP BY EXTRACT(HOUR FROM created_at AT TIME ZONE 'Asia/Kolkata')
        ORDER BY message_count DESC
        LIMIT 1
      `;

      const peakHourResult = await client.query(peakHourQuery);
      const peakHour = peakHourResult.rows[0];

      // Calculate growth rates
      const userGrowth =
        parseInt(userStats.new_users_yesterday) > 0
          ? ((parseInt(userStats.new_users_today) -
              parseInt(userStats.new_users_yesterday)) /
              parseInt(userStats.new_users_yesterday)) *
            100
          : parseInt(userStats.new_users_today) > 0
          ? 100
          : 0;

      const messageGrowth =
        parseInt(messageStats.messages_yesterday) > 0
          ? ((parseInt(messageStats.messages_today) -
              parseInt(messageStats.messages_yesterday)) /
              parseInt(messageStats.messages_yesterday)) *
            100
          : parseInt(messageStats.messages_today) > 0
          ? 100
          : 0;

      const onboardingRate =
        parseInt(userStats.total_users) > 0
          ? (parseInt(userStats.completed_onboarding) /
              parseInt(userStats.total_users)) *
            100
          : 0;

      const messagesPerUser =
        parseInt(messageStats.users_today) > 0
          ? parseInt(messageStats.messages_today) /
            parseInt(messageStats.users_today)
          : 0;

      return NextResponse.json({
        success: true,
        data: {
          // Core metrics
          total_users: parseInt(userStats.total_users) || 0,
          active_users_today: parseInt(messageStats.users_today) || 0,
          active_now: 0,
          active_last_hour: 0,

          // Message metrics
          total_messages:
            parseInt(totalMessagesResult.rows[0].total_messages) || 0,
          total_messages_all:
            parseInt(totalMessagesResult.rows[0].total_messages) || 0,
          messages_today: parseInt(messageStats.messages_today) || 0,
          messages_per_user_today: Math.round(messagesPerUser * 10) / 10,

          // Growth metrics
          new_users_today: parseInt(userStats.new_users_today) || 0,
          user_growth_rate: Math.round(userGrowth * 10) / 10,
          message_growth_rate: Math.round(messageGrowth * 10) / 10,

          // Engagement metrics
          onboarding_completion_rate: Math.round(onboardingRate * 10) / 10,
          avg_response_time_ms: 0,

          // Pet metrics
          total_pets: parseInt(petStats.total_pets) || 0,
          pets_added_today: parseInt(petStats.pets_added_today) || 0,

          // Peak activity
          peak_hour: peakHour ? parseInt(peakHour.hour) : null,
          peak_hour_messages: peakHour ? parseInt(peakHour.message_count) : 0,

          // Metadata
          last_updated: now.toISOString(),
          update_interval: 10000,
          source: "mobile_app",
        },
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Mobile dashboard overview error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch mobile dashboard overview",
        details:
          process.env.NODE_ENV === "development"
            ? (error as Error).message
            : undefined,
      },
      { status: 500 }
    );
  }
}
