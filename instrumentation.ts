/**
 * Next.js instrumentation file for startup hooks.
 * This runs when the server starts, before accepting requests.
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { validateAuthConfig } = await import('./lib/auth-config')
    
    // Validate auth config at startup
    // This will throw and prevent server from starting if JWT_SECRET is missing
    validateAuthConfig()
  }
}
