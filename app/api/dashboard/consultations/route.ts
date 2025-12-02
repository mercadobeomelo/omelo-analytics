import { NextRequest, NextResponse } from "next/server"
import { backendPool } from "../../../../lib/database"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'all'
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')
    
    let statusCondition = ''
    if (status !== 'all') {
      statusCondition = `AND c.status = $3`
    }
    
    const query = `
      SELECT 
        c.*,
        u."parentName" as user_name,
        u."parentPhone" as phone_number,
        u."petName" as pet_name,
        u."petType" as pet_type,
        u.breed as pet_breed,
        u.age as pet_age
      FROM consultations c
      LEFT JOIN "UserInfo" u ON c.user_id = u.id
      WHERE 1=1 ${statusCondition}
      ORDER BY c.created_at DESC
      LIMIT $1 OFFSET $2
    `
    
    const params = status === 'all' 
      ? [limit, offset] 
      : [limit, offset, status]
    
    const result = await backendPool.query(query, params)
    
    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM consultations c
      WHERE 1=1 ${statusCondition}
    `
    const countParams = status === 'all' ? [] : [status]
    const countResult = await backendPool.query(countQuery, countParams)
    
    return NextResponse.json({
      success: true,
      data: {
        consultations: result.rows,
        pagination: {
          total: parseInt(countResult.rows[0].total),
          limit,
          offset,
          has_more: (offset + limit) < parseInt(countResult.rows[0].total)
        }
      }
    })
    
  } catch (error) {
    console.error('Error fetching consultations:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch consultations'
    }, { status: 500 })
  }
}