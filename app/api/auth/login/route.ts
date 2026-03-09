import { NextResponse } from "next/server"
import { SignJWT } from "jose"
import { cookies } from "next/headers"
import db from "@/lib/db"
import { getJWTSecret } from "@/lib/auth-config"

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json()

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      )
    }

    // Find user by email — use findFirst (email is now unique per tenant, not globally)
    const user = await db.user.findFirst({
      where: { email },
      select: {
        id: true,
        email: true,
        password: true,
        name: true,
        role: true,
        active: true,
        assignedGates: true,
        tenantId: true,
        tenant: { select: { slug: true } },
      },
    })

    // Validate credentials
    if (!user || user.password !== password) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      )
    }

    // Check if account is active
    if (!user.active) {
      console.warn("[auth/login] Login failed: Account inactive", email)
      return NextResponse.json(
        { error: "Account is inactive. Please contact administrator." },
        { status: 403 }
      )
    }

    // Create JWT token (throws if JWT_SECRET missing)
    const secret = getJWTSecret()
    const token = await new SignJWT({
      userId: user.id,
      email: user.email,
      role: user.role,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("24h")
      .sign(secret)

    // Set HTTP-only cookie
    console.log("[auth/login] Login successful for:", email)
    cookies().set("session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24, // 24 hours
      path: "/",
    })

    // Return user data (without password)
    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        assignedGates: user.assignedGates,
      },
    })
  } catch (error) {
    console.error("[auth/login] Error:", error)
    return NextResponse.json(
      { error: "Login failed. Please try again." },
      { status: 500 }
    )
  }
}
