/**
 * lib/tenant-context.ts
 *
 * Server-side helpers for multi-tenant enforcement.
 * Call these at the start of every server action to derive and validate tenant context.
 *
 * Rules:
 * - Tenant users:   requireTenantSession() — enforces tenantId from session
 * - Superadmin:     requireSuperAdminSession() — no tenantId
 * - Never trust a tenantId passed from the client
 */

import { getServerSession, type ServerSession } from "./auth-server"
import db from "./db"

// Also support NextAuth sessions (Keycloak flow)
import { getServerSession as getNextAuthSession } from "next-auth"
import { authOptions } from "./auth-options"
import { redirect } from "next/navigation"

export interface TenantSession {
  session:    ServerSession
  tenantId:   string
  tenantSlug: string
  isImpersonated?: boolean
}

/**
 * Resolves the current server session from EITHER:
 * 1. Legacy JWT cookie (old login flow)
 * 2. NextAuth session (Keycloak flow)
 *
 * Returns a unified ServerSession or null.
 */
async function resolveSession(): Promise<ServerSession | null> {
  // Try legacy JWT first
  const legacySession = await getServerSession()
  if (legacySession) return legacySession

  // Fall back to NextAuth session
  try {
    const nextAuthSession = await getNextAuthSession(authOptions)
    if (nextAuthSession?.user) {
      const u = nextAuthSession.user as any
      return {
        userId:     u.userId     ?? "",
        email:      u.email      ?? "",
        role:       u.role       ?? "requester",
        tenantId:   u.tenantId   ?? null,
        tenantSlug: u.tenantSlug ?? null,
      }
    }
  } catch {
    // NextAuth not configured for this route, ignore
  }

  return null
}

/**
 * Use inside tenant-scoped server actions or layouts.
 * Throws if unauthenticated or if user has no tenant (superadmin).
 * Optionally verifies that the session tenant matches the expected slug (path-based isolation).
 */
export async function requireTenantSession(expectedSlug?: string): Promise<TenantSession> {
  const session = await resolveSession()
  if (!session) {
    redirect("/login")
  }

  // Superadmin can access any tenant if they specify the slug (e.g. from the URL path)
  if (session.role === "superadmin") {
    if (!expectedSlug) {
      throw new Error("Unauthorized: superadmin cannot access tenant resources directly without an organization context")
    }

    const tenant = await (db as any).tenant.findUnique({
      where: { slug: expectedSlug.toLowerCase() },
    })

    if (!tenant) {
      throw new Error(`Unauthorized: organization "/${expectedSlug}" does not exist`)
    }

    return {
      session,
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      isImpersonated: true,
    }
  }

  // Standard tenant user logic
  if (!session.tenantId || !session.tenantSlug) {
    throw new Error("Unauthorized: your account is not associated with an organization")
  }

  // Cross-tenant verification
  if (expectedSlug && session.tenantSlug !== expectedSlug) {
    throw new Error("Unauthorized: you do not have permission to access this organization")
  }

  return {
    session,
    tenantId: session.tenantId,
    tenantSlug: session.tenantSlug,
  }
}

/**
 * Use inside superadmin-only server actions.
 * Throws if not authenticated as superadmin.
 */
export async function requireSuperAdminSession(): Promise<ServerSession> {
  const session = await resolveSession()
  if (!session) {
    redirect("/login")
  }
  if (session.role !== "superadmin") {
    throw new Error("Unauthorized: superadmin access required")
  }
  return session
}

/**
 * Use inside actions that allow both superadmin and tenant users.
 * Returns session with optional tenantId.
 */
export async function requireAnySession(): Promise<ServerSession> {
  const session = await resolveSession()
  if (!session) {
    redirect("/login")
  }
  return session
}
