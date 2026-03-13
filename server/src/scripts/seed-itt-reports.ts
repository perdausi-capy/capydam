import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();
const prisma = new PrismaClient();

async function seedReports() {
  console.log("🚀 Starting ITT Daily Report Seeding...");

  // 1. Get the primary Admin user to act as the author
  const admin = await prisma.user.findFirst({
    where: { role: 'admin' }
  });

  if (!admin) {
    console.error("❌ No admin user found. Please register an account first.");
    return;
  }

  const reports = [
    {
      date: new Date('2026-03-01'),
      reactive: ["Fixed RAM seating on WS-04", "Resolved blue screen on Unit-09"],
      proactive: ["Updated firmware on all Dell monitors", "Cable management for Row B"],
      notes: "Heavy focus on stabilizing the new workstations.",
      next: "Check Unit-05 power supply."
    },
    {
      date: new Date('2026-03-02'),
      reactive: ["Keyboard replacement for WS-12"],
      proactive: ["Internal dust cleanup for high-performance units"],
      notes: "Routine maintenance day.",
      next: "Inventory check for spare peripherals."
    },
    {
      date: new Date('2026-03-03'),
      reactive: ["Network connectivity issues in meeting room"],
      proactive: ["Software patch rollout for creative suite"],
      notes: "Coordinated with ISP for line stability.",
      next: "Monitor network traffic logs."
    },
    {
      date: new Date('2026-03-04'),
      reactive: ["WS-02 GPU artifacting reported"],
      proactive: ["Optimized storage server indexing"],
      notes: "Storage latency reduced by 15% after re-indexing.",
      next: "Swap GPU on WS-02 if artifacts persist."
    },
    {
      date: new Date('2026-03-05'),
      reactive: ["Mouse sensor failure on Unit-22"],
      proactive: ["Verified backup integrity for DAM assets"],
      notes: "Local MinIO backups verified and synced.",
      next: "Renew SSL certificates next week."
    },
    {
      date: new Date('2026-03-06'),
      reactive: ["Printer driver conflict on WS-07"],
      proactive: ["General workstation OS updates"],
      notes: "Standard Friday patch cycle complete.",
      next: "None."
    },
    {
      date: new Date('2026-03-09'),
      reactive: ["Monitor flicker on Unit-01"],
      proactive: ["Testing new pgvector search speed"],
      notes: "Database optimization session.",
      next: "Scale Docker containers if load increases."
    },
    {
      date: new Date('2026-03-10'),
      reactive: ["Broken DP cable on WS-15"],
      proactive: ["Auditing workstation hardware specs"],
      notes: "Matching physical units with ITT Dashboard records.",
      next: "Update motherboard BIOS for Row C."
    },
    {
      date: new Date('2026-03-11'),
      reactive: ["Rise 360 preview lag investigation"],
      proactive: ["Nginx proxy cache clearing"],
      notes: "Internal tools running at zero-latency.",
      next: "Review support ticket trends."
    },
    {
      date: new Date('2026-03-12'),
      reactive: ["WS-08 CPU overheating"],
      proactive: ["Applied new thermal paste to older units"],
      notes: "Temperature monitoring enabled for high-load stations.",
      next: "Order more Noctua fans."
    }
  ];

  for (const r of reports) {
    await prisma.dailyReport.create({
      data: {
        date: r.date,
        hours: 8.0,
        reactiveTickets: r.reactive,
        proactiveMaintenance: r.proactive,
        researchNotes: r.notes,
        nextSteps: r.next,
        authorId: admin.id
      }
    });
    console.log(`✅ Seeded report for: ${r.date.toLocaleDateString()}`);
  }

  console.log("\n✨ Seeding Complete! 10 ITT Reports added.");
}

seedReports()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
