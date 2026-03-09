/**
 * lib/auth-options.ts
 *
 * Shared NextAuth configuration object.
 * Imported by both the NextAuth route handler AND by server-side
 * code that needs to call getServerSession(authOptions).
 */
import type { NextAuthOptions } from "next-auth"
import KeycloakProvider from "next-auth/providers/keycloak"
import db from "./db"

export const authOptions: NextAuthOptions = {
  providers: [
    KeycloakProvider({
      clientId:     process.env.AUTH_KEYCLOAK_ID!,
      clientSecret: process.env.AUTH_KEYCLOAK_SECRET!,
      issuer:       process.env.AUTH_KEYCLOAK_ISSUER!,
      httpOptions: {
        timeout: 10000,
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      // On initial Keycloak sign-in, persist the id_token for logout
      if (account) {
        token.id_token = account.id_token
      }
      return token
    },

    async session({ session, token }) {
      // Persist Keycloak id_token for end-session logout
      ;(session as any).id_token = token.id_token

      // Enrich session with VMS DB fields: role, tenantId, tenantSlug, userId
      const email = session.user?.email
      if (!email) return session

      const dbUser = await db.user.findFirst({
        where: { email },
        include: { tenant: { select: { slug: true } } },
      })

      if (dbUser) {
        const u = session.user as any
        u.userId        = dbUser.id
        u.role          = dbUser.role
        u.tenantId      = dbUser.tenantId
        u.tenantSlug    = dbUser.tenant?.slug ?? null
        u.assignedGates = dbUser.assignedGates
      }

      return session
    },
  },
}
