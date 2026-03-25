import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const mobos = ['ASUS Prime Z790', 'MSI MAG B650', 'Gigabyte Aorus Elite', 'ASRock Steel Legend'];
const cpus = ['Intel i7-13700K', 'AMD Ryzen 9 7900X', 'Intel i9-14900K', 'AMD Ryzen 7 7800X3D'];
const rams = ['32GB DDR5-6000', '64GB DDR5-5200', '16GB DDR4-3600', '128GB DDR5-4800'];
const gpus = ['NVIDIA RTX 4070', 'AMD RX 7900 XT', 'NVIDIA RTX 4080 Super', 'NVIDIA RTX 3060 Ti'];
const psus = ['Corsair RM850x', 'EVGA SuperNova 750', 'Seasonic Focus 850', 'Be Quiet! 1000W'];
const storages = ['1TB NVMe Gen4', '2TB NVMe Gen4', '4TB SATA SSD', '500GB NVMe Gen3'];
const monitors = ['Dell 27" 4K', 'LG UltraWide 34"', 'ASUS ROG 24" 144Hz', 'Samsung Odyssey G7'];

async function seedWorkstations() {
    console.log('🖥️ Initializing workstation seed protocol...');

    const workstations = [];

    for (let i = 1; i <= 10; i++) {
        const unitNumber = Math.floor(Math.random() * 9000) + 1000;
        const unitId = `WS-${unitNumber}`;

        const data = {
            unitId,
            mobo: mobos[Math.floor(Math.random() * mobos.length)],
            cpu: cpus[Math.floor(Math.random() * cpus.length)],
            ram: rams[Math.floor(Math.random() * rams.length)],
            gpu: gpus[Math.floor(Math.random() * gpus.length)],
            psu: psus[Math.floor(Math.random() * psus.length)],
            storage: storages[Math.floor(Math.random() * storages.length)],
            monitor: monitors[Math.floor(Math.random() * monitors.length)],
            status: 'active',
            assignedToId: null, // No user assigned 
        };

        workstations.push(data);
    }

    try {
        // Using a loop instead of createMany to handle potential unitId collisions
        for (const ws of workstations) {
            await prisma.workstation.upsert({
                where: { unitId: ws.unitId },
                update: {},
                create: ws,
            });
        }
        console.log('✅ Successfully deployed 10 random workstations to the ITT registry.');
    } catch (error) {
        console.error('❌ Deployment failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

seedWorkstations();