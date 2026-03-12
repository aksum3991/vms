
const { PrismaClient } = require('@prisma/client');
const client = new PrismaClient();

async function run() {
  const slug = 'default'; // commonly used slug
  console.log(`Checking settings for slug: ${slug}`);
  try {
    const tenant = await client.tenant.findUnique({
      where: { slug: slug.toLowerCase() }
    });

    if (!tenant) {
      console.log(`Tenant not found for slug: ${slug}`);
      const tenants = await client.tenant.findMany();
      console.log('Available tenants:', tenants.map(t => t.slug));
      return;
    }

    const settings = await client.settings.findFirst({
      where: { tenantId: tenant.id }
    });

    if (!settings) {
      console.log(`No settings found for tenant ${tenant.name} (${tenant.id})`);
    } else {
      console.log(`Settings for ${tenant.name}:`);
      console.log(`  Gates: ${JSON.stringify(settings.gates)}`);
      console.log(`  Email Notifications: ${settings.emailNotifications}`);
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.$disconnect();
  }
}

run();
