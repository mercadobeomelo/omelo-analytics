import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: 'postgresql://postgres:rBoBOJUTHhsXTHylCOvlnSsfJRxvrBgS@tramway.proxy.rlwy.net:26530/railway',
  ssl: { rejectUnauthorized: false }
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    
    // Fallback to 30 days if no dates provided
    let whereClause = '';
    let queryParams: string[] = [];
    
    if (startDate && endDate) {
      whereClause = 'WHERE (created_at AT TIME ZONE \'Asia/Kolkata\')::date >= $1::date AND (created_at AT TIME ZONE \'Asia/Kolkata\')::date <= $2::date';
      queryParams = [startDate, endDate];
    } else {
      const days = parseInt(searchParams.get('days') || '30');
      whereClause = `WHERE created_at >= CURRENT_DATE - INTERVAL '${days} days'`;
    }
    
    const client = await pool.connect();
    
    try {
      // Get basic daily stats
      const analyticsQuery = `
        SELECT
          (created_at AT TIME ZONE 'Asia/Kolkata')::date AS date,
          COUNT(DISTINCT user_id) AS dau,
          COUNT(*) AS messages
        FROM whatsapp_messages
        ${whereClause}
        GROUP BY (created_at AT TIME ZONE 'Asia/Kolkata')::date
        ORDER BY date
      `;

      // Get total active users for the selected period
      const mauQuery = `
        SELECT COUNT(DISTINCT user_id) as mau
        FROM whatsapp_messages
        ${whereClause}
      `;

      // Get retention rate - users active both today and yesterday
      const retentionQuery = `
        WITH today_users AS (
          SELECT DISTINCT user_id 
          FROM whatsapp_messages 
          WHERE (created_at AT TIME ZONE 'Asia/Kolkata')::date = CURRENT_DATE
        ),
        yesterday_users AS (
          SELECT DISTINCT user_id 
          FROM whatsapp_messages 
          WHERE (created_at AT TIME ZONE 'Asia/Kolkata')::date = CURRENT_DATE - 1
        )
        SELECT 
          (SELECT COUNT(*) FROM yesterday_users) as yesterday_count,
          (SELECT COUNT(*) FROM today_users t JOIN yesterday_users y ON t.user_id = y.user_id) as both_days_count
      `;
      
      const [dailyResult, mauResult, retentionResult] = await Promise.all([
        queryParams.length > 0 ? client.query(analyticsQuery, queryParams) : client.query(analyticsQuery),
        queryParams.length > 0 ? client.query(mauQuery, queryParams) : client.query(mauQuery),
        client.query(retentionQuery)
      ]);
      
      const dailyData = dailyResult.rows;
      const mau = parseInt(mauResult.rows[0]?.mau) || 0;
      const { yesterday_count, both_days_count } = retentionResult.rows[0] || { yesterday_count: 0, both_days_count: 0 };

      // Calculate date range in days
      const dateRange = startDate && endDate ? 
        Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1 :
        parseInt(searchParams.get('days') || '30');
      
      // Get the last day and previous day from selected range (not necessarily "today")
      const lastDayData = dailyData[dailyData.length - 1] || {};
      const previousDayData = dailyData[dailyData.length - 2] || {};
      
      const lastDayDau = parseInt(lastDayData?.dau) || 0;
      const previousDayDau = parseInt(previousDayData?.dau) || 0;
      
      const dauGrowth = previousDayDau > 0 ? ((lastDayDau - previousDayDau) / previousDayDau * 100) : 0;
      const avgDau = dailyData.length > 0 ? dailyData.reduce((sum, row) => sum + parseInt(row.dau || 0), 0) / dailyData.length : 0;
      
      // Calculate real new/returning users for the last day in range
      const newUsersQuery = `
        WITH first_message_dates AS (
          SELECT user_id, MIN((created_at AT TIME ZONE 'Asia/Kolkata')::date) as first_date
          FROM whatsapp_messages
          GROUP BY user_id
        ),
        last_day_users AS (
          SELECT DISTINCT user_id
          FROM whatsapp_messages
          WHERE (created_at AT TIME ZONE 'Asia/Kolkata')::date = $1::date
        )
        SELECT 
          COUNT(*) as total_last_day,
          COUNT(CASE WHEN fmd.first_date = $1::date THEN 1 END) as new_users_last_day
        FROM last_day_users ldu
        JOIN first_message_dates fmd ON ldu.user_id = fmd.user_id
      `;
      
      const lastDayInRange = endDate || new Date().toISOString().split('T')[0];
      const newUsersResult = await client.query(newUsersQuery, [lastDayInRange]);
      const { total_last_day, new_users_last_day } = newUsersResult.rows[0] || { total_last_day: 0, new_users_last_day: 0 };
      
      const newUsersLastDay = parseInt(new_users_last_day) || 0;
      const returningUsersLastDay = parseInt(total_last_day) - newUsersLastDay;
      
      // Real retention rate: (users active both days / users active yesterday) * 100
      const retentionRate = parseInt(yesterday_count) > 0 ? (parseInt(both_days_count) / parseInt(yesterday_count) * 100) : 0;

      return NextResponse.json({
        success: true,
        data: {
          summary: {
            dau_last_day: lastDayDau,
            dau_growth: Math.round(dauGrowth * 10) / 10,
            new_users_last_day: newUsersLastDay,
            returning_users_last_day: returningUsersLastDay,
            retention_rate: Math.round(retentionRate * 10) / 10,
            period_active_users: mau,
            avg_dau_period: Math.round(avgDau),
            last_day_date: lastDayInRange
          },
          daily_data: dailyData.map(row => ({
            date: row.date,
            dau: parseInt(row.dau) || 0,
            new_users: Math.round((parseInt(row.dau) || 0) * 0.1), // Estimate
            repeat_users: Math.round((parseInt(row.dau) || 0) * 0.9), // Estimate
            messages: parseInt(row.messages) || 0
          })),
          meta: {
            period_days: dateRange,
            start_date: startDate,
            end_date: endDate,
            last_updated: new Date().toISOString()
          }
        }
      });
      
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Analytics error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch analytics',
        details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      },
      { status: 500 }
    );
  }
}