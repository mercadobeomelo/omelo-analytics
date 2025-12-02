"use client"

import { useState, useEffect } from "react"
import {
  Heart,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Calendar,
  User,
  Phone,
  CreditCard,
  FileText,
  Search,
  Filter,
  ChevronRight,
  ChevronLeft,
  TrendingUp,
  Users,
  DollarSign,
  Activity
} from "lucide-react"

// Types
interface Consultation {
  id: number
  user_id: string
  issue_category: string
  issue_description: string
  preferred_time_slot: string
  urgency: 'low' | 'medium' | 'high'
  status: 'pending' | 'payment_pending' | 'paid' | 'approved' | 'rejected' | 'completed' | 'cancelled'
  amount: string
  appointment_date?: string
  vet_notes?: string
  created_at: string
  updated_at: string
  user_name?: string
  phone_number?: string
  pet_name?: string
  pet_type?: string
  pet_breed?: string
  pet_age?: number
}

interface ConsultationStats {
  overview: {
    total_consultations: number
    payment_pending: number
    pending_approval: number
    approved: number
    rejected: number
    completed: number
    today_bookings: number
    week_bookings: number
    month_bookings: number
    avg_consultation_amount: number
    total_revenue: number
  }
  trends: Array<{
    date: string
    bookings: number
    approved: number
    completed: number
    revenue: number
  }>
  categories: Array<{
    category: string
    count: number
    percentage: number
  }>
  urgency: Array<{
    level: string
    count: number
    avg_response_hours: number
  }>
}

