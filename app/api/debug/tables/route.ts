import { NextResponse } from "next/server"
import { Pool } from "pg"

// Database connection
const pool = new Pool({
  connectionString: 'postgresql://postgres:rBoBOJUTHhsXTHylCOvlnSsfJRxvrBgS@tramway.proxy.rlwy.net:26530/railway',
  ssl: { rejectUnauthorized: false }
})

export async function GET() {
  try {
    const client = await pool.connect()
    
    try {
      // Check what tables exist in the database
      const result = await client.query(`
        SELECT table_name, table_schema
        FROM information_schema.tables 
        WHERE table_schema = 'public'
        ORDER BY table_name
      `)
      
      return NextResponse.json({
        success: true,
        tables: result.rows
      })
      
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('Error checking tables:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch tables',
      details: (error as Error).message
    }, { status: 500 })
  }
}