import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: 'postgresql://postgres:rBoBOJUTHhsXTHylCOvlnSsfJRxvrBgS@tramway.proxy.rlwy.net:26530/railway',
  ssl: { rejectUnauthorized: false }
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const timeRange = searchParams.get('range') || '30'; // days
    const days = parseInt(timeRange);

    const client = await pool.connect();
    
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // User registration trends
      const registrationTrendQuery = `
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as new_users,
          COUNT(*) OVER (ORDER BY DATE(created_at)) as cumulative_users
        FROM whatsapp_userinfo
        WHERE created_at >= $1
        GROUP BY DATE(created_at)
        ORDER BY date DESC
      `;

      const registrationResult = await client.query(registrationTrendQuery, [startDate]);

      // Daily active users (users who sent messages)
      const dauQuery = `
        SELECT 
          DATE(wm.created_at) as date,
          COUNT(DISTINCT wm.user_id) as active_users,
          COUNT(*) as total_messages
        FROM whatsapp_messages wm
        WHERE wm.created_at >= $1 AND wm.sender = 'user'
        GROUP BY DATE(wm.created_at)
        ORDER BY date DESC
      `;

      const dauResult = await client.query(dauQuery, [startDate]);

      // User retention analysis
      const retentionQuery = `
        WITH user_first_activity AS (
          SELECT 
            user_id,
            DATE(MIN(created_at)) as first_active_date
          FROM whatsapp_messages
          WHERE sender = 'user'
          GROUP BY user_id
        ),
        retention_cohorts AS (
          SELECT 
            ufa.first_active_date as cohort_date,
            COUNT(DISTINCT ufa.user_id) as cohort_size,
            COUNT(DISTINCT CASE 
              WHEN wm.created_at >= ufa.first_active_date + INTERVAL '1 day' 
              AND wm.created_at < ufa.first_active_date + INTERVAL '2 days'
              THEN wm.user_id 
            END) as day_1_retained,
            COUNT(DISTINCT CASE 
              WHEN wm.created_at >= ufa.first_active_date + INTERVAL '7 days' 
              AND wm.created_at < ufa.first_active_date + INTERVAL '8 days'
              THEN wm.user_id 
            END) as day_7_retained,
            COUNT(DISTINCT CASE 
              WHEN wm.created_at >= ufa.first_active_date + INTERVAL '30 days' 
              AND wm.created_at < ufa.first_active_date + INTERVAL '31 days'
              THEN wm.user_id 
            END) as day_30_retained
          FROM user_first_activity ufa
          LEFT JOIN whatsapp_messages wm ON ufa.user_id = wm.user_id AND wm.sender = 'user'
          WHERE ufa.first_active_date >= $1
          GROUP BY ufa.first_active_date
        )
        SELECT 
          cohort_date,
          cohort_size,
          CASE WHEN cohort_size > 0 THEN ROUND((day_1_retained::float / cohort_size * 100), 1) ELSE 0 END as retention_day_1,
          CASE WHEN cohort_size > 0 THEN ROUND((day_7_retained::float / cohort_size * 100), 1) ELSE 0 END as retention_day_7,
          CASE WHEN cohort_size > 0 THEN ROUND((day_30_retained::float / cohort_size * 100), 1) ELSE 0 END as retention_day_30
        FROM retention_cohorts
        WHERE cohort_size > 0
        ORDER BY cohort_date DESC
        LIMIT 20
      `;

      const retentionResult = await client.query(retentionQuery, [startDate]);

      // Geographic distribution (if location data exists)
      const geoQuery = `
        SELECT 
          COALESCE(location_address, 'Unknown') as location,
          COUNT(*) as user_count
        FROM whatsapp_userinfo
        WHERE created_at >= $1
        GROUP BY location_address
        HAVING COUNT(*) > 1
        ORDER BY user_count DESC
        LIMIT 15
      `;

      const geoResult = await client.query(geoQuery, [startDate]);

      // User engagement distribution
      const engagementQuery = `
        WITH user_message_counts AS (
          SELECT 
            wm.user_id,
            COUNT(*) as message_count,
            COUNT(DISTINCT DATE(wm.created_at)) as active_days,
            MIN(wm.created_at) as first_message,
            MAX(wm.created_at) as last_message
          FROM whatsapp_messages wm
          WHERE wm.created_at >= $1 AND wm.sender = 'user'
          GROUP BY wm.user_id
        )
        SELECT 
          CASE 
            WHEN message_count = 1 THEN '1 message'
            WHEN message_count BETWEEN 2 AND 5 THEN '2-5 messages'
            WHEN message_count BETWEEN 6 AND 15 THEN '6-15 messages'
            WHEN message_count BETWEEN 16 AND 50 THEN '16-50 messages'
            ELSE '50+ messages'
          END as engagement_tier,
          COUNT(*) as user_count,
          AVG(message_count) as avg_messages,
          AVG(active_days) as avg_active_days
        FROM user_message_counts
        GROUP BY 
          CASE 
            WHEN message_count = 1 THEN '1 message'
            WHEN message_count BETWEEN 2 AND 5 THEN '2-5 messages'
            WHEN message_count BETWEEN 6 AND 15 THEN '6-15 messages'
            WHEN message_count BETWEEN 16 AND 50 THEN '16-50 messages'
            ELSE '50+ messages'
          END
        ORDER BY MIN(message_count)
      `;

      const engagementResult = await client.query(engagementQuery, [startDate]);

      // Onboarding completion analysis
      const onboardingQuery = `
        SELECT 
          CASE 
            WHEN onboarding_complete = true THEN 'Completed'
            WHEN onboarding_complete = false THEN 'Incomplete'
            ELSE 'Unknown'
          END as status,
          COUNT(*) as user_count,
          ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 1) as percentage
        FROM whatsapp_userinfo
        WHERE created_at >= $1
        GROUP BY onboarding_complete
      `;

      const onboardingResult = await client.query(onboardingQuery, [startDate]);

      // Peak activity hours
      const activityHoursQuery = `
        SELECT 
          EXTRACT(HOUR FROM created_at) as hour,
          COUNT(DISTINCT user_id) as unique_users,
          COUNT(*) as total_messages
        FROM whatsapp_messages
        WHERE created_at >= $1 AND sender = 'user'
        GROUP BY EXTRACT(HOUR FROM created_at)
        ORDER BY hour
      `;

      const activityHoursResult = await client.query(activityHoursQuery, [startDate]);

      return NextResponse.json({
        success: true,
        data: {
          registration_trends: registrationResult.rows.map(row => ({
            date: row.date,
            new_users: parseInt(row.new_users),
            cumulative_users: parseInt(row.cumulative_users)
          })),
          
          daily_active_users: dauResult.rows.map(row => ({
            date: row.date,
            active_users: parseInt(row.active_users),
            total_messages: parseInt(row.total_messages)
          })),
          
          retention_analysis: retentionResult.rows.map(row => ({
            cohort_date: row.cohort_date,
            cohort_size: parseInt(row.cohort_size),
            retention_day_1: parseFloat(row.retention_day_1),
            retention_day_7: parseFloat(row.retention_day_7),
            retention_day_30: parseFloat(row.retention_day_30)
          })),
          
          geographic_distribution: geoResult.rows.map(row => ({
            location: row.location,
            user_count: parseInt(row.user_count)
          })),
          
          engagement_distribution: engagementResult.rows.map(row => ({
            tier: row.engagement_tier,
            user_count: parseInt(row.user_count),
            avg_messages: Math.round(parseFloat(row.avg_messages)),
            avg_active_days: Math.round(parseFloat(row.avg_active_days) * 10) / 10
          })),
          
          onboarding_completion: onboardingResult.rows.map(row => ({
            status: row.status,
            user_count: parseInt(row.user_count),
            percentage: parseFloat(row.percentage)
          })),
          
          peak_activity_hours: activityHoursResult.rows.map(row => ({
            hour: parseInt(row.hour),
            unique_users: parseInt(row.unique_users),
            total_messages: parseInt(row.total_messages)
          })),
          
          summary: {
            time_range_days: days,
            total_new_users: registrationResult.rows.reduce((sum, row) => sum + parseInt(row.new_users), 0),
            avg_daily_active_users: dauResult.rows.length > 0 
              ? Math.round(dauResult.rows.reduce((sum, row) => sum + parseInt(row.active_users), 0) / dauResult.rows.length)
              : 0
          }
        }
      });
      
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('User analytics error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch user analytics',
        details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      },
      { status: 500 }
    );
  }
}