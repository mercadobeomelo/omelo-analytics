"use client"

import { useRouter, usePathname } from "next/navigation"
import { Home, ThumbsUp } from "lucide-react"

export default function GlobalNavigation() {
  const router = useRouter()
  const pathname = usePathname()

  const navItems = [
    {
      id: 'home',
      icon: Home,
      label: 'Dashboard',
      path: '/dashboard',
      color: 'blue'
    },
    {
      id: 'feedbacks',
      icon: ThumbsUp,
      label: 'Feedbacks',
      path: '/feedbacks',
      color: 'emerald'
    }
  ]

  return (
    <div className="fixed top-6 right-6 z-50">
      <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-xl border border-gray-200/50 p-2">
        <div className="flex items-center space-x-1">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.path || 
                           (item.path === '/dashboard' && pathname.startsWith('/dashboard'))
            
            const buttonStyles = isActive
              ? item.color === 'blue'
                ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/25'
                : 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25'
              : item.color === 'blue'
                ? 'hover:bg-blue-50 text-gray-600 hover:text-blue-600'
                : 'hover:bg-emerald-50 text-gray-600 hover:text-emerald-600'

            return (
              <button
                key={item.id}
                onClick={() => router.push(item.path)}
                className={`
                  relative group flex items-center justify-center w-12 h-12 rounded-xl
                  transition-all duration-200 ease-out
                  ${buttonStyles}
                `}
                title={item.label}
              >
                <Icon className="w-5 h-5" />
                
                {/* Hover tooltip */}
                <div className="absolute top-full mt-2 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                  <div className="bg-gray-900 text-white text-xs px-2 py-1 rounded-md whitespace-nowrap">
                    {item.label}
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-b-4 border-transparent border-b-gray-900"></div>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}