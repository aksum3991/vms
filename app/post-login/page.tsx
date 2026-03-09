"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"

export default function PostLogin() {
  const router = useRouter()
  const { data: session, status } = useSession()

  useEffect(() => {
    if (status === "loading") return

    // Only redirect to login if NextAuth explicitly says unauthenticated
    if (status === "unauthenticated") {
      router.replace("/login")
      return
    }

    // Session is authenticated — read role and tenant
    const role = (session?.user as any)?.role as string | undefined
    const tenantSlug = (session?.user as any)?.tenantSlug as string | undefined

    if (!role) {
      // Role not yet populated (session callback may not have run)
      // Try again on next render, or fallback after a brief delay
      const timer = setTimeout(() => {
        router.replace("/")
      }, 2000)
      return () => clearTimeout(timer)
    }

    // Role-based redirection
    if (role === "superadmin") {
      router.replace("/superadmin")
      return
    }

    if (!tenantSlug) {
      // If they have no tenant and they aren't superadmin, they shouldn't belong here
      router.replace("/login")
      return
    }

    const tenantPath = `/t/${tenantSlug}`

    switch (role) {
      case "admin":
        router.replace(`${tenantPath}/admin`)
        break
      case "requester":
        router.replace(`${tenantPath}/requester`)
        break
      case "approver1":
        router.replace(`${tenantPath}/approver1`)
        break
      case "approver2":
        router.replace(`${tenantPath}/approver2`)
        break
      case "reception":
        router.replace(`${tenantPath}/reception`)
        break
      default:
        router.replace(tenantPath)
    }
  }, [session, status, router])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-muted-foreground">Redirecting...</p>
      </div>
    </div>
  )
}