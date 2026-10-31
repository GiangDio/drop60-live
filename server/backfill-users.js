const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function backfillUserNumbers() {
  const users = await prisma.user.findMany({ orderBy: { createdAt: 'asc' } });
  console.log(`Found ${users.length} users.`);
  for (let i = 0; i < users.length; i++) {
    const u = users[i];
    const num = i + 1;
    await prisma.user.update({
      where: { id: u.id },
      data: { userNumber: num },
    });
    console.log(`Assigned userNumber ${num} to user ${u.username} (${u.id})`);
  }
}

backfillUserNumbers()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
