/**
 * lib/db-tenant.ts
 *
 * Prisma Client Extension that auto-injects tenantId into queries.
 *
 * Usage:
 *   const tdb = tenantDb(tenantId)
 *   await tdb.request.findMany(...)        // auto adds WHERE tenantId = ?
 *   await tdb.request.findFirst({ where: { id } })  // auto adds AND tenantId = ?
 *   await tdb.request.create({ data: {...} })        // auto adds tenantId to data
 *
 * Important:
 *   - findUnique / update / delete are NOT auto-injected (Prisma unique constraint)
 *   - Use findFirst instead of findUnique for tenant-scoped lookups
 *   - Use updateMany/deleteMany instead of update/delete for tenant-safe mutations
 *   - Inside $transaction, pass tenantId manually — tx does NOT inherit this extension
 */

import db from "./db"

// Models that must always be filtered by tenantId
const TENANT_MODELS = new Set([
  "User",
  "Request",
  "Guest",
  "Survey",
  "Settings",
  "Notification",
  "NotificationDispatch",
  "BlacklistEntry",
  "AuditLog",
])

// Global models — no tenantId filtering
// "Tenant" itself + lookup-only join models
const GLOBAL_MODELS = new Set(["Tenant"])

// Operations where tenantId can be safely injected into WHERE
const FILTER_OPS = new Set([
  "findMany",
  "findFirst",
  "count",
  "updateMany",
  "deleteMany",
  "aggregate",
  "groupBy",
])

// Operations where tenantId must be injected into data
const CREATE_OPS = new Set(["create", "createMany"])

// Operations that are INTENTIONALLY NOT injected:
// findUnique, update, delete — callers must handle these manually
// (use findFirst + updateMany/deleteMany pattern instead)

export function tenantDb(tenantId: string) {
  return db.$extends({
    query: {
      $allOperations({ model, operation, args, query }) {
        // Skip global models
        if (!model || GLOBAL_MODELS.has(model) || !TENANT_MODELS.has(model)) {
          return query(args)
        }

        if (FILTER_OPS.has(operation)) {
          // Inject tenantId into WHERE clause
          args = { ...args, where: { ...args.where, tenantId } }
        } else if (CREATE_OPS.has(operation)) {
          // Inject tenantId into data
          if (operation === "createMany" && Array.isArray(args.data)) {
            args = {
              ...args,
              data: args.data.map((d: Record<string, unknown>) => ({ ...d, tenantId })),
            }
          } else {
            args = { ...args, data: { ...args.data, tenantId } }
          }
        }
        // findUnique, update, delete: pass through unchanged
        // Callers are responsible for tenant safety on these operations

        return query(args)
      },
    },
  })
}

/**
 * Type helper — use when you need the extended client type
 */
export type TenantDbClient = ReturnType<typeof tenantDb>

/**
 * Safe single-record lookup (use instead of findUnique)
 *
 * Example:
 *   const req = await findByIdInTenant(tdb.request, requestId)
 */
export async function findByIdInTenant<T>(
  model: { findFirst: (args: any) => Promise<T | null> },
  id: string
): Promise<T | null> {
  return model.findFirst({ where: { id } })
  // tenantId is auto-injected by the extension
}
