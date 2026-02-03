const { PrismaClient, UserRole } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
  // await prisma.settings.upsert({
  //   where: { id: 1 },
  //   update: {},
  //   create: {
  //     gates: ['228', '229', '230'],
  //     approvalSteps: 2,
  //     emailNotifications: true,
  //     smsNotifications: true,
  //     checkInOutNotifications: true,
  //     primaryColor: '#06b6d4',
  //     accentColor: '#0891b2',
  //   },
  // })

  const users = [
    // {
    //   email: "admin@example.com",
    //   name: "Admin User",
    //   password: "admin123",
    //   role: UserRole.admin,
    //   assignedGates: ["228", "229", "230"],
    // },
    // {
    //   email: "approver1@example.com",
    //   name: "Approver One",
    //   password: "approver123",
    //   role: UserRole.approver1,
    //   assignedGates: [],
    // },
    // {
    //   email: "approver2@example.com",
    //   name: "Approver Two",
    //   password: "approver123",
    //   role: UserRole.approver2,
    //   assignedGates: [],
    // },
    // {
    //   email: "reception@example.com",
    //   name: "Reception User",
    //   password: "reception123",
    //   role: UserRole.reception,
    //   assignedGates: ["228", "229"],
    // },
    // {
    //   email: "reception2@example.com",
    //   name: "Reception Gate 230",
    //   password: "reception123",
    //   role: UserRole.reception,
    //   assignedGates: ["230"],
    // },
    // {
    //   email: "requester@example.com",
    //   name: "Requester User",
    //   password: "requester123",
    //   role: UserRole.requester,
    //   assignedGates: [],
    // },
    {
      email: "aksumawityemane2@gmail.com",
      name: "Requester User 2",
      password: "requester123",
      role: UserRole.requester,
      assignedGates: [],
    },
  ];

  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: u,
    })
  }
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    await prisma.$disconnect()
    process.exit(1)
  })
