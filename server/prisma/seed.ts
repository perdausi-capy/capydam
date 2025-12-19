import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = 'capytech@dam.admin';
  // 🔐 Securely hash the new password
  const password = await bcrypt.hash('capytech2025!', 10);

  const admin = await prisma.user.upsert({
    where: { email },
    // ✅ UPDATE block: Ensures password resets even if account exists
    update: { 
        status: 'ACTIVE',
        password: password, 
        role: 'admin',
        name: 'CapyAdmin' // Updated name for branding
    },
    // ✅ CREATE block: Runs only if account doesn't exist
    create: {
      email,
      name: 'CapyAdmin',
      password,
      role: 'admin',
      status: 'ACTIVE',
    },
  });

  console.log('🌱 Admin account seeded:', { email: admin.email, role: admin.role });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });