"use client"

import type React from "react"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { useAuth } from "@/lib/auth"
import type { UserRole } from "@/lib/types"

interface ProtectedRouteProps {
  children: React.ReactNode
  allowedRoles?: UserRole[]
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, isLoading } = useAuth()
  const { status } = useSession()
  const router = useRouter()

  // Still loading either auth source
  const authLoading = isLoading || status === "loading"

  useEffect(() => {
    if (authLoading) return

    // Only redirect to login if BOTH NextAuth is unauthenticated AND useAuth has no user
    if (!user) {
      router.push("/login")
    } else if (allowedRoles && !allowedRoles.includes(user.role)) {
      // User is authenticated but wrong role
      if (user.role === "reception") {
        router.push("/reception")
      } else {
        router.push("/")
      }
    }
  }, [user, authLoading, router, allowedRoles])

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user || (allowedRoles && !allowedRoles.includes(user.role))) {
    return null
  }

  return <>{children}</>
}

export default ProtectedRoute
