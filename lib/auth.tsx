"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import { useSession, signOut } from "next-auth/react"
import { storage } from "./storage"
import type { User } from "./types"

interface AuthContextType {
  user: User | null
  login: (email: string, password: string) => Promise<boolean>
  logout: () => void
  isLoading: boolean
  setAuthUser: (user: User | null) => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession()
  const [localUser, setLocalUser] = useState<User | null>(null)
  const [localLoading, setLocalLoading] = useState(true)

  // Read localStorage user on mount (backward compat with old JWT login)
  useEffect(() => {
    setLocalLoading(true)
    const currentUser = storage.getCurrentUser()
    setLocalUser(currentUser)
    setLocalLoading(false)
  }, [])

  // Derive user: prefer NextAuth session, fall back to localStorage
  let user: User | null = null
  let isLoading = true

  if (status === "loading" && localLoading) {
    // Both are still loading
    isLoading = true
  } else if (status === "authenticated" && session?.user) {
    // NextAuth session available → build User from it
    isLoading = false
    const s = session.user as any
    user = {
      id: s.userId || s.id || "",
      email: s.email || "",
      name: s.name || "",
      password: "", // Not available from session (nor needed client-side)
      role: s.role || "requester",
      assignedGates: s.assignedGates || [],
      active: true,
      tenantId: s.tenantId || null,
      tenantSlug: s.tenantSlug || null,
      language: s.language || "en",
      phone: s.phone || null,
      createdAt: new Date().toISOString(),
    }
  } else if (status === "unauthenticated" && !localLoading) {
    // NextAuth says unauthenticated → fall back to localStorage user
    isLoading = false
    user = localUser
  } else {
    // status is "loading" but localStorage is ready → show localStorage user while waiting
    isLoading = false
    user = localUser
  }

  const login = async (email: string, password: string): Promise<boolean> => {
    // Legacy login path (direct JWT) — kept for backward compat
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })
      if (!response.ok) return false
      const { user: loggedInUser } = await response.json()
      setLocalUser(loggedInUser)
      storage.setCurrentUser(loggedInUser)
      return true
    } catch {
      return false
    }
  }

  const logout = async () => {
    // Clear localStorage
    setLocalUser(null)
    storage.setCurrentUser(null)

    // Clear legacy session cookie
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch (e) {
      console.error('Failed to clear legacy session', e)
    }

    // Full Keycloak logout: clear NextAuth session, then redirect to Keycloak end_session
    if (status === "authenticated") {
      // Get the id_token before we destroy the session
      const idToken = (session as any)?.id_token

      // Clear NextAuth session cookie (don't redirect yet)
      await signOut({ redirect: false })

      // Redirect to Keycloak end_session_endpoint to kill SSO cookie
      const issuer = process.env.NEXT_PUBLIC_KEYCLOAK_ISSUER || "http://localhost:8082/realms/vms"
      const clientId = process.env.NEXT_PUBLIC_KEYCLOAK_CLIENT_ID || "vms3"
      // Use just the origin — more likely to be whitelisted in Keycloak
      const postLogoutRedirect = encodeURIComponent(window.location.origin)
      
      let logoutUrl = `${issuer}/protocol/openid-connect/logout?post_logout_redirect_uri=${postLogoutRedirect}&client_id=${clientId}`
      
      if (idToken) {
        logoutUrl += `&id_token_hint=${idToken}`
      }

      window.location.href = logoutUrl
    } else {
      // No NextAuth session, just go to login
      window.location.href = "/login"
    }
  }

  const setAuthUser = (u: User | null) => {
    setLocalUser(u)
    if (u) {
      storage.setCurrentUser(u)
    } else {
      storage.setCurrentUser(null)
    }
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading, setAuthUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
