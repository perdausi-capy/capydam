import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkDescriptions() {
  console.log("🔍 Checking database for descriptions...\n");

  // Get 10 random migrated assets
  const assets = await prisma.asset.findMany({
    where: { 
        filename: { startsWith: 'migration/' } 
    },
    take: 10,
    select: { id: true, filename: true, aiData: true }
  });

  if (assets.length === 0) {
      console.log("❌ No migrated assets found!");
      return;
  }

  assets.forEach(asset => {
      console.log(`------------------------------------------------`);
      console.log(`📂 File: ${asset.filename}`);
      
      try {
          const data = JSON.parse(asset.aiData || '{}');
          
          // Check all possible description fields
          const desc = data.description;
          const summ = data.summary;
          const capt = data.caption;
          
          if (desc) console.log(`✅ description: "${desc.substring(0, 100)}..."`);
          else console.log(`❌ description: NULL`);

          if (summ) console.log(`✅ summary:     "${summ.substring(0, 100)}..."`);
          else console.log(`❌ summary:     NULL`);

          if (capt) console.log(`✅ caption:     "${capt.substring(0, 100)}..."`);
          else console.log(`❌ caption:     NULL`);

      } catch (e) {
          console.log(`❌ Error parsing JSON: ${asset.aiData}`);
      }
  });
  console.log(`------------------------------------------------`);
}

checkDescriptions()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
