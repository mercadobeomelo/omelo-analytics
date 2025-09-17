import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: 'postgresql://postgres:rBoBOJUTHhsXTHylCOvlnSsfJRxvrBgS@tramway.proxy.rlwy.net:26530/railway',
  ssl: { rejectUnauthorized: false }
});

export async function GET() {
  try {
    const client = await pool.connect();
    
    try {
      const query = `
        SELECT 
          id,
          user_phone,
          feedback_type,
          feedback_content,
          created_at
        FROM user_feedback 
        WHERE feedback_type = 'user_feedback'
        ORDER BY created_at DESC
      `;
      
      const result = await client.query(query);
      
      const feedbacks = result.rows.map(row => ({
        id: row.id.toString(),
        phone: row.user_phone,
        type: row.feedback_type,
        content: row.feedback_content,
        createdAt: row.created_at
      }));
      
      return NextResponse.json({ 
        success: true, 
        data: feedbacks,
        total: feedbacks.length 
      });
      
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch feedbacks',
        details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      },
      { status: 500 }
    );
  }
}