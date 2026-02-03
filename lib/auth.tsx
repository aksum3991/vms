"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import { storage } from "./storage"
import { getUserByEmail } from "./actions"
import type { User } from "./types"

interface AuthContextType {
  user: User | null
  login: (email: string, password: string) => Promise<boolean>
  logout: () => void
  isLoading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const initializeAuth = () => {
      setIsLoading(true)
      const currentUser = storage.getCurrentUser()
      setUser(currentUser)
      setIsLoading(false)
    }

    initializeAuth()
  }, [])

  const login = async (email: string, password: string): Promise<boolean> => {
    const foundUser = await getUserByEmail(email)
    if (foundUser && foundUser.password === password) {
      if (foundUser.active !== false) {
        setUser(foundUser)
        storage.setCurrentUser(foundUser)
        return true
      }
    }
    return false
  }

  const logout = () => {
    setUser(null)
    storage.setCurrentUser(null)
  }

  return <AuthContext.Provider value={{ user, login, logout, isLoading }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
