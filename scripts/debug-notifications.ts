
import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();

async function debug() {
  console.log('--- Recent Notification Dispatches ---');
  const dispatches = await db.notificationDispatch.findMany({
    take: 10,
    orderBy: { createdAt: 'desc' },
    include: { notification: true }
  });

  for (const d of dispatches) {
    console.log(`ID: ${d.id}`);
    console.log(`Channel: ${d.channel}`);
    console.log(`Recipient: ${d.recipient}`);
    console.log(`Status: ${d.status}`);
    console.log(`Attempts: ${d.attempts}`);
    console.log(`LastError: ${d.lastError}`);
    console.log(`TenantId: ${d.tenantId}`);
    console.log(`CreatedAt: ${d.createdAt}`);
    console.log('---');
  }

  const settingsCount = await db.settings.count();
  console.log(`Total Settings rows: ${settingsCount}`);
  
  const settings = await db.settings.findMany();
  for (const s of settings) {
    console.log(`Setting TenantId: ${s.tenantId}, hasSmtpHost: ${!!s.smtpHost}`);
  }
}

debug().catch(console.error).finally(() => db.$disconnect());
