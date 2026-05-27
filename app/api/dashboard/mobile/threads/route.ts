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
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");
    const search = searchParams.get("search")?.trim() || "";
    const filter = searchParams.get("filter") || "all";
    const sortBy = searchParams.get("sort") || "recent";

    const client = await pool.connect();

    try {
      let baseQuery = `
        SELECT
          ui.id as user_id,
          ui."parentName",
          ui."parentPhone",
          ui."parentEmail",
          ui."createdAt" as user_created,
          ui.onboarded,
          ui."detailsCollected",
          ui.platform,
          latest_msg.content as last_message,
          latest_msg.created_at as last_activity,
          latest_msg.sender as last_sender,
          COALESCE(msg_count.message_count, 0) as message_count,
          COALESCE(msg_count.user_messages, 0) as user_messages,
          COALESCE(msg_count.bot_messages, 0) as bot_messages,
          p."petName",
          p."petType",
          p.breed,
          p.age as pet_age,
          p."petGender",
          CASE
            WHEN latest_msg.created_at IS NOT NULL THEN latest_msg.created_at
            ELSE ui."createdAt"
          END as sort_time,
          CASE
            WHEN latest_msg.created_at >= NOW() - INTERVAL '1 hour' THEN true
            ELSE false
          END as is_recent_activity,
          CASE
            WHEN ui."createdAt" >= CURRENT_DATE THEN true
            ELSE false
          END as is_new_today
        FROM "UserInfo" ui
        LEFT JOIN "Pets" p ON ui.id = p.user_id AND p."isActive" = true
        LEFT JOIN (
          SELECT DISTINCT ON (user_id)
            user_id, content, created_at, sender
          FROM "Messages"
          ORDER BY user_id, created_at DESC
        ) latest_msg ON ui.id = latest_msg.user_id
        LEFT JOIN (
          SELECT
            user_id,
            COUNT(*) as message_count,
            COUNT(CASE WHEN sender != 'assistant' THEN 1 END) as user_messages,
            COUNT(CASE WHEN sender = 'assistant' THEN 1 END) as bot_messages
          FROM "Messages"
          GROUP BY user_id
        ) msg_count ON ui.id = msg_count.user_id
      `;

      const params: any[] = [];
      let paramIndex = 1;

      const whereConditions: string[] = [];

      // Search functionality
      if (search) {
        whereConditions.push(`(
          ui."parentName" ILIKE $${paramIndex} OR
          ui."parentPhone" ILIKE $${paramIndex} OR
          ui."parentEmail" ILIKE $${paramIndex} OR
          latest_msg.content ILIKE $${paramIndex} OR
          p."petName" ILIKE $${paramIndex}
        )`);
        params.push(`%${search}%`);
        paramIndex++;
      }

      // Filter functionality
      switch (filter) {
        case "active":
          whereConditions.push(
            `latest_msg.created_at >= NOW() - INTERVAL '24 hours'`
          );
          break;
        case "new_today":
          whereConditions.push(`ui."createdAt" >= CURRENT_DATE`);
          break;
        case "with_pets":
          whereConditions.push(`p.id IS NOT NULL`);
          break;
        case "high_activity":
          whereConditions.push(`msg_count.message_count >= 10`);
          break;
        case "onboarded":
          whereConditions.push(`ui.onboarded = true`);
          break;
      }

      if (whereConditions.length > 0) {
        baseQuery += ` WHERE ${whereConditions.join(" AND ")}`;
      }

      // Sorting
      let orderBy = "";
      switch (sortBy) {
        case "messages":
          orderBy = "msg_count.message_count DESC NULLS LAST, sort_time DESC";
          break;
        case "alphabetical":
          orderBy = 'ui."parentName" ASC NULLS LAST, ui."parentEmail" ASC';
          break;
        case "created":
          orderBy = 'ui."createdAt" DESC';
          break;
        default:
          orderBy = "sort_time DESC NULLS LAST";
      }

      baseQuery += ` ORDER BY ${orderBy}`;

      // Pagination
      baseQuery += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit, offset);

      const result = await client.query(baseQuery, params);

      // Get total count for pagination
      let countQuery = `
        SELECT COUNT(DISTINCT ui.id) as total
        FROM "UserInfo" ui
        LEFT JOIN "Pets" p ON ui.id = p.user_id AND p."isActive" = true
        LEFT JOIN (
          SELECT DISTINCT ON (user_id)
            user_id, content, created_at, sender
          FROM "Messages"
          ORDER BY user_id, created_at DESC
        ) latest_msg ON ui.id = latest_msg.user_id
        LEFT JOIN (
          SELECT user_id, COUNT(*) as message_count
          FROM "Messages"
          GROUP BY user_id
        ) msg_count ON ui.id = msg_count.user_id
      `;

      if (whereConditions.length > 0) {
        countQuery += ` WHERE ${whereConditions.join(" AND ")}`;
      }

      const countParams = params.slice(0, -2);
      const countResult = await client.query(countQuery, countParams);
      const totalCount = parseInt(countResult.rows[0].total);

      const threads = result.rows.map((row) => {
        const lastMessage = row.last_message || "No messages yet";
        return {
          user_id: row.user_id,
          user_name:
            row.parentName || row.parentEmail?.split("@")[0] || "Unknown User",
          user_phone: row.parentPhone,
          user_email: row.parentEmail,
          user_created: row.user_created?.toISOString(),
          onboarded: row.onboarded,
          details_collected: row.detailsCollected,
          platform: row.platform || null,

          last_message:
            lastMessage.length > 150
              ? lastMessage.substring(0, 150) + "..."
              : lastMessage,
          last_activity:
            row.last_activity?.toISOString() || row.user_created?.toISOString(),
          last_sender: row.last_sender || "system",

          message_count: parseInt(row.message_count) || 0,
          user_messages: parseInt(row.user_messages) || 0,
          bot_messages: parseInt(row.bot_messages) || 0,

          pet_info: row.petName
            ? {
                name: row.petName,
                type: row.petType,
                breed: row.breed,
                age: row.pet_age,
                gender: row.petGender,
              }
            : null,

          is_recent_activity: row.is_recent_activity,
          is_new_today: row.is_new_today,
          activity_score: calculateActivityScore(row),
          source: "mobile_app",
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
            has_more: offset + threads.length < totalCount,
          },
          filters: {
            search,
            filter,
            sort: sortBy,
          },
        },
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Mobile Threads API error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch mobile conversation threads",
        details:
          process.env.NODE_ENV === "development"
            ? (error as Error).message
            : undefined,
      },
      { status: 500 }
    );
  }
}

function calculateActivityScore(row: any): number {
  const messageCount = parseInt(row.message_count) || 0;
  const isRecent = row.is_recent_activity;
  const isNewToday = row.is_new_today;
  const hasPet = !!row.petName;
  const isOnboarded = row.onboarded;

  let score = messageCount;
  if (isRecent) score += 10;
  if (isNewToday) score += 5;
  if (hasPet) score += 3;
  if (isOnboarded) score += 2;

  return score;
}
