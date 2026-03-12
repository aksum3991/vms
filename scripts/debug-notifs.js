
const { PrismaClient } = require('@prisma/client');
const client = new PrismaClient();

async function run() {
  console.log('--- NOTIFICATION DISPATCH DEBUG ---');
  try {
    const dispatches = await client.notificationDispatch.findMany({
      take: 20,
      orderBy: { createdAt: 'desc' },
    });

    if (dispatches.length === 0) {
      console.log('No dispatches found.');
    }

    for (const d of dispatches) {
      console.log(`[${d.createdAt.toISOString()}] ${d.channel} to ${d.recipient}`);
      console.log(`  Status: ${d.status}`);
      console.log(`  Provider: ${d.provider}`);
      console.log(`  TenantId: ${d.tenantId}`);
      if (d.lastError) {
        console.log(`  Error: ${d.lastError}`);
      }
      console.log('---');
    }

    const settings = await client.settings.findMany();
    console.log(`Found ${settings.length} settings records.`);
    for (const s of settings) {
        console.log(`TenantId: ${s.tenantId}, SMTP Host: ${s.smtpHost}`);
    }

  } catch (err) {
    console.error('Error running debug script:', err);
  } finally {
    await client.$disconnect();
  }
}

run();
