import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: 'postgresql://postgres:rBoBOJUTHhsXTHylCOvlnSsfJRxvrBgS@tramway.proxy.rlwy.net:26530/railway',
  ssl: {
    rejectUnauthorized: false,
  },
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ user_id: string }> }
) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "100");
    const offset = parseInt(searchParams.get("offset") || "0");
    const resolvedParams = await params;
    const user_id = resolvedParams.user_id;

    const client = await pool.connect();

    try {
      // Get user information from mobile UserInfo table
      const userQuery = `
        SELECT
          ui.id,
          ui."parentName",
          ui."parentPhone",
          ui."parentEmail",
          ui."createdAt",
          ui.onboarded,
          ui."detailsCollected",
          ui."referralCode",
          ui."userImage",
          p."petName",
          p."petType",
          p.breed,
          p.age as pet_age,
          p."petGender",
          p.weight,
          p.neutered,
          p."petDOB",
          p."createdAt" as pet_created
        FROM "UserInfo" ui
        LEFT JOIN "Pets" p ON ui.id = p.user_id AND p."isActive" = true
        WHERE ui.id = $1
      `;

      const userResult = await client.query(userQuery, [user_id]);

      if (userResult.rows.length === 0) {
        return NextResponse.json(
          { success: false, error: "User not found" },
          { status: 404 }
        );
      }

      const userData = userResult.rows[0];

      // Get messages with pagination from mobile Messages table
      const messagesQuery = `
        SELECT
          m.message_id,
          m.content,
          m.sender,
          m.created_at,
          m.bucket_index,
          m.attachments
        FROM "Messages" m
        WHERE m.user_id = $1
        ORDER BY m.created_at ASC
        LIMIT $2 OFFSET $3
      `;

      const messagesResult = await client.query(messagesQuery, [
        user_id,
        limit,
        offset,
      ]);

      // Get total message count
      const countQuery = `
        SELECT
          COUNT(*) as total_messages,
          COUNT(CASE WHEN sender != 'assistant' THEN 1 END) as user_messages,
          COUNT(CASE WHEN sender = 'assistant' THEN 1 END) as bot_messages,
          MIN(created_at) as first_message,
          MAX(created_at) as last_message
        FROM "Messages"
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
          FROM "Messages"
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

      // Get all pets for this user
      const petsQuery = `
        SELECT
          id,
          "petName",
          "petType",
          breed,
          age,
          "petGender",
          weight,
          neutered,
          "petDOB",
          "isActive",
          "createdAt"
        FROM "Pets"
        WHERE user_id = $1
        ORDER BY "isActive" DESC, "createdAt" DESC
      `;

      const petsResult = await client.query(petsQuery, [user_id]);

      // Format messages
      const messages = messagesResult.rows.map((row) => ({
        message_id: row.message_id,
        content: row.content,
        sender: row.sender,
        timestamp: row.created_at?.toISOString(),
        is_user: row.sender !== "assistant",
        bucket_index: row.bucket_index,
        attachments: row.attachments,
      }));

      // Calculate conversation duration
      const firstMessage = messageStats.first_message
        ? new Date(messageStats.first_message)
        : null;
      const lastMessage = messageStats.last_message
        ? new Date(messageStats.last_message)
        : null;
      const conversationDuration =
        firstMessage && lastMessage
          ? Math.round(
              (lastMessage.getTime() - firstMessage.getTime()) / (1000 * 60)
            )
          : 0;

      // Format user profile
      // (onboarding_complete mirrors `onboarded` so the conversation-detail UI,
      //  which reads onboarding_complete, renders the correct badge.)
      const userProfile = {
        id: userData.id,
        name: userData.parentName,
        phone: userData.parentPhone,
        email: userData.parentEmail,
        created_at: userData.createdAt?.toISOString(),
        onboarded: userData.onboarded,
        onboarding_complete: userData.onboarded,
        details_collected: userData.detailsCollected,
        referral_code: userData.referralCode,
        user_image: userData.userImage,
      };

      // Format active pet information
      const activePet = userData.petName
        ? {
            name: userData.petName,
            type: userData.petType,
            breed: userData.breed,
            age: userData.pet_age,
            gender: userData.petGender,
            weight: userData.weight,
            neutered: userData.neutered,
            date_of_birth: userData.petDOB,
            pet_created: userData.pet_created?.toISOString(),
          }
        : null;

      // Format all pets
      const allPets = petsResult.rows.map((pet) => ({
        id: pet.id,
        name: pet.petName,
        type: pet.petType,
        breed: pet.breed,
        age: pet.age,
        gender: pet.petGender,
        weight: pet.weight,
        neutered: pet.neutered,
        date_of_birth: pet.petDOB,
        is_active: pet.isActive,
        created_at: pet.createdAt?.toISOString(),
      }));

      // Format conversation analytics
      const conversationAnalytics = {
        total_messages: parseInt(messageStats.total_messages) || 0,
        user_messages: parseInt(messageStats.user_messages) || 0,
        bot_messages: parseInt(messageStats.bot_messages) || 0,
        first_message: messageStats.first_message?.toISOString(),
        last_message: messageStats.last_message?.toISOString(),
        conversation_duration_minutes: conversationDuration,
        avg_response_time_seconds: Math.round(
          parseFloat(analytics.avg_response_time_seconds) || 0
        ),
        messages_per_day:
          conversationDuration > 0
            ? Math.round(
                (parseInt(messageStats.total_messages) /
                  (conversationDuration / (24 * 60))) *
                  100
              ) / 100
            : 0,
      };

      return NextResponse.json({
        success: true,
        data: {
          user_profile: userProfile,
          pet_info: activePet,
          all_pets: allPets,
          messages,
          conversation_analytics: conversationAnalytics,
          pagination: {
            total: parseInt(messageStats.total_messages) || 0,
            offset,
            limit,
            has_more:
              offset + messages.length <
              (parseInt(messageStats.total_messages) || 0),
          },
          source: "mobile_app",
        },
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Mobile Messages API error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch mobile messages",
        details:
          process.env.NODE_ENV === "development"
            ? (error as Error).message
            : undefined,
      },
      { status: 500 }
    );
  }
}