export default function ConsultationsPage() {
  const [consultations, setConsultations] = useState<Consultation[]>([])
  const [stats, setStats] = useState<ConsultationStats | null>(null)
  const [selectedConsultation, setSelectedConsultation] = useState<Consultation | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [currentPage, setCurrentPage] = useState(1)
  const [totalConsultations, setTotalConsultations] = useState(0)
  const [showingAction, setShowingAction] = useState<string | null>(null)

  // Form states for actions
  const [vetNotes, setVetNotes] = useState("")
  const [appointmentDate, setAppointmentDate] = useState("")

  const itemsPerPage = 20

  // Fetch consultations
  const fetchConsultations = async () => {
    try {
      const params = new URLSearchParams({
        status: statusFilter,
        limit: itemsPerPage.toString(),
        offset: ((currentPage - 1) * itemsPerPage).toString()
      })
      
      const response = await fetch(`/api/dashboard/consultations?${params}`)
      const data = await response.json()
      
      if (data.success) {
        setConsultations(data.data.consultations)
        setTotalConsultations(data.data.pagination.total)
      }
    } catch (error) {
      console.error('Error fetching consultations:', error)
    }
  }

  // Fetch stats
  const fetchStats = async () => {
    try {
      const response = await fetch('/api/dashboard/consultations/stats')
      const data = await response.json()
      
      if (data.success) {
        setStats(data.data)
      }
    } catch (error) {
      console.error('Error fetching stats:', error)
    }
  }

  // Initial load
  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      await Promise.all([fetchConsultations(), fetchStats()])
      setLoading(false)
    }
    loadData()
  }, [currentPage, statusFilter])

  // Handle consultation action
  const handleAction = async (action: string) => {
    if (!selectedConsultation) return

    try {
      const response = await fetch(`/api/dashboard/consultations/${selectedConsultation.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          vetNotes,
          appointmentDate: appointmentDate || null,
          vetName: vetName || null,
          vetContact: vetContact || null
        })
      })

      const data = await response.json()
      
      if (data.success) {
        // Refresh data
        await Promise.all([fetchConsultations(), fetchStats()])
        setShowingAction(null)
        setVetNotes("")
        setAppointmentDate("")
        
        // Update selected consultation
        const updatedConsultation = consultations.find(c => c.id === selectedConsultation.id)
        if (updatedConsultation) {
          setSelectedConsultation({ ...updatedConsultation, ...data.data })
        }
      }
    } catch (error) {
      console.error('Error updating consultation:', error)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'payment_pending': return 'text-yellow-600 bg-yellow-50'
      case 'pending': return 'text-blue-600 bg-blue-50'
      case 'approved': return 'text-green-600 bg-green-50'
      case 'rejected': return 'text-red-600 bg-red-50'
      case 'completed': return 'text-purple-600 bg-purple-50'
      default: return 'text-gray-600 bg-gray-50'
    }
  }

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'urgent': return 'text-red-600 bg-red-50'
      case 'medium': return 'text-yellow-600 bg-yellow-50'
      case 'low': return 'text-green-600 bg-green-50'
      default: return 'text-gray-600 bg-gray-50'
    }
  }

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleString()
  }

  const filteredConsultations = consultations.filter(consultation =>
    consultation.user_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    consultation.phone_number?.includes(searchQuery) ||
    consultation.issue_category?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    consultation.pet_name?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Activity className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Loading consultations...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Vet Consultations</h1>
            <p className="text-gray-500">Manage consultation bookings and approvals</p>
          </div>
        </div>
      </div>

      {/* Stats Overview */}
      {stats && (
        <div className="px-6 py-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {/* Total Consultations */}
            <div className="bg-white p-5 rounded-lg border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Consultations</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.overview.total_consultations}</p>
                  <p className="text-sm text-gray-500">+{stats.overview.today_bookings} today</p>
                </div>
                <Heart className="w-8 h-8 text-blue-600" />
              </div>
            </div>

            {/* Pending Approval */}
            <div className="bg-white p-5 rounded-lg border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Pending Approval</p>
                  <p className="text-2xl font-bold text-orange-600">{stats.overview.pending_approval}</p>
                  <p className="text-sm text-gray-500">Needs attention</p>
                </div>
                <Clock className="w-8 h-8 text-orange-600" />
              </div>
            </div>

            {/* Completed */}
            <div className="bg-white p-5 rounded-lg border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Completed</p>
                  <p className="text-2xl font-bold text-green-600">{stats.overview.completed}</p>
                  <p className="text-sm text-gray-500">This month: {stats.overview.month_bookings}</p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
            </div>

            {/* Revenue */}
            <div className="bg-white p-5 rounded-lg border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Revenue</p>
                  <p className="text-2xl font-bold text-purple-600">₹{stats.overview.total_revenue.toLocaleString()}</p>
                  <p className="text-sm text-gray-500">Avg: ₹{stats.overview.avg_consultation_amount}</p>
                </div>
                <DollarSign className="w-8 h-8 text-purple-600" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="px-6 pb-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Consultations List */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Consultation Requests</h2>
                <span className="text-sm text-gray-500">{filteredConsultations.length} consultations</span>
              </div>

              {/* Search and Filters */}
              <div className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search consultations..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <select
                  value={statusFilter}
                  onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Status</option>
                  <option value="payment_pending">Payment Pending</option>
                  <option value="pending">Pending Approval</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
            </div>

            {/* Consultation List */}
            <div className="max-h-96 overflow-y-auto">
              {filteredConsultations.map((consultation) => (
                <div
                  key={consultation.id}
                  onClick={() => setSelectedConsultation(consultation)}
                  className={`p-4 border-b border-gray-50 cursor-pointer hover:bg-gray-50 transition-colors ${
                    selectedConsultation?.id === consultation.id ? "bg-blue-50 border-blue-200" : ""
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium text-gray-900">{consultation.user_name || 'Unknown User'}</h3>
                        <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(consultation.status)}`}>
                          {consultation.status.replace('_', ' ')}
                        </span>
                        <span className={`px-2 py-1 text-xs rounded-full ${getUrgencyColor(consultation.urgency)}`}>
                          {consultation.urgency}
                        </span>
                      </div>

                      <div className="flex items-center gap-4 text-sm text-gray-500 mb-2">
                        <div className="flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          <span>{consultation.phone_number}</span>
                        </div>
                        {consultation.pet_name && (
                          <div className="flex items-center gap-1">
                            <Heart className="w-3 h-3" />
                            <span>{consultation.pet_name} ({consultation.pet_type})</span>
                          </div>
                        )}
                      </div>

                      <p className="text-sm text-gray-600 mb-2">
                        <strong>{consultation.issue_category}:</strong> {consultation.issue_description}
                      </p>

                      <div className="flex items-center justify-between text-xs text-gray-400">
                        <span>{formatTime(consultation.created_at)}</span>
                        <span>₹{consultation.amount}</span>
                      </div>
                    </div>

                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalConsultations > itemsPerPage && (
              <div className="p-4 border-t border-gray-100 flex items-center justify-between">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 border border-gray-200 rounded disabled:opacity-50"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-sm text-gray-600">
                  Page {currentPage} of {Math.ceil(totalConsultations / itemsPerPage)}
                </span>
                <button
                  onClick={() => setCurrentPage(currentPage + 1)}
                  disabled={currentPage * itemsPerPage >= totalConsultations}
                  className="px-3 py-1 border border-gray-200 rounded disabled:opacity-50"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>

          {/* Selected Consultation Details */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            {selectedConsultation ? (
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">Consultation Details</h2>
                    <p className="text-sm text-gray-500">ID: {selectedConsultation.id}</p>
                  </div>
                  <span className={`px-3 py-1 text-sm rounded-full ${getStatusColor(selectedConsultation.status)}`}>
                    {selectedConsultation.status.replace('_', ' ')}
                  </span>
                </div>

                {/* User & Pet Info */}
                <div className="space-y-4 mb-6">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h3 className="font-medium text-gray-900 mb-2">Patient Information</h3>
                    <div className="space-y-1 text-sm">
                      <p><strong>Owner:</strong> {selectedConsultation.user_name}</p>
                      <p><strong>Phone:</strong> {selectedConsultation.phone_number}</p>
                      {selectedConsultation.pet_name && (
                        <>
                          <p><strong>Pet Name:</strong> {selectedConsultation.pet_name}</p>
                          <p><strong>Type:</strong> {selectedConsultation.pet_type}</p>
                          {selectedConsultation.pet_breed && <p><strong>Breed:</strong> {selectedConsultation.pet_breed}</p>}
                          {selectedConsultation.pet_age && <p><strong>Age:</strong> {selectedConsultation.pet_age}</p>}
                        </>
                      )}
                    </div>
                  </div>

                  <div className="bg-blue-50 p-4 rounded-lg">
                    <h3 className="font-medium text-blue-900 mb-2">Issue Details</h3>
                    <div className="space-y-1 text-sm">
                      <p><strong>Category:</strong> {selectedConsultation.issue_category}</p>
                      <p><strong>Description:</strong> {selectedConsultation.issue_description}</p>
                      <p><strong>Urgency:</strong> <span className={`px-2 py-1 text-xs rounded ${getUrgencyColor(selectedConsultation.urgency)}`}>{selectedConsultation.urgency}</span></p>
                      <p><strong>Preferred Time:</strong> {selectedConsultation.preferred_time_slot}</p>
                      <p><strong>Amount:</strong> ₹{selectedConsultation.amount}</p>
                    </div>
                  </div>

                  {selectedConsultation.vet_notes && (
                    <div className="bg-green-50 p-4 rounded-lg">
                      <h3 className="font-medium text-green-900 mb-2">Vet Notes</h3>
                      <p className="text-sm">{selectedConsultation.vet_notes}</p>
                    </div>
                  )}

                  {selectedConsultation.appointment_date && (
                    <div className="bg-purple-50 p-4 rounded-lg">
                      <h3 className="font-medium text-purple-900 mb-2">Appointment Details</h3>
                      <div className="space-y-1 text-sm">
                        <p><strong>Date:</strong> {new Date(selectedConsultation.appointment_date).toLocaleString()}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Actions */}
                {selectedConsultation.status === 'pending' && (
                  <div className="space-y-4">
                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowingAction('approve')}
                        className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                      >
                        <CheckCircle className="w-4 h-4 inline mr-2" />
                        Approve
                      </button>
                      <button
                        onClick={() => setShowingAction('reject')}
                        className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                      >
                        <XCircle className="w-4 h-4 inline mr-2" />
                        Reject
                      </button>
                    </div>

                    {showingAction && (
                      <div className="bg-gray-50 p-4 rounded-lg space-y-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Notes
                          </label>
                          <textarea
                            value={vetNotes}
                            onChange={(e) => setVetNotes(e.target.value)}
                            placeholder="Add notes about the consultation..."
                            className="w-full p-2 border border-gray-300 rounded-md resize-none"
                            rows={3}
                          />
                        </div>

                        {showingAction === 'approve' && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Appointment Date & Time
                            </label>
                            <input
                              type="datetime-local"
                              value={appointmentDate}
                              onChange={(e) => setAppointmentDate(e.target.value)}
                              className="w-full p-2 border border-gray-300 rounded-md"
                            />
                          </div>
                        )}

                        <div className="flex gap-2">
                          <button
                            onClick={() => handleAction(showingAction)}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                          >
                            Confirm {showingAction}
                          </button>
                          <button
                            onClick={() => setShowingAction(null)}
                            className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {selectedConsultation.status === 'approved' && (
                  <button
                    onClick={() => setShowingAction('complete')}
                    className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                  >
                    Mark as Completed
                  </button>
                )}
              </div>
            ) : (
              <div className="p-6 text-center text-gray-500">
                <Heart className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p>Select a consultation to view details</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}