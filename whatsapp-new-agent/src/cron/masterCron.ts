import cron from "node-cron";
import { processMessages } from "./aiMessageProcessor"; 
import { processPropertyIdClientSync } from "./clientSheet";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
let masterCronRunning = false;
// Master cron every 10 seconds
cron.schedule("*/10 * * * * *", async () => {
  if (masterCronRunning) {
    console.log("⚠️ MASTER CRON SKIPPED — still running");
    return;
  }

  masterCronRunning = true;

  try {
    console.log("🧠 MASTER CRON START");

    // 1️⃣ Keep processing messages until queue is empty
    while (true) {
      const pending = await prisma.clientMessage.count({
        where: { processed: false }
      });

      if (pending === 0) break;

      console.log(`🔄 Processing pending messages (${pending} left)...`);
      await processMessages();
    }

    console.log("✅ All messages processed.");

    // 2️⃣ Now do the sheet sync
    console.log("📤 Running sheet sync...");
    await processPropertyIdClientSync();

    console.log("🏁 MASTER CRON DONE");
  } finally {
    masterCronRunning = false;
  }
});