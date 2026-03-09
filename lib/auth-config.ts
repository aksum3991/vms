/**
 * Authentication configuration and validation.
 * This module ensures JWT_SECRET is properly configured at startup.
 */

/**
 * Validates authentication configuration at startup.
 * Throws error if JWT_SECRET is missing or invalid.
 * MUST be called before server starts accepting requests.
 */
export function validateAuthConfig(): void {
  if (!process.env.JWT_SECRET) {
    throw new Error(
      "FATAL: JWT_SECRET environment variable is not set. " +
      "Generate one with: openssl rand -base64 32"
    )
  }

  if (process.env.JWT_SECRET.length < 32) {
    throw new Error(
      "FATAL: JWT_SECRET must be at least 32 characters long. " +
      "Current length: " + process.env.JWT_SECRET.length
    )
  }

  console.log("[auth-config] JWT_SECRET validated successfully")
}

/**
 * Gets JWT secret. Assumes validateAuthConfig() was called at startup.
 * Throws if secret is missing (should never happen after startup validation).
 */
export function getJWTSecret(): Uint8Array {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET not configured (startup validation failed)")
  }
  return new TextEncoder().encode(process.env.JWT_SECRET)
}
