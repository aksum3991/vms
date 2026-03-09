import { cookies } from "next/headers"
import { jwtVerify } from "jose"
import db from "./db"
import { getJWTSecret } from "./auth-config"

export interface ServerSession {
  userId:     string
  email:      string
  role:       string
  tenantId:   string | null   // null for superadmin
  tenantSlug: string | null   // null for superadmin
}

/**
 * Get the current authenticated user session from HTTP-only cookie.
 * Returns null if no valid session exists.
 *
 * Validates:
 * 1. JWT token signature and expiration
 * 2. User still exists in database and is active
 * 3. Returns tenantId + tenantSlug alongside role
 */
export async function getServerSession(): Promise<ServerSession | null> {
  try {
    const token = cookies().get("session")?.value
    if (!token) {
      return null
    }

    const secret = getJWTSecret()
    const { payload } = await jwtVerify(token, secret)

    const user = await (db.user as any).findUnique({
      where: { id: payload.userId as string },
      select: {
        id:       true,
        email:    true,
        role:     true,
        active:   true,
        tenantId: true,
        tenant:   { select: { slug: true } },
      },
    })

    if (!user || !user.active) {
      console.warn("[auth-server] User not found or inactive:", payload.userId)
      return null
    }

    return {
      userId:     user.id,
      email:      user.email,
      role:       user.role,
      tenantId:   user.tenantId,
      tenantSlug: user.tenant?.slug ?? null,
    }
  } catch (error) {
    console.error("[auth-server] Session verification failed:", error)
    return null
  }
}
