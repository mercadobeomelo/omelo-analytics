import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false }
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ user_id: string }> }
) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');
    const resolvedParams = await params;
    const user_id = resolvedParams.user_id;

    const client = await pool.connect();
    
    try {
      // Get user information
      const userQuery = `
        SELECT 
          wu.id,
          wu.parentname,
          wu.parentphone,
          wu.parentemail,
          wu.created_at,
          wu.last_user_msg,
          wu.onboarding_complete,
          wu.has_seen_welcome,
          wu.location_address,
          wu.referralcode,
          wu.numberofinvitesleft,
          wp.petname,
          wp.pettype,
          wp.breed,
          wp.age as pet_age,
          wp.petgender,
          wp.weight,
          wp.neutered,
          wp.petdob,
          wp.created_at as pet_created
        FROM whatsapp_userinfo wu
        LEFT JOIN whatsapp_petdetails wp ON wu.id = wp.user_id
        WHERE wu.id = $1
      `;

      const userResult = await client.query(userQuery, [user_id]);
      
      if (userResult.rows.length === 0) {
        return NextResponse.json(
          { success: false, error: 'User not found' },
          { status: 404 }
        );
      }

      const userData = userResult.rows[0];

      // Get messages with pagination
      const messagesQuery = `
        SELECT 
          wm.message_id,
          wm.content,
          wm.sender,
          wm.created_at,
          wm.bucket_index
        FROM whatsapp_messages wm
        WHERE wm.user_id = $1
        ORDER BY wm.created_at ASC
        LIMIT $2 OFFSET $3
      `;

      const messagesResult = await client.query(messagesQuery, [user_id, limit, offset]);

      // Get total message count
      const countQuery = `
        SELECT 
          COUNT(*) as total_messages,
          COUNT(CASE WHEN sender = 'user' THEN 1 END) as user_messages,
          COUNT(CASE WHEN sender != 'user' THEN 1 END) as bot_messages,
          MIN(created_at) as first_message,
          MAX(created_at) as last_message
        FROM whatsapp_messages 
        WHERE user_id = $1
      `;

      const countResult = await client.query(countQuery, [user_id]);
      const messageStats = countResult.rows[0];

      // Get conversation analytics
      const analyticsQuery = `
        WITH message_intervals AS (
          SELECT 
            created_at,
            LAG(created_at) OVER (ORDER BY created_at) as prev_message_time,
            sender
          FROM whatsapp_messages
          WHERE user_id = $1
          ORDER BY created_at
        ),
        response_times AS (
          SELECT 
            EXTRACT(EPOCH FROM (created_at - prev_message_time)) as interval_seconds
          FROM message_intervals
          WHERE prev_message_time IS NOT NULL
        )
        SELECT 
          AVG(CASE WHEN interval_seconds < 3600 THEN interval_seconds END) as avg_response_time_seconds,
          COUNT(CASE WHEN interval_seconds < 3600 THEN 1 END) as response_count
        FROM response_times
      `;

      const analyticsResult = await client.query(analyticsQuery, [user_id]);
      const analytics = analyticsResult.rows[0];

      // Get user's feedback
      const feedbackQuery = `
        SELECT 
          feedback_content,
          feedback_rating,
          feedback_type,
          created_at
        FROM user_feedback
        WHERE user_phone = $1
        ORDER BY created_at DESC
        LIMIT 10
      `;

      const feedbackResult = await client.query(feedbackQuery, [userData.parentphone]);

      // Format messages
      const messages = messagesResult.rows.map(row => ({
        message_id: row.message_id,
        content: row.content,
        sender: row.sender,
        timestamp: row.created_at?.toISOString(),
        is_user: row.sender === 'user',
        bucket_index: row.bucket_index
      }));

      // Calculate conversation duration
      const firstMessage = messageStats.first_message ? new Date(messageStats.first_message) : null;
      const lastMessage = messageStats.last_message ? new Date(messageStats.last_message) : null;
      const conversationDuration = firstMessage && lastMessage 
        ? Math.round((lastMessage.getTime() - firstMessage.getTime()) / (1000 * 60)) // minutes
        : 0;

      // Format user profile
      const userProfile = {
        id: userData.id,
        name: userData.parentname,
        phone: userData.parentphone,
        email: userData.parentemail,
        created_at: userData.created_at?.toISOString(),
        last_user_msg: userData.last_user_msg?.toISOString(),
        onboarding_complete: userData.onboarding_complete,
        has_seen_welcome: userData.has_seen_welcome,
        location: userData.location_address,
        referral_code: userData.referralcode,
        invites_left: userData.numberofinvitesleft
      };

      // Format pet information
      const petInfo = userData.petname ? {
        name: userData.petname,
        type: userData.pettype,
        breed: userData.breed,
        age: userData.pet_age,
        gender: userData.petgender,
        weight: userData.weight,
        neutered: userData.neutered,
        date_of_birth: userData.petdob?.toISOString(),
        pet_created: userData.pet_created?.toISOString()
      } : null;

      // Format conversation analytics
      const conversationAnalytics = {
        total_messages: parseInt(messageStats.total_messages) || 0,
        user_messages: parseInt(messageStats.user_messages) || 0,
        bot_messages: parseInt(messageStats.bot_messages) || 0,
        first_message: messageStats.first_message?.toISOString(),
        last_message: messageStats.last_message?.toISOString(),
        conversation_duration_minutes: conversationDuration,
        avg_response_time_seconds: Math.round(parseFloat(analytics.avg_response_time_seconds) || 0),
        messages_per_day: conversationDuration > 0 
          ? Math.round((parseInt(messageStats.total_messages) / (conversationDuration / (24 * 60))) * 100) / 100
          : 0
      };

      // Format feedback
      const userFeedback = feedbackResult.rows.map(row => ({
        content: row.feedback_content,
        rating: row.feedback_rating,
        type: row.feedback_type,
        created_at: row.created_at?.toISOString()
      }));

      return NextResponse.json({
        success: true,
        data: {
          user_profile: userProfile,
          pet_info: petInfo,
          messages,
          conversation_analytics: conversationAnalytics,
          user_feedback: userFeedback,
          pagination: {
            total: parseInt(messageStats.total_messages) || 0,
            offset,
            limit,
            has_more: offset + messages.length < (parseInt(messageStats.total_messages) || 0)
          }
        }
      });
      
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Messages API error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch messages',
        details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      },
      { status: 500 }
    );
  }
}