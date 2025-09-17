"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { 
  ArrowLeft,
  User,
  Phone,
  Mail,
  Calendar,
  MessageSquare,
  Activity,
  Heart,
  Download,
  Search,
  Filter,
  Loader2,
  PawPrint
} from "lucide-react"

// Types
interface UserProfile {
  id: string
  name: string
  phone: string
  email?: string
  created_at: string
  last_user_msg?: string
  onboarding_complete: boolean
  has_seen_welcome: boolean
  location?: string
  referral_code?: string
  invites_left: number
}

interface PetInfo {
  name: string
  type: string
  breed?: string
  age?: number
  gender?: string
  weight?: number
  neutered?: boolean
  date_of_birth?: string
  pet_created?: string
}

interface Message {
  message_id: string
  content: string
  sender: string
  timestamp: string
  is_user: boolean
  bucket_index?: number
}

interface ConversationAnalytics {
  total_messages: number
  user_messages: number
  bot_messages: number
  first_message?: string
  last_message?: string
  conversation_duration_minutes: number
  avg_response_time_seconds: number
  messages_per_day: number
}

interface UserFeedback {
  content: string
  rating: number
  type?: string
  created_at: string
}

interface ConversationData {
  user_profile: UserProfile
  pet_info: PetInfo | null
  messages: Message[]
  conversation_analytics: ConversationAnalytics
  user_feedback: UserFeedback[]
  pagination: {
    total: number
    offset: number
    limit: number
    has_more: boolean
  }
}

