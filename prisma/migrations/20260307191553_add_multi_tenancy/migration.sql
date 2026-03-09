/*
  Multi-tenancy migration — safe for existing data.

  Strategy:
  1. Create tenants table
  2. Insert the "default" tenant (for existing data)
  3. Add tenantId columns as NULLABLE first
  4. Backfill all existing rows with the default tenant ID
  5. Alter columns to NOT NULL (except where nullable by design)
  6. Add indexes, unique constraints, and foreign keys
  7. Update Settings PK (Int → Text) and add tenantId
  8. Add superadmin to UserRole enum
  9. Drop old global email unique constraint, add per-tenant one
*/

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 1: Create tenants table
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 2: Insert default tenant (holds all pre-existing data)
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO "tenants" ("id", "name", "slug", "active", "createdAt")
VALUES ('default-tenant-id', 'Default Organization', 'default', true, CURRENT_TIMESTAMP);

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 3: Add superadmin to UserRole enum
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TYPE "UserRole" ADD VALUE 'superadmin';

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 4: Add tenantId columns as NULLABLE first
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE "users"                   ADD COLUMN "tenantId" TEXT;
ALTER TABLE "requests"                ADD COLUMN "tenantId" TEXT;
ALTER TABLE "guests"                  ADD COLUMN "tenantId" TEXT;
ALTER TABLE "surveys"                 ADD COLUMN "tenantId" TEXT;
ALTER TABLE "notifications"           ADD COLUMN "tenantId" TEXT;
ALTER TABLE "notification_dispatches" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "blacklist_entries"       ADD COLUMN "tenantId" TEXT;
ALTER TABLE "audit_logs"              ADD COLUMN "tenantId" TEXT;  -- stays nullable

-- Settings: drop old PK constraint, change id type, add tenantId
ALTER TABLE "settings" DROP CONSTRAINT "settings_pkey";
ALTER TABLE "settings" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "settings" ALTER COLUMN "id" SET DATA TYPE TEXT USING 'default-settings-id';
ALTER TABLE "settings" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "settings" ADD CONSTRAINT "settings_pkey" PRIMARY KEY ("id");

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 5: Backfill all existing rows with the default tenant
-- ─────────────────────────────────────────────────────────────────────────────

UPDATE "users"                   SET "tenantId" = 'default-tenant-id' WHERE "tenantId" IS NULL;
UPDATE "requests"                SET "tenantId" = 'default-tenant-id' WHERE "tenantId" IS NULL;
UPDATE "guests"                  SET "tenantId" = 'default-tenant-id' WHERE "tenantId" IS NULL;
UPDATE "surveys"                 SET "tenantId" = 'default-tenant-id' WHERE "tenantId" IS NULL;
UPDATE "notifications"           SET "tenantId" = 'default-tenant-id' WHERE "tenantId" IS NULL;
UPDATE "notification_dispatches" SET "tenantId" = 'default-tenant-id' WHERE "tenantId" IS NULL;
UPDATE "blacklist_entries"       SET "tenantId" = 'default-tenant-id' WHERE "tenantId" IS NULL;
-- audit_logs intentionally left nullable (superadmin actions have no tenant)

-- Settings: set both id and tenantId
UPDATE "settings" SET "id" = 'default-settings-id', "tenantId" = 'default-tenant-id';

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 6: Set NOT NULL constraints where required
-- ─────────────────────────────────────────────────────────────────────────────

-- users: tenantId nullable by design (superadmin = null)
-- so NOT NULL is NOT added to users.tenantId

ALTER TABLE "requests"                ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "guests"                  ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "surveys"                 ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "notifications"           ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "notification_dispatches" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "blacklist_entries"       ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "settings"                ALTER COLUMN "tenantId" SET NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 7: Drop old global unique index on users.email, add per-tenant one
-- ─────────────────────────────────────────────────────────────────────────────

DROP INDEX "users_email_key";
CREATE UNIQUE INDEX "users_tenantId_email_key"  ON "users"("tenantId", "email");

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 8: Add all indexes
-- ─────────────────────────────────────────────────────────────────────────────

CREATE INDEX "users_tenantId_idx"                            ON "users"("tenantId");
CREATE INDEX "requests_tenantId_createdAt_idx"               ON "requests"("tenantId", "createdAt");
CREATE INDEX "requests_tenantId_status_idx"                  ON "requests"("tenantId", "status");
CREATE INDEX "guests_tenantId_checkInTime_idx"               ON "guests"("tenantId", "checkInTime");
CREATE INDEX "guests_tenantId_approver2Status_idx"           ON "guests"("tenantId", "approver2Status");
CREATE INDEX "surveys_tenantId_submittedAt_idx"              ON "surveys"("tenantId", "submittedAt");
CREATE INDEX "notifications_tenantId_userId_idx"             ON "notifications"("tenantId", "userId");
CREATE INDEX "notifications_tenantId_read_idx"               ON "notifications"("tenantId", "read");
CREATE INDEX "notification_dispatches_tenantId_status_idx"   ON "notification_dispatches"("tenantId", "status");
CREATE INDEX "blacklist_entries_tenantId_idx"                ON "blacklist_entries"("tenantId");
CREATE INDEX "blacklist_entries_tenantId_active_idx"         ON "blacklist_entries"("tenantId", "active");
CREATE INDEX "audit_logs_tenantId_timestamp_idx"             ON "audit_logs"("tenantId", "timestamp");

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 9: Unique constraints
-- ─────────────────────────────────────────────────────────────────────────────

CREATE UNIQUE INDEX "requests_tenantId_approvalNumber_key" ON "requests"("tenantId", "approvalNumber");
CREATE UNIQUE INDEX "settings_tenantId_key"                ON "settings"("tenantId");

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 10: Foreign key constraints
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE "users"                   ADD CONSTRAINT "users_tenantId_fkey"                   FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL  ON UPDATE CASCADE;
ALTER TABLE "requests"                ADD CONSTRAINT "requests_tenantId_fkey"                FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "guests"                  ADD CONSTRAINT "guests_tenantId_fkey"                  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "surveys"                 ADD CONSTRAINT "surveys_tenantId_fkey"                 FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "settings"                ADD CONSTRAINT "settings_tenantId_fkey"                FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "notifications"           ADD CONSTRAINT "notifications_tenantId_fkey"           FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "notification_dispatches" ADD CONSTRAINT "notification_dispatches_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "blacklist_entries"       ADD CONSTRAINT "blacklist_entries_tenantId_fkey"       FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "audit_logs"              ADD CONSTRAINT "audit_logs_tenantId_fkey"              FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL  ON UPDATE CASCADE;
