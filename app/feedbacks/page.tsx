"use client"

import { useState, useEffect } from "react"
import { MessageSquare, Users, Tag, TrendingUp, Filter, SortDesc, Clock, Phone, Eye } from "lucide-react"

interface Feedback {
  id: string
  phone: string
  type: string
  content: string
  createdAt: string
}

interface ApiResponse {
  success: boolean
  data: Feedback[]
  total: number
}

export default function FeedbacksPage() {
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<"newest" | "oldest">("newest")
  const [selectedType, setSelectedType] = useState<string>("all")

  useEffect(() => {
    const fetchFeedbacks = async () => {
      try {
        const response = await fetch("/api/feedbacks")
        const data: ApiResponse = await response.json()

        if (data.success) {
          setFeedbacks(data.data)
        } else {
          setError("Failed to load feedbacks")
        }
      } catch (err) {
        setError("Error fetching feedbacks")
        console.error("Error:", err)
      } finally {
        setLoading(false)
      }
    }

    fetchFeedbacks()
  }, [])

  const filteredAndSortedFeedbacks = feedbacks
    .filter((feedback) => selectedType === "all" || feedback.type === selectedType)
    .sort((a, b) => {
      switch (sortBy) {
        case "newest":
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        case "oldest":
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        default:
          return 0
      }
    })

  const uniqueTypes = ["all", ...Array.from(new Set(feedbacks.map((f) => f.type)))]

  const getCategoryColor = (type: string) => {
    const colors: { [key: string]: string } = {
      natural_conversation: "bg-emerald-50 text-emerald-700 border-emerald-200",
      customer_service: "bg-blue-50 text-blue-700 border-blue-200",
      product_feedback: "bg-purple-50 text-purple-700 border-purple-200",
      bug_report: "bg-red-50 text-red-700 border-red-200",
      feature_request: "bg-amber-50 text-amber-700 border-amber-200",
    }
    return colors[type] || "bg-gray-50 text-gray-700 border-gray-200"
  }

  const formatDate = (timestamp: string) => {
    return new Date(timestamp).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="text-center animate-fade-in-scale">
          <div className="relative w-16 h-16 mx-auto mb-6">
            <div className="absolute inset-0 border-4 border-secondary/20 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-secondary border-t-transparent rounded-full animate-spin"></div>
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">Loading Feedbacks</h3>
          <p className="text-muted-foreground">Fetching the latest customer insights...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="text-center animate-fade-in-scale">
          <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <MessageSquare className="w-8 h-8 text-destructive" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">Unable to Load Feedbacks</h3>
          <p className="text-destructive">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto p-6 space-y-8">
        {/* Header Section */}
        <div className="animate-slide-in-up">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-secondary/10 rounded-lg flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-secondary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground text-balance">Customer Feedbacks</h1>
              <p className="text-black">Monitor and analyze customer insights in real-time</p>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-slide-in-up">
          <div className="bg-card border border-border rounded-xl p-6 hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Total Feedbacks</p>
                <p className="text-3xl font-bold text-foreground">{feedbacks.length.toLocaleString()}</p>
                {/* <p className="text-xs text-emerald-600 font-medium">+12% from last month</p> */}
              </div>
              <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center">
                <MessageSquare className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-6 hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Unique Users</p>
                <p className="text-3xl font-bold text-foreground">
                  {new Set(feedbacks.map((f) => f.phone)).size.toLocaleString()}
                </p>
                {/* <p className="text-xs text-emerald-600 font-medium">+8% from last month</p> */}
              </div>
              <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center">
                <Users className="w-6 h-6 text-emerald-600" />
              </div>
            </div>
          </div>
{/* 
          <div className="bg-card border border-border rounded-xl p-6 hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Categories</p>
                <p className="text-3xl font-bold text-foreground">{uniqueTypes.length - 1}</p>
                <p className="text-xs text-blue-600 font-medium">Active feedback types</p>
              </div>
              <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center">
                <Tag className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </div> */}

          <div className="bg-card border border-border rounded-xl p-6 hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">This Week</p>
                <p className="text-3xl font-bold text-foreground">
                  {feedbacks
                    .filter((f) => {
                      const feedbackDate = new Date(f.createdAt)
                      const weekAgo = new Date()
                      weekAgo.setDate(weekAgo.getDate() - 7)
                      return feedbackDate >= weekAgo
                    })
                    .length.toLocaleString()}
                </p>
                {/* <p className="text-xs text-emerald-600 font-medium">+24% from last week</p> */}
              </div>
              <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-amber-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Filters Section */}
        <div className="  p-6 animate-slide-in-up">
          <div className="flex flex-col lg:flex-row gap-6 items-start lg:items-center justify-between">
            {/* <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Filter className="w-4 h-4" />
                Filter by category:
              </div>
              <div className="flex flex-wrap gap-2">
                {uniqueTypes.map((type) => (
                  <button
                    key={type}
                    onClick={() => setSelectedType(type)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                      selectedType === type
                        ? "bg-secondary text-secondary-foreground shadow-md scale-105"
                        : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground hover:scale-105"
                    }`}
                  >
                    {type === "all"
                      ? "All Categories"
                      : type.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                  </button>
                ))}
              </div>
            </div> */}

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <SortDesc className="w-4 h-4" />
                Sort by:
              </div>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as "newest" | "oldest")}
                className="px-4 py-2 bg-input border border-border rounded-lg text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-all duration-200"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
              </select>
            </div>
          </div>
        </div>

        {/* Feedback Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredAndSortedFeedbacks.map((feedback, index) => (
            <div
              key={feedback.id}
              className="bg-card border border-border rounded-xl p-6 hover:shadow-xl transition-all duration-300 hover:-translate-y-2 group animate-slide-in-up"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-secondary/10 rounded-full flex items-center justify-center">
                    <Phone className="w-4 h-4 text-secondary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">WhatsApp User</h3>
                    <p className="text-sm text-muted-foreground font-mono">{feedback.phone}</p>
                  </div>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-medium border ${getCategoryColor(feedback.type)}`}
                >
                  {feedback.type.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                </span>
              </div>

              <div className="mb-4">
                <p className="text-foreground text-sm leading-relaxed line-clamp-4 text-pretty">{feedback.content}</p>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-border">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  {formatDate(feedback.createdAt)}
                </div>
                {/* <button className="flex items-center gap-2 text-secondary hover:text-secondary/80 text-sm font-medium transition-all duration-200 group-hover:translate-x-1">
                  <Eye className="w-4 h-4" />
                  View Details
                </button> */}
              </div>
            </div>
          ))}
        </div>

        {/* Empty State */}
        {filteredAndSortedFeedbacks.length === 0 && (
          <div className="text-center py-16 animate-fade-in-scale">
            <div className="w-24 h-24 bg-muted/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <MessageSquare className="w-12 h-12 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">No Feedbacks Found</h3>
            <p className="text-muted-foreground max-w-md mx-auto text-pretty">
              {selectedType === "all"
                ? "No customer feedbacks are available at the moment. Check back later for new insights."
                : `No feedbacks found for the selected category. Try adjusting your filters.`}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
