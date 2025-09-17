import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: 'postgresql://postgres:rBoBOJUTHhsXTHylCOvlnSsfJRxvrBgS@tramway.proxy.rlwy.net:26530/railway',
  ssl: { rejectUnauthorized: false }
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const search = searchParams.get('search')?.trim() || '';
    const filter = searchParams.get('filter') || 'all'; // all, active, new_today, with_pets, high_activity
    const sortBy = searchParams.get('sort') || 'recent'; // recent, messages, alphabetical, created

    console.log('Threads API called with:', { search, filter, sortBy, limit, offset });

    const client = await pool.connect();
    
    try {
      let baseQuery = `
        SELECT
          wu.id as user_id,
          wu.parentname,
          wu.parentphone,
          wu.parentemail,
          wu.created_at as user_created,
          wu.last_user_msg,
          wu.onboarding_complete,
          latest_msg.content as last_message,
          latest_msg.created_at as last_activity,
          latest_msg.sender as last_sender,
          COALESCE(msg_count.message_count, 0) as message_count,
          COALESCE(msg_count.user_messages, 0) as user_messages,
          COALESCE(msg_count.bot_messages, 0) as bot_messages,
          wp.petname,
          wp.pettype,
          wp.breed,
          wp.age as pet_age,
          wp.petgender,
          CASE 
            WHEN latest_msg.created_at IS NOT NULL THEN latest_msg.created_at
            ELSE wu.created_at
          END as sort_time,
          CASE 
            WHEN latest_msg.created_at >= NOW() - INTERVAL '1 hour' THEN true
            ELSE false
          END as is_recent_activity,
          CASE 
            WHEN wu.created_at >= CURRENT_DATE THEN true
            ELSE false
          END as is_new_today
        FROM whatsapp_userinfo wu
        LEFT JOIN whatsapp_petdetails wp ON wu.id = wp.user_id
        LEFT JOIN (
          SELECT DISTINCT ON (user_id) 
            user_id, content, created_at, sender
          FROM whatsapp_messages 
          ORDER BY user_id, created_at DESC
        ) latest_msg ON wu.id = latest_msg.user_id
        LEFT JOIN (
          SELECT 
            user_id, 
            COUNT(*) as message_count,
            COUNT(CASE WHEN sender = 'user' THEN 1 END) as user_messages,
            COUNT(CASE WHEN sender != 'user' THEN 1 END) as bot_messages
          FROM whatsapp_messages 
          GROUP BY user_id
        ) msg_count ON wu.id = msg_count.user_id
      `;
      
      const params: any[] = [];
      let paramIndex = 1;
      
      // Add WHERE conditions
      const whereConditions: string[] = [];
      
      // Always filter out system/test accounts
      whereConditions.push(`wu.parentphone NOT LIKE 'whatsapp_%'`);
      
      // Search functionality
      if (search) {
        whereConditions.push(`(
          wu.parentname ILIKE $${paramIndex} OR
          wu.parentphone ILIKE $${paramIndex} OR
          wu.parentemail ILIKE $${paramIndex} OR
          latest_msg.content ILIKE $${paramIndex} OR
          wp.petname ILIKE $${paramIndex}
        )`);
        params.push(`%${search}%`);
        paramIndex++;
      }

      // Filter functionality
      switch (filter) {
        case 'active':
          whereConditions.push(`latest_msg.created_at >= NOW() - INTERVAL '24 hours'`);
          break;
        case 'new_today':
          whereConditions.push(`wu.created_at >= CURRENT_DATE`);
          break;
        case 'with_pets':
          whereConditions.push(`wp.id IS NOT NULL`);
          break;
        case 'high_activity':
          whereConditions.push(`msg_count.message_count >= 10`);
          break;
      }

      if (whereConditions.length > 0) {
        baseQuery += ` WHERE ${whereConditions.join(' AND ')}`;
      }

      // Sorting
      let orderBy = '';
      switch (sortBy) {
        case 'messages':
          orderBy = 'msg_count.message_count DESC NULLS LAST, sort_time DESC';
          break;
        case 'alphabetical':
          orderBy = 'wu.parentname ASC NULLS LAST, wu.parentphone ASC';
          break;
        case 'created':
          orderBy = 'wu.created_at DESC';
          break;
        default: // recent
          orderBy = 'sort_time DESC NULLS LAST';
      }

      baseQuery += ` ORDER BY ${orderBy}`;
      
      // Pagination
      baseQuery += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit, offset);

      console.log('Executing query with params:', params);
      const result = await client.query(baseQuery, params);
      console.log('Query returned', result.rows.length, 'rows');
      
      // Get total count for pagination
      let countQuery = `
        SELECT COUNT(DISTINCT wu.id) as total
        FROM whatsapp_userinfo wu
        LEFT JOIN whatsapp_petdetails wp ON wu.id = wp.user_id
        LEFT JOIN (
          SELECT DISTINCT ON (user_id) 
            user_id, content, created_at, sender
          FROM whatsapp_messages 
          ORDER BY user_id, created_at DESC
        ) latest_msg ON wu.id = latest_msg.user_id
        LEFT JOIN (
          SELECT user_id, COUNT(*) as message_count
          FROM whatsapp_messages 
          GROUP BY user_id
        ) msg_count ON wu.id = msg_count.user_id
      `;

      if (whereConditions.length > 0) {
        countQuery += ` WHERE ${whereConditions.join(' AND ')}`;
      }

      // Use the same parameters for count as for main query (minus limit/offset)
      const countParams = params.slice(0, -2);
      const countResult = await client.query(countQuery, countParams);
      const totalCount = parseInt(countResult.rows[0].total);

      const threads = result.rows.map(row => {
        const lastMessage = row.last_message || "No messages yet";
        return {
          user_id: row.user_id,
          user_name: row.parentname || row.parentphone || "Unknown User",
          user_phone: row.parentphone,
          user_email: row.parentemail,
          user_created: row.user_created?.toISOString(),
          last_user_msg: row.last_user_msg?.toISOString(),
          onboarding_complete: row.onboarding_complete,
          
          last_message: lastMessage.length > 150 ? lastMessage.substring(0, 150) + "..." : lastMessage,
          last_activity: row.last_activity?.toISOString() || row.user_created?.toISOString(),
          last_sender: row.last_sender || "system",
          
          message_count: parseInt(row.message_count) || 0,
          user_messages: parseInt(row.user_messages) || 0,
          bot_messages: parseInt(row.bot_messages) || 0,
          
          pet_info: row.petname ? {
            name: row.petname,
            type: row.pettype,
            breed: row.breed,
            age: row.pet_age,
            gender: row.petgender
          } : null,
          
          is_recent_activity: row.is_recent_activity,
          is_new_today: row.is_new_today,
          activity_score: calculateActivityScore(row)
        };
      });

      return NextResponse.json({
        success: true,
        data: {
          threads,
          pagination: {
            total: totalCount,
            offset,
            limit,
            has_more: offset + threads.length < totalCount
          },
          filters: {
            search,
            filter,
            sort: sortBy
          }
        }
      });
      
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Threads API error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch conversation threads',
        details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      },
      { status: 500 }
    );
  }
}

function calculateActivityScore(row: any): number {
  const messageCount = parseInt(row.message_count) || 0;
  const isRecent = row.is_recent_activity;
  const isNewToday = row.is_new_today;
  const hasPet = !!row.petname;
  
  let score = messageCount;
  if (isRecent) score += 10;
  if (isNewToday) score += 5;
  if (hasPet) score += 3;
  
  return score;
}