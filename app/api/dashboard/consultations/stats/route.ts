import { NextResponse } from "next/server"
import { backendPool } from "../../../../../lib/database"

export async function GET() {
  try {
    // Get consultation stats
    const statsQuery = `
      SELECT 
        COUNT(*) as total_consultations,
        COUNT(*) FILTER (WHERE status = 'payment_pending') as payment_pending,
        COUNT(*) FILTER (WHERE status = 'pending') as pending_approval,
        COUNT(*) FILTER (WHERE status = 'approved') as approved,
        COUNT(*) FILTER (WHERE status = 'rejected') as rejected,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE) as today_bookings,
        COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '7 days') as week_bookings,
        COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '30 days') as month_bookings,
        AVG(amount::numeric) as avg_consultation_amount,
        SUM(amount::numeric) FILTER (WHERE status IN ('approved', 'completed')) as total_revenue
      FROM consultations
    `
    
    const result = await backendPool.query(statsQuery)
    const stats = result.rows[0]
    
    // Get daily consultation trends (last 30 days)
    const trendsQuery = `
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as bookings,
        COUNT(*) FILTER (WHERE status = 'approved') as approved,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        SUM(amount::numeric) as revenue
      FROM consultations
      WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `
    
    const trendsResult = await backendPool.query(trendsQuery)
    
    // Get issue category distribution
    const categoryQuery = `
      SELECT 
        issue_category,
        COUNT(*) as count,
        COUNT(*) * 100.0 / SUM(COUNT(*)) OVER () as percentage
      FROM consultations
      WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY issue_category
      ORDER BY count DESC
    `
    
    const categoryResult = await backendPool.query(categoryQuery)
    
    // Get urgency distribution
    const urgencyQuery = `
      SELECT 
        urgency,
        COUNT(*) as count,
        AVG(CASE 
          WHEN status = 'approved' AND appointment_date IS NOT NULL 
          THEN EXTRACT(EPOCH FROM (appointment_date - created_at))/3600 
          ELSE NULL 
        END) as avg_response_hours
      FROM consultations
      WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY urgency
      ORDER BY 
        CASE urgency 
          WHEN 'high' THEN 1
          WHEN 'medium' THEN 2 
          WHEN 'low' THEN 3
        END
    `
    
    const urgencyResult = await backendPool.query(urgencyQuery)
    
    return NextResponse.json({
      success: true,
      data: {
        overview: {
          total_consultations: parseInt(stats.total_consultations),
          payment_pending: parseInt(stats.payment_pending),
          pending_approval: parseInt(stats.pending_approval),
          approved: parseInt(stats.approved),
          rejected: parseInt(stats.rejected),
          completed: parseInt(stats.completed),
          today_bookings: parseInt(stats.today_bookings),
          week_bookings: parseInt(stats.week_bookings),
          month_bookings: parseInt(stats.month_bookings),
          avg_consultation_amount: parseFloat(stats.avg_consultation_amount || 0),
          total_revenue: parseFloat(stats.total_revenue || 0)
        },
        trends: trendsResult.rows.map(row => ({
          date: row.date,
          bookings: parseInt(row.bookings),
          approved: parseInt(row.approved),
          completed: parseInt(row.completed),
          revenue: parseFloat(row.revenue || 0)
        })),
        categories: categoryResult.rows.map(row => ({
          category: row.issueCategory,
          count: parseInt(row.count),
          percentage: parseFloat(row.percentage)
        })),
        urgency: urgencyResult.rows.map(row => ({
          level: row.urgency,
          count: parseInt(row.count),
          avg_response_hours: parseFloat(row.avg_response_hours || 0)
        }))
      }
    })
    
  } catch (error) {
    console.error('Error fetching consultation stats:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch consultation statistics'
    }, { status: 500 })
  }
}