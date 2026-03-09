/**
 * Backfill script for multi-tenancy migration.
 *
 * This script is run ONCE after `prisma migrate dev` to:
 * 1. Update the default tenant name (if desired)
 * 2. Create a superadmin user
 * 3. Verify all rows are correctly backfilled
 *
 * The actual data backfill (UPDATE statements) is embedded in the
 * SQL migration file itself. This script handles the TypeScript-level
 * verification and superadmin creation.
 *
 * Run with: npx ts-node scripts/backfill-default-tenant.ts
 */

import db from "../lib/db";

async function main() {
  console.log("🏗️  Starting multi-tenant backfill verification...\n");

  // ── 1. Verify default tenant exists ──────────────────────────────────────
  const defaultTenant = await db.tenant.findUnique({
    where: { id: "default-tenant-id" },
  });

  if (!defaultTenant) {
    throw new Error(
      "Default tenant not found. Run `prisma migrate dev` first to apply the migration SQL."
    );
  }

  console.log(`✅ Default tenant: "${defaultTenant.name}" (slug: ${defaultTenant.slug})`);

  // ── 2. Verify all users have a tenantId (except superadmin) ──────────────
  const usersWithoutTenant = await db.user.count({
    where: {
      tenantId: null,
      role: { not: "superadmin" },
    },
  });

  if (usersWithoutTenant > 0) {
    console.warn(`⚠️  ${usersWithoutTenant} non-superadmin users have no tenantId — fixing...`);
    await db.user.updateMany({
      where: { tenantId: null, role: { not: "superadmin" } },
      data: { tenantId: "default-tenant-id" },
    });
    console.log("✅ Fixed.");
  } else {
    console.log("✅ All non-superadmin users have tenantId.");
  }

  // ── 3. Verify settings row exists for default tenant ─────────────────────
  const defaultSettings = await db.settings.findUnique({
    where: { tenantId: "default-tenant-id" },
  });

  if (!defaultSettings) {
    console.log("⚠️  No settings row for default tenant — creating with defaults...");
    await db.settings.create({
      data: {
        tenantId: "default-tenant-id",
        approvalSteps: 2,
        emailNotifications: true,
        smsNotifications: true,
        checkInOutNotifications: true,
        gates: [],
      },
    });
    console.log("✅ Settings created.");
  } else {
    console.log("✅ Settings row exists for default tenant.");
  }

  // ── 4. Print row counts per table ─────────────────────────────────────────
  const [
    userCount,
    requestCount,
    guestCount,
    surveyCount,
    notifCount,
    dispatchCount,
    blacklistCount,
  ] = await Promise.all([
    db.user.count({ where: { tenantId: "default-tenant-id" } }),
    db.request.count({ where: { tenantId: "default-tenant-id" } }),
    db.guest.count({ where: { tenantId: "default-tenant-id" } }),
    db.survey.count({ where: { tenantId: "default-tenant-id" } }),
    db.notification.count({ where: { tenantId: "default-tenant-id" } }),
    db.notificationDispatch.count({ where: { tenantId: "default-tenant-id" } }),
    db.blacklistEntry.count({ where: { tenantId: "default-tenant-id" } }),
  ]);

  console.log("\n📊 Default tenant row counts:");
  console.log(`   Users:                  ${userCount}`);
  console.log(`   Requests:               ${requestCount}`);
  console.log(`   Guests:                 ${guestCount}`);
  console.log(`   Surveys:                ${surveyCount}`);
  console.log(`   Notifications:          ${notifCount}`);
  console.log(`   Notification Dispatches: ${dispatchCount}`);
  console.log(`   Blacklist Entries:      ${blacklistCount}`);

  // ── 5. Create superadmin user (skip if already exists) ───────────────────
  const SUPERADMIN_EMAIL = "superadmin@vms.io";

  const existing = await db.user.findFirst({
    where: { email: SUPERADMIN_EMAIL, role: "superadmin" },
  });

  if (existing) {
    console.log(`\n✅ Superadmin already exists: ${existing.email}`);
  } else {
    const superadmin = await db.user.create({
      data: {
        email: SUPERADMIN_EMAIL,
        name: "Super Admin",
        password: "CHANGE_ME_IMMEDIATELY",  // Must be changed after setup
        role: "superadmin",
        tenantId: null,                     // superadmin is tenant-less
        active: true,
        assignedGates: [],
      },
    });
    console.log(`\n✅ Superadmin created: ${superadmin.email}`);
    console.log("   ⚠️  IMPORTANT: Change the superadmin password immediately after login!");
  }

  console.log("\n🎉 Backfill complete! Multi-tenancy is ready.");
  console.log("\nNext steps:");
  console.log("  1. Update the default tenant name in the Prisma Studio or superadmin UI");
  console.log("  2. Proceed with Phase 2 (server-side tenant context)");
}

main()
  .catch((e) => {
    console.error("❌ Backfill failed:", e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
