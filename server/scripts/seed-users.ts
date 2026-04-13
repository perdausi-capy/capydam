import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting to seed 20 users...');
  
  const usersToCreate = [];
  const defaultPassword = await bcrypt.hash('password123', 10); // Default password for all seeded users
  
  for (let i = 1; i <= 20; i++) {
    // Adding a random string to avoid unique constraint errors on multiple runs
    const randomSuffix = Math.random().toString(36).substring(2, 7);
    
    usersToCreate.push({
      email: `user${i}_${randomSuffix}@example.com`,
      password: defaultPassword,
      name: `Test User ${i}`,
      role: 'viewer', // Adjust this if you want some admin users
      status: 'ACTIVE',
      provider: 'email',
    });
  }

  try {
    const createdUsers = await prisma.user.createMany({
      data: usersToCreate,
      skipDuplicates: true,
    });

    console.log(`Successfully created ${createdUsers.count} users!`);
    console.log(`They all share the password: 'password123'`);
  } catch (error) {
    console.error('Error seeding users:', error);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
