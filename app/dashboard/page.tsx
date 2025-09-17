"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  MessageSquare,
  Users,
  Search,
  RefreshCw,
  Phone,
  Activity,
  Heart,
  ChevronRight,
  Loader2,
  ChevronLeft
} from "lucide-react"

// Types
interface DashboardOverview {
  total_users: number
  active_users_today: number
  active_now: number
  active_last_hour: number
  total_messages: number
  total_messages_all: number
  total_petdetails: number
  messages_today: number
  messages_per_user_today: number
  new_users_today: number
  user_growth_rate: number
  message_growth_rate: number
  onboarding_completion_rate: number
  avg_response_time_ms: number
  total_pets: number
  pets_added_today: number
  total_feedback: number
  satisfaction_rate: number
  feedback_today: number
  peak_hour: number | null
  peak_hour_messages: number
  last_updated: string
}

interface ConversationThread {
  user_id: string
  user_name: string
  user_phone: string
  user_email?: string
  user_created: string
  last_message: string
  last_activity: string
  last_sender: string
  message_count: number
  user_messages: number
  bot_messages: number
  pet_info?: {
    name: string
    type: string
    breed?: string
    age?: number
    gender?: string
  }
  is_recent_activity: boolean
  is_new_today: boolean
  activity_score: number
}

