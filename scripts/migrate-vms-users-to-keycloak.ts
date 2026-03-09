/* scripts/migrate-vms-users-to-keycloak.ts
   One-time migration: VMS DB users -> Keycloak (realm roles)
*/
import db from "../lib/db"
import {
  kcEnsureUser,
  kcSetEnabled,
  kcSetPassword,
  kcSetSingleRealmRole,
  type VmsRole,
} from "../lib/keycloak-admin"

const DRY_RUN = process.env.DRY_RUN === "1"

// Keep passwords? (fast) -> temporary=false
// Force reset? -> temporary=true
const TEMPORARY_PASSWORD = process.env.TEMPORARY_PASSWORD === "1"

function isVmsRole(role: string): role is VmsRole {
  return ["admin", "requester", "approver1", "approver2", "reception"].includes(role)
}

async function main() {
  const users = await db.user.findMany({ orderBy: { createdAt: "asc" } })

  console.log(`[migrate] Found ${users.length} users in VMS DB`)
  console.log(`[migrate] DRY_RUN=${DRY_RUN} TEMPORARY_PASSWORD=${TEMPORARY_PASSWORD}`)

  let ok = 0
  let failed = 0

  for (const u of users) {
    try {
      if (!u.email) throw new Error("Missing email")
      if (!isVmsRole(u.role)) throw new Error(`Unknown role: ${u.role}`)

      console.log(`\n[migrate] ${u.email} (${u.role}) active=${u.active}`)

      if (DRY_RUN) {
        console.log("[migrate] DRY_RUN: skipping Keycloak writes")
        ok++
        continue
      }

      // 1) Ensure user exists
      const kcUser = await kcEnsureUser(u.email, u.name ?? undefined, u.active !== false)

      // 2) Enable/disable
      await kcSetEnabled(kcUser.id, u.active !== false)

      // 3) Password
      // If your schema guarantees password exists, this will work.
      // Otherwise you can skip if empty.
      if (u.password && u.password.trim().length > 0) {
        await kcSetPassword(kcUser.id, u.password, TEMPORARY_PASSWORD)
      } else {
        console.warn(`[migrate] WARNING: no password in DB for ${u.email} (skipping password)`)
      }

      // 4) Assign single realm role
      await kcSetSingleRealmRole(kcUser.id, u.role as VmsRole)

      console.log(`[migrate] OK: provisioned ${u.email}`)
      ok++
    } catch (e: any) {
      console.error(`[migrate] FAILED: ${u.email} -> ${e?.message || e}`)
      failed++
    }
  }

  console.log(`\n[migrate] Done. ok=${ok} failed=${failed}`)
  if (failed > 0) process.exitCode = 1
}

main().catch((e) => {
  console.error("[migrate] Fatal:", e)
  process.exit(1)
})