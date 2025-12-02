import { NextRequest, NextResponse } from "next/server"
import { backendPool } from "../../../../../lib/database"

// GET single consultation
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const consultationId = id
    
    const query = `
      SELECT 
        c.*,
        u."parentName" as user_name,
        u."parentPhone" as phone_number,
        u."petName" as pet_name,
        u."petType" as pet_type,
        u.breed as pet_breed,
        u.age as pet_age,
        u."parentEmail" as email
      FROM consultations c
      LEFT JOIN "UserInfo" u ON c.user_id = u.id
      WHERE c.id = $1
    `
    
    const result = await backendPool.query(query, [consultationId])
    
    if (result.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Consultation not found'
      }, { status: 404 })
    }
    
    return NextResponse.json({
      success: true,
      data: result.rows[0]
    })
    
  } catch (error) {
    console.error('Error fetching consultation:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch consultation'
    }, { status: 500 })
  }
}

// POST update consultation (approve/reject/assign vet)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const consultationId = id
    const body = await request.json()
    const { action, vetNotes, appointmentDate, vetName, vetContact } = body
    
    let updateQuery = ''
    let updateParams: any[] = []
    
    switch (action) {
      case 'approve':
        updateQuery = `
          UPDATE consultations 
          SET status = 'approved', 
              vet_notes = $2,
              appointment_date = $3,
              updated_at = NOW()
          WHERE id = $1
          RETURNING *
        `
        updateParams = [consultationId, vetNotes, appointmentDate]
        break
        
      case 'reject':
        updateQuery = `
          UPDATE consultations 
          SET status = 'rejected',
              vet_notes = $2,
              updated_at = NOW()
          WHERE id = $1
          RETURNING *
        `
        updateParams = [consultationId, vetNotes]
        break
        
      case 'complete':
        updateQuery = `
          UPDATE consultations 
          SET status = 'completed',
              vet_notes = $2,
              updated_at = NOW()
          WHERE id = $1
          RETURNING *
        `
        updateParams = [consultationId, vetNotes]
        break
        
      case 'update_notes':
        updateQuery = `
          UPDATE consultations 
          SET vet_notes = $2,
              updated_at = NOW()
          WHERE id = $1
          RETURNING *
        `
        updateParams = [consultationId, vetNotes]
        break
        
      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action'
        }, { status: 400 })
    }
    
    const result = await backendPool.query(updateQuery, updateParams)
    
    return NextResponse.json({
      success: true,
      data: result.rows[0],
      message: `Consultation ${action} successfully`
    })
    
  } catch (error) {
    console.error('Error updating consultation:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to update consultation'
    }, { status: 500 })
  }
}