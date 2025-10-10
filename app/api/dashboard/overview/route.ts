import { NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: 'postgresql://postgres:rBoBOJUTHhsXTHylCOvlnSsfJRxvrBgS@tramway.proxy.rlwy.net:26530/railway',
  ssl: { rejectUnauthorized: false }
});

export async function GET() {
  try {
    const client = await pool.connect();
    
    try {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      // Get basic user stats
      const userStatsQuery = `
        SELECT 
          COUNT(*) as total_users,
          COUNT(CASE WHEN created_at >= $1 THEN 1 END) as new_users_today,
          COUNT(CASE WHEN created_at >= $2 AND created_at < $1 THEN 1 END) as new_users_yesterday,
          COUNT(CASE WHEN onboarding_complete = true THEN 1 END) as completed_onboarding
        FROM whatsapp_userinfo
      `;
      
      const userStatsResult = await client.query(userStatsQuery, [today, yesterday]);
      const userStats = userStatsResult.rows[0];

      // Get message stats including petdetails
      // Simplified fast queries
      const totalMessagesResult = await client.query(`
        SELECT 
          (SELECT COUNT(*) FROM message_analytics_raw) + 
          (SELECT COUNT(*) FROM whatsapp_messages) as total_messages
      `);
      const totalPetsResult = await client.query(`SELECT COUNT(*) as total_petdetails FROM whatsapp_petdetails`);
      
      const messageStatsQuery = `
        SELECT 
          COUNT(CASE WHEN created_at >= $1 THEN 1 END) as messages_today,
          COUNT(CASE WHEN created_at >= $2 AND created_at < $1 THEN 1 END) as messages_yesterday
        FROM whatsapp_messages
      `;
      
      const messageStatsResult = await client.query(messageStatsQuery, [today, yesterday]);
      const messageStats = messageStatsResult.rows[0];

      // Get pet stats
      const petStatsQuery = `
        SELECT 
          COUNT(*) as total_pets,
          COUNT(CASE WHEN created_at >= $1 THEN 1 END) as pets_added_today
        FROM whatsapp_petdetails
      `;
      
      const petStatsResult = await client.query(petStatsQuery, [today]);
      const petStats = petStatsResult.rows[0];

      // Get feedback stats
      const feedbackStatsQuery = `
        SELECT 
          COUNT(*) as total_feedback,
          COUNT(CASE WHEN feedback_rating >= 2 THEN 1 END) as positive_feedback,
          COUNT(CASE WHEN created_at >= $1 THEN 1 END) as feedback_today,
          CASE 
            WHEN COUNT(*) > 0 THEN 
              ROUND((COUNT(CASE WHEN feedback_rating >= 2 THEN 1 END)::DECIMAL / COUNT(*)) * 100, 1)
            ELSE 0 
          END as satisfaction_rate
        FROM user_feedback
        WHERE created_at >= $2
      `;
      
      const feedbackStatsResult = await client.query(feedbackStatsQuery, [today, weekAgo]);
      const feedbackStats = feedbackStatsResult.rows[0];

      // Get peak hour (IST timezone, last 30 days for better accuracy)
      const peakHourQuery = `
        SELECT 
          EXTRACT(HOUR FROM created_at AT TIME ZONE 'Asia/Kolkata') as hour,
          COUNT(*) as message_count
        FROM whatsapp_messages
        WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
        GROUP BY EXTRACT(HOUR FROM created_at AT TIME ZONE 'Asia/Kolkata')
        ORDER BY message_count DESC
        LIMIT 1
      `;
      
      const peakHourResult = await client.query(peakHourQuery);
      const peakHour = peakHourResult.rows[0];

      // Calculate growth rates and additional metrics
      const userGrowth = parseInt(userStats.new_users_yesterday) > 0 
        ? ((parseInt(userStats.new_users_today) - parseInt(userStats.new_users_yesterday)) / parseInt(userStats.new_users_yesterday) * 100) 
        : (parseInt(userStats.new_users_today) > 0 ? 100 : 0);
      
      const messageGrowth = parseInt(messageStats.messages_yesterday) > 0 
        ? ((parseInt(messageStats.messages_today) - parseInt(messageStats.messages_yesterday)) / parseInt(messageStats.messages_yesterday) * 100) 
        : (parseInt(messageStats.messages_today) > 0 ? 100 : 0);

      const onboardingRate = parseInt(userStats.total_users) > 0 
        ? (parseInt(userStats.completed_onboarding) / parseInt(userStats.total_users) * 100) 
        : 0;

      const messagesPerUser = parseInt(messageStats.users_today) > 0 
        ? (parseInt(messageStats.messages_today) / parseInt(messageStats.users_today)) 
        : 0;

      return NextResponse.json({
        success: true,
        data: {
          // Core metrics
          total_users: parseInt(userStats.total_users) || 0,
          active_users_today: parseInt(messageStats.users_today) || 0,
          active_now: 0, // Simplified for performance
          active_last_hour: 0, // Simplified for performance
          
          // Message metrics
          total_messages: parseInt(totalMessagesResult.rows[0].total_messages) || 0,
          total_messages_all: parseInt(totalMessagesResult.rows[0].total_messages) || 0,
          total_petdetails: parseInt(totalPetsResult.rows[0].total_petdetails) || 0,
          messages_today: parseInt(messageStats.messages_today) || 0,
          messages_per_user_today: Math.round(messagesPerUser * 10) / 10,
          
          // Growth metrics  
          new_users_today: parseInt(userStats.new_users_today) || 0,
          user_growth_rate: Math.round(userGrowth * 10) / 10,
          message_growth_rate: Math.round(messageGrowth * 10) / 10,
          
          // Engagement metrics
          onboarding_completion_rate: Math.round(onboardingRate * 10) / 10,
          avg_response_time_ms: 0, // Simplified for now
          
          // Pet metrics
          total_pets: parseInt(petStats.total_pets) || 0,
          pets_added_today: parseInt(petStats.pets_added_today) || 0,
          
          // Feedback metrics
          total_feedback: parseInt(feedbackStats.total_feedback) || 0,
          satisfaction_rate: parseFloat(feedbackStats.satisfaction_rate) || 0,
          feedback_today: parseInt(feedbackStats.feedback_today) || 0,
          
          // Peak activity
          peak_hour: peakHour ? parseInt(peakHour.hour) : null,
          peak_hour_messages: peakHour ? parseInt(peakHour.message_count) : 0,
          
          // Metadata
          last_updated: now.toISOString(),
          update_interval: 10000 // 10 seconds
        }
      });
      
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Dashboard overview error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch dashboard overview',
        details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      },
      { status: 500 }
    );
  }
}