export default function DashboardPage() {
  const router = useRouter()
  const [overview, setOverview] = useState<DashboardOverview | null>(null)
  const [threads, setThreads] = useState<ConversationThread[]>([])
  const [selectedThread, setSelectedThread] = useState<ConversationThread | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [filterBy, setFilterBy] = useState("all")
  const [sortBy, setSortBy] = useState("recent")
  const [currentPage, setCurrentPage] = useState(1)
  const [threadsPerPage, setThreadsPerPage] = useState(50)
  const [totalThreads, setTotalThreads] = useState(0)
  const [hasMoreThreads, setHasMoreThreads] = useState(false)

  // Fetch dashboard overview
  const fetchOverview = async () => {
    try {
      const response = await fetch("/api/dashboard/overview")
      const data = await response.json()
      if (data.success) {
        setOverview(data.data)
      }
    } catch (error) {
      console.error("Failed to fetch overview:", error)
    }
  }

  // Fetch conversation threads
  const fetchThreads = async () => {
    try {
      const offset = (currentPage - 1) * threadsPerPage
      const params = new URLSearchParams({
        limit: threadsPerPage.toString(),
        offset: offset.toString(),
        search: searchQuery,
        filter: filterBy,
        sort: sortBy
      })

      const response = await fetch(`/api/dashboard/threads?${params}`)
      const data = await response.json()
      if (data.success) {
        setThreads(data.data.threads)
        setTotalThreads(data.data.pagination.total)
        setHasMoreThreads(data.data.pagination.has_more)
      }
    } catch (error) {
      console.error("Failed to fetch threads:", error)
    }
  }

  // Initial load
  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      await Promise.all([fetchOverview(), fetchThreads()])
      setLoading(false)
    }
    loadData()
  }, [])

  // Reset to page 1 when search/filter changes
  useEffect(() => {
    if (!loading && (searchQuery || filterBy !== 'all' || sortBy !== 'recent')) {
      if (currentPage !== 1) {
        setCurrentPage(1)
      }
    }
  }, [searchQuery, filterBy, sortBy])

  // Refresh when filters change (with debouncing for search)
  useEffect(() => {
    if (!loading) {
      const timeoutId = setTimeout(() => {
        fetchThreads()
      }, searchQuery ? 300 : 0) // Debounce search by 300ms

      return () => clearTimeout(timeoutId)
    }
  }, [searchQuery, filterBy, sortBy, currentPage, threadsPerPage])

  // Auto-refresh overview every 30 seconds (reduced from 10s)
  useEffect(() => {
    const interval = setInterval(() => {
      fetchOverview()
    }, 30000)
    return () => clearInterval(interval)
  }, [])

  // Manual refresh
  const handleRefresh = async () => {
    setRefreshing(true)
    await Promise.all([fetchOverview(), fetchThreads()])
    setRefreshing(false)
  }

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + "M"
    if (num >= 1000) return (num / 1000).toFixed(1) + "K"
    return num.toString()
  }

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMins < 1) return "Just now"
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  const getGrowthColor = (rate: number) => {
    if (rate > 0) return "text-green-600"
    if (rate < 0) return "text-red-600"
    return "text-gray-500"
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Loading dashboard...</p>
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
            <h1 className="text-2xl font-bold text-gray-900">WhatsApp Analytics Dashboard</h1>
            <p className="text-gray-500">Real-time conversation insights and user analytics</p>
          </div>
          {/* <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </button> */}
        </div>
      </div>

      {/* Overview Metrics */}
      {overview && (
        <div className="px-6 py-6">


          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {/* Total Messages Ever */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Messages Ever</p>
                  <p className="text-3xl font-bold text-gray-900">{formatNumber(overview.total_messages)}</p>
                  <p className="text-sm text-gray-500">All time</p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <MessageSquare className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </div>
            {/* Total Users */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Users</p>
                  <p className="text-3xl font-bold text-gray-900">{formatNumber(overview.total_users)}</p>
                  <p className="text-sm text-gray-500">+{overview.new_users_today} today</p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Users className="w-6 h-6 text-blue-600" />
                </div>
              </div>
              {overview.user_growth_rate !== 0 && (
                <div className="mt-2">
                  <span className={`text-sm font-medium ${getGrowthColor(overview.user_growth_rate)}`}>
                    {overview.user_growth_rate > 0 ? "+" : ""}{overview.user_growth_rate}% vs yesterday
                  </span>
                </div>
              )}
            </div>

            {/* Active Users */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Active Today</p>
                  <p className="text-3xl font-bold text-gray-900">{formatNumber(overview.active_users_today)}</p>
                  <p className="text-sm text-gray-500">{overview.active_now} active now</p>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <Activity className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </div>

            {/* Messages Today */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Messages Today</p>
                  <p className="text-3xl font-bold text-gray-900">{formatNumber(overview.messages_today)}</p>
                  <p className="text-sm text-gray-500">{overview.messages_per_user_today} per user</p>
                </div>
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <MessageSquare className="w-6 h-6 text-purple-600" />
                </div>
              </div>
              {overview.message_growth_rate !== 0 && (
                <div className="mt-2">
                  <span className={`text-sm font-medium ${getGrowthColor(overview.message_growth_rate)}`}>
                    {overview.message_growth_rate > 0 ? "+" : ""}{overview.message_growth_rate}% vs yesterday
                  </span>
                </div>
              )}
            </div>

          </div>

          {/* Secondary Metrics */}
          {/* <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-600">Avg Response Time</p>
                  <p className="font-semibold">{Math.round(overview.avg_response_time_ms / 1000)}s</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
              <div className="flex items-center gap-3">
                <TrendingUp className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-600">Onboarding Rate</p>
                  <p className="font-semibold">{overview.onboarding_completion_rate}%</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
              <div className="flex items-center gap-3">
                <Heart className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-600">Total Pets</p>
                  <p className="font-semibold">{formatNumber(overview.total_pets)}</p>
                </div>
              </div>
            </div>
          </div> */}
        </div>
      )}

      {/* Main Content */}
      <div className="px-6 pb-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Conversation Threads */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Recent Conversations</h2>
                <div className="flex items-center space-x-4">
                  <select
                    value={threadsPerPage}
                    onChange={(e) => { setThreadsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                    className="text-sm border border-gray-200 rounded px-2 py-1"
                  >
                    <option value={25}>25 per page</option>
                    <option value={50}>50 per page</option>
                    <option value={100}>100 per page</option>
                    <option value={200}>200 per page</option>
                  </select>
                  <span className="text-sm text-gray-500">
                    {threads.length} of {totalThreads} conversations
                    {searchQuery && <span className="text-blue-600 ml-2">(filtered by "{searchQuery}")</span>}
                  </span>
                </div>
              </div>

              {/* Search and Filters */}
              <div className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search by name, phone, email, message, or pet name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-10 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <span className="text-lg">×</span>
                    </button>
                  )}
                </div>

                <div className="flex gap-2">
                  <select
                    value={filterBy}
                    onChange={(e) => setFilterBy(e.target.value)}
                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">All Users</option>
                    <option value="active">Active Today</option>
                    <option value="new_today">New Today</option>
                    <option value="with_pets">With Pets</option>
                    <option value="high_activity">High Activity</option>
                  </select>

                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="recent">Recent Activity</option>
                    <option value="messages">Message Count</option>
                    <option value="alphabetical">Alphabetical</option>
                    <option value="created">Registration Date</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Thread List */}
            <div className="max-h-96 overflow-y-auto">
              {threads.map((thread) => (
                <div
                  key={thread.user_id}
                  onClick={() => setSelectedThread(thread)}
                  className={`p-4 border-b border-gray-50 cursor-pointer hover:bg-gray-50 transition-colors ${selectedThread?.user_id === thread.user_id ? "bg-blue-50 border-blue-200" : ""
                    }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium text-gray-900">{thread.user_name}</h3>
                        {thread.is_new_today && (
                          <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">New</span>
                        )}
                        {thread.is_recent_activity && (
                          <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">Active</span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
                        <Phone className="w-3 h-3" />
                        <span>{thread.user_phone}</span>
                        {thread.pet_info && (
                          <>
                            <span>•</span>
                            <Heart className="w-3 h-3" />
                            <span>{thread.pet_info.name} ({thread.pet_info.type})</span>
                          </>
                        )}
                      </div>

                      <p className="text-sm text-gray-600 mb-2">{thread.last_message}</p>

                      <div className="flex items-center justify-between text-xs text-gray-400">
                        <span>{formatTime(thread.last_activity)}</span>
                        <span>{thread.message_count} messages</span>
                      </div>
                    </div>

                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalThreads > threadsPerPage && (
              <div className="p-4 border-t border-gray-100 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1 border border-gray-200 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="text-sm text-gray-600">
                    Page {currentPage} of {Math.ceil(totalThreads / threadsPerPage)}
                  </span>
                  <button
                    onClick={() => setCurrentPage(currentPage + 1)}
                    disabled={!hasMoreThreads}
                    className="px-3 py-1 border border-gray-200 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
                <div className="text-sm text-gray-500">
                  Showing {(currentPage - 1) * threadsPerPage + 1} - {Math.min(currentPage * threadsPerPage, totalThreads)} of {totalThreads}
                </div>
              </div>
            )}
          </div>

          {/* Selected Conversation Preview */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            {selectedThread ? (
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">{selectedThread.user_name}</h2>
                    <p className="text-sm text-gray-500">{selectedThread.user_phone}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500">Last active</p>
                    <p className="text-sm font-medium">{formatTime(selectedThread.last_activity)}</p>
                  </div>
                </div>

                {/* User Stats */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <p className="text-sm text-gray-600">Total Messages</p>
                    <p className="text-xl font-semibold">{selectedThread.message_count}</p>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <p className="text-sm text-gray-600">User Messages</p>
                    <p className="text-xl font-semibold">{selectedThread.user_messages}</p>
                  </div>
                </div>

                {/* Pet Info */}
                {selectedThread.pet_info && (
                  <div className="bg-green-50 p-4 rounded-lg mb-6">
                    <h3 className="font-medium text-green-900 mb-2">Pet Information</h3>
                    <div className="space-y-1 text-sm">
                      <p><span className="text-green-700">Name:</span> {selectedThread.pet_info.name}</p>
                      <p><span className="text-green-700">Type:</span> {selectedThread.pet_info.type}</p>
                      {selectedThread.pet_info.breed && (
                        <p><span className="text-green-700">Breed:</span> {selectedThread.pet_info.breed}</p>
                      )}
                      {selectedThread.pet_info.age && (
                        <p><span className="text-green-700">Age:</span> {selectedThread.pet_info.age}</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Recent Message */}
                <div className="border-t pt-4">
                  <h3 className="font-medium text-gray-900 mb-2">Latest Message</h3>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <p className="text-sm text-gray-700">{selectedThread.last_message}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {selectedThread.last_sender === "user" ? "User" : "Bot"} • {formatTime(selectedThread.last_activity)}
                    </p>
                  </div>
                </div>

                {/* Action Button */}
                <button
                  onClick={() => router.push(`/dashboard/conversation/${selectedThread.user_id}`)}
                  className="w-full cursor-pointer mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  View Full Conversation
                </button>
              </div>
            ) : (
              <div className="p-6 text-center text-gray-500">
                <MessageSquare className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p>Select a conversation to view details</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}