export default function ConversationPage() {
  const params = useParams()
  const router = useRouter()
  const user_id = params.user_id as string

  const [conversationData, setConversationData] = useState<ConversationData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [loadingMore, setLoadingMore] = useState(false)

  useEffect(() => {
    fetchConversationData()
  }, [user_id])

  const fetchConversationData = async (offset = 0, limit = 100) => {
    try {
      const response = await fetch(`/api/dashboard/messages/${user_id}?offset=${offset}&limit=${limit}`)
      const result = await response.json()
      
      if (result.success) {
        if (offset === 0) {
          setConversationData(result.data)
        } else {
          setConversationData(prev => prev ? {
            ...prev,
            messages: [...prev.messages, ...result.data.messages],
            pagination: result.data.pagination
          } : result.data)
        }
      } else {
        setError(result.error)
      }
    } catch (err) {
      setError('Failed to fetch conversation data')
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }

  const loadMoreMessages = () => {
    if (!conversationData || !conversationData.pagination.has_more || loadingMore) return
    
    setLoadingMore(true)
    fetchConversationData(
      conversationData.pagination.offset + conversationData.pagination.limit,
      conversationData.pagination.limit
    )
  }

  const exportConversation = () => {
    if (!conversationData) return
    
    const exportData = {
      user_profile: conversationData.user_profile,
      pet_info: conversationData.pet_info,
      messages: conversationData.messages,
      analytics: conversationData.conversation_analytics,
      feedback: conversationData.user_feedback,
      exported_at: new Date().toISOString()
    }
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `conversation_${conversationData.user_profile.name || 'user'}_${user_id}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const filteredMessages = conversationData?.messages.filter(message =>
    message.content.toLowerCase().includes(searchTerm.toLowerCase())
  ) || []

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={() => router.back()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Go Back
          </button>
        </div>
      </div>
    )
  }

  if (!conversationData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>No conversation data found</p>
      </div>
    )
  }

  const { user_profile, pet_info, conversation_analytics, user_feedback } = conversationData

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => router.back()}
              className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
            >
              <ArrowLeft className="h-6 w-6" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Conversation with {user_profile.name || user_profile.phone}
              </h1>
              <p className="text-gray-600">User ID: {user_profile.id}</p>
            </div>
          </div>
          <button
            onClick={exportConversation}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Download className="h-4 w-4" />
            <span>Export</span>
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* User Profile & Analytics */}
          <div className="lg:col-span-1 space-y-6">
            {/* User Profile */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center">
                <User className="h-5 w-5 mr-2" />
                User Profile
              </h2>
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <User className="h-4 w-4 text-gray-500" />
                  <span className="text-gray-900">{user_profile.name || 'Unknown'}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Phone className="h-4 w-4 text-gray-500" />
                  <span className="text-gray-900">{user_profile.phone}</span>
                </div>
                {user_profile.email && (
                  <div className="flex items-center space-x-2">
                    <Mail className="h-4 w-4 text-gray-500" />
                    <span className="text-gray-900">{user_profile.email}</span>
                  </div>
                )}
                <div className="flex items-center space-x-2">
                  <Calendar className="h-4 w-4 text-gray-500" />
                  <span className="text-gray-900">
                    Joined {new Date(user_profile.created_at).toLocaleDateString()}
                  </span>
                </div>
                {user_profile.location && (
                  <div className="text-sm text-gray-600">
                    📍 {user_profile.location}
                  </div>
                )}
                <div className="flex items-center space-x-2">
                  <div className={`w-2 h-2 rounded-full ${user_profile.onboarding_complete ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                  <span className="text-sm text-gray-600">
                    {user_profile.onboarding_complete ? 'Onboarding Complete' : 'Onboarding Incomplete'}
                  </span>
                </div>
              </div>
            </div>

            {/* Pet Information */}
            {pet_info && (
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h2 className="text-lg font-semibold mb-4 flex items-center">
                  <PawPrint className="h-5 w-5 mr-2" />
                  Pet Information
                </h2>
                <div className="space-y-3">
                  <div><strong>Name:</strong> {pet_info.name}</div>
                  <div><strong>Type:</strong> {pet_info.type}</div>
                  {pet_info.breed && <div><strong>Breed:</strong> {pet_info.breed}</div>}
                  {pet_info.age && <div><strong>Age:</strong> {pet_info.age} years</div>}
                  {pet_info.gender && <div><strong>Gender:</strong> {pet_info.gender}</div>}
                  {pet_info.weight && <div><strong>Weight:</strong> {pet_info.weight} kg</div>}
                  {pet_info.neutered !== undefined && (
                    <div><strong>Neutered:</strong> {pet_info.neutered ? 'Yes' : 'No'}</div>
                  )}
                </div>
              </div>
            )}

            {/* Analytics */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center">
                <Activity className="h-5 w-5 mr-2" />
                Analytics
              </h2>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Messages:</span>
                  <span className="font-medium">{conversation_analytics.total_messages}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">User Messages:</span>
                  <span className="font-medium">{conversation_analytics.user_messages}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Bot Messages:</span>
                  <span className="font-medium">{conversation_analytics.bot_messages}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Duration:</span>
                  <span className="font-medium">{conversation_analytics.conversation_duration_minutes} min</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Avg Response:</span>
                  <span className="font-medium">{conversation_analytics.avg_response_time_seconds}s</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Messages/Day:</span>
                  <span className="font-medium">{conversation_analytics.messages_per_day}</span>
                </div>
              </div>
            </div>

            {/* Feedback */}
            {user_feedback.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h2 className="text-lg font-semibold mb-4 flex items-center">
                  <Heart className="h-5 w-5 mr-2" />
                  User Feedback
                </h2>
                <div className="space-y-3">
                  {user_feedback.map((feedback, index) => (
                    <div key={index} className="border-l-4 border-blue-500 pl-4">
                      <div className="flex items-center space-x-2 mb-2">
                        <div className="flex">
                          {[1, 2].map((star) => (
                            <span
                              key={star}
                              className={`text-sm ${star <= feedback.rating ? 'text-yellow-400' : 'text-gray-300'}`}
                            >
                              ★
                            </span>
                          ))}
                        </div>
                        <span className="text-xs text-gray-500">
                          {new Date(feedback.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700">{feedback.content}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Messages */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-sm">
              {/* Messages Header */}
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold flex items-center">
                    <MessageSquare className="h-5 w-5 mr-2" />
                    Messages ({filteredMessages.length})
                  </h2>
                </div>
                
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search messages..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Messages List */}
              <div className="max-h-screen overflow-y-auto">
                {filteredMessages.length === 0 ? (
                  <div className="p-6 text-center text-gray-500">
                    {searchTerm ? 'No messages match your search' : 'No messages found'}
                  </div>
                ) : (
                  <div className="p-6 space-y-4">
                    {filteredMessages.map((message) => (
                      <div
                        key={message.message_id}
                        className={`flex ${message.is_user ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                            message.is_user
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-100 text-gray-900'
                          }`}
                        >
                          <p className="text-sm">{message.content}</p>
                          <p className={`text-xs mt-1 ${
                            message.is_user ? 'text-blue-100' : 'text-gray-500'
                          }`}>
                            {new Date(message.timestamp).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ))}
                    
                    {/* Load More Button */}
                    {conversationData.pagination.has_more && (
                      <div className="text-center pt-4">
                        <button
                          onClick={loadMoreMessages}
                          disabled={loadingMore}
                          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50"
                        >
                          {loadingMore ? (
                            <><Loader2 className="h-4 w-4 animate-spin inline mr-2" />Loading...</>
                          ) : (
                            'Load More Messages'
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}