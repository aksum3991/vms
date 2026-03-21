const { PrismaClient } = require('@prisma/client');

const db = new PrismaClient();

async function run() {
  try {
    const settingsList = await db.settings.findMany();
    if (settingsList.length === 0) {
      console.log('No settings found in DB.');
      return;
    }

    const settings = settingsList[0];
    console.log('Using Settings:', {
      tenantId: settings.tenantId,
      emailNotifications: settings.emailNotifications,
      emailGatewayUrl: settings.emailGatewayUrl,
      hasEmailApiKey: !!settings.emailApiKey
    });

  } catch (err) {
    console.error('Test FAILED:', err.message);
  } finally {
    await db.$disconnect();
  }
}

run();
