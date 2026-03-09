import { PrismaClient, UserRole } from '@prisma/client'

const prisma = new PrismaClient()

const DEFAULT_TENANT_ID = 'default-tenant-id'

async function main() {
  console.log(`Start seeding ...`)

  // Ensure default tenant exists
  await prisma.tenant.upsert({
    where: { slug: 'default' },
    update: {},
    create: {
      id: DEFAULT_TENANT_ID,
      name: 'Default Organization',
      slug: 'default',
      active: true,
    },
  })
  console.log(`Seeded default tenant`)

  // Create Settings for default tenant
  await prisma.settings.upsert({
    where: { tenantId: DEFAULT_TENANT_ID },
    update: {},
    create: {
      tenantId: DEFAULT_TENANT_ID,
      gates: ['228', '229', '230'],
      approvalSteps: 2,
      emailNotifications: true,
      smsNotifications: true,
      checkInOutNotifications: true,
      primaryColor: '#06b6d4',
      accentColor: '#0891b2',
    },
  })
  console.log(`Seeded settings`)

  // Create Users for default tenant
  const users = [
    {
      email: 'admin@example.com',
      name: 'Admin User',
      password: 'admin123',
      role: UserRole.admin,
      assignedGates: ['228', '229', '230'],
      tenantId: DEFAULT_TENANT_ID,
    },
    {
      email: 'approver1@example.com',
      name: 'Approver One',
      password: 'approver123',
      role: UserRole.approver1,
      assignedGates: [],
      tenantId: DEFAULT_TENANT_ID,
    },
    {
      email: 'approver2@example.com',
      name: 'Approver Two',
      password: 'approver123',
      role: UserRole.approver2,
      assignedGates: [],
      tenantId: DEFAULT_TENANT_ID,
    },
    {
      email: 'reception@example.com',
      name: 'Reception User',
      password: 'reception123',
      role: UserRole.reception,
      assignedGates: ['228', '229'],
      tenantId: DEFAULT_TENANT_ID,
    },
    {
      email: 'reception2@example.com',
      name: 'Reception Gate 230',
      password: 'reception123',
      role: UserRole.reception,
      assignedGates: ['230'],
      tenantId: DEFAULT_TENANT_ID,
    },
    {
      email: 'requester@example.com',
      name: 'Requester User',
      password: 'requester123',
      role: UserRole.requester,
      assignedGates: [],
      tenantId: DEFAULT_TENANT_ID,
    },
  ]

  for (const u of users) {
    const user = await prisma.user.upsert({
      where: { tenantId_email: { tenantId: DEFAULT_TENANT_ID, email: u.email } },
      update: {},
      create: u,
    })
    console.log(`Seeded user: ${user.email}`)
  }

  // Create superadmin (tenant-less)
  await prisma.user.upsert({
    where: { id: 'superadmin-user-id' },
    update: {},
    create: {
      id: 'superadmin-user-id',
      email: 'superadmin@vms.io',
      name: 'Super Admin',
      password: 'CHANGE_ME_IMMEDIATELY',
      role: UserRole.superadmin,
      assignedGates: [],
      tenantId: null,
    },
  })
  console.log(`Seeded superadmin`)

  console.log(`Seeding finished.`)
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
