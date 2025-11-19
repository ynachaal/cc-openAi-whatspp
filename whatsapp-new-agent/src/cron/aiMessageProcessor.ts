import { PrismaClient } from "@prisma/client";
//import cron from "node-cron";
import { analyzeMessage } from "../services/client/aiClientProcessor";
import { v4 as uuidv4 } from "uuid";

const prisma = new PrismaClient();
//const CRON_SCHEDULE = "*/15 * * * * *"; // every 15 seconds

function toArray(analysis: any): any[] {
  if (!analysis) return [];
  return Array.isArray(analysis) ? analysis : [analysis];
}

function populateFields(
  prop: any,
  sentiment: string | null,
  intent: string | null,
  consistentId: string,
  parentId: string
) {
  return {
    ...prop,
    client_sentiment: sentiment || prop.client_sentiment || "Neutral",
    client_intent: intent || prop.client_intent || "medium_interest",
    propertyId: consistentId,
    parentId: parentId,
  };
}

export async function processMessages() {
  console.log("🔍 AI Cron: scanning unprocessed messages...");

  const messages = await prisma.clientMessage.findMany({
    where: { processed: false },
    take: 1,
    orderBy: { timestamp: "asc" },
  });

  if (messages.length === 0) {
    console.log("No new messages.");
    return;
  }

  for (const msg of messages) {
    try {
      const { clientName } = msg;

      console.log(
        `\n--- [DEBUG] START PROCESSING MESSAGE: ${msg.id} ---`
      );

      // Fetch conversation history
      const previousMessages = await prisma.clientMessage.findMany({
        where: { clientName, processed: true, timestamp: { lt: msg.timestamp } },
        orderBy: { timestamp: "desc" },
        take: 10,
      });

      const formattedHistory = previousMessages.map((m) =>
        `${m.direction === "incoming" ? "Agent" : "Client"}: ${m.message}`
      );

      // Run AI analysis
      const analysis = await analyzeMessage(msg.message, false, formattedHistory);
      const analysisArray = toArray(analysis);

      const isNewThreadSignal = analysisArray[0]?.raw?.is_new_property_thread === true;

      const currentSentiment =
        analysisArray[0]?.client_sentiment ||
        analysisArray[0]?.raw?.client_sentiment ||
        null;

      const currentIntent =
        analysisArray[0]?.client_intent ||
        analysisArray[0]?.raw?.client_intent ||
        null;

      const hasPropertyData = analysisArray.some(
        (p) =>
          p.property_type ||
          p.location ||
          p.price ||
          p.bedrooms ||
          p.bathrooms
      );

      // Determine propertyId
      const activePropertyMessage = await prisma.clientMessage.findFirst({
        where: {
          clientName,
          processed: true,
          propertyId: { not: null },
          timestamp: { lt: msg.timestamp },
        },
        orderBy: { timestamp: "desc" },
      });

      let consistentPropertyId = activePropertyMessage?.propertyId || uuidv4();
      if (isNewThreadSignal) consistentPropertyId = uuidv4();

      // Determine parentId
      let parentId: string;
      let rootMessageId: string | null = null;

      if (isNewThreadSignal) {
        parentId = "0";
      } else {
        const latestRoot = await prisma.clientMessage.findFirst({
          where: {
            clientName,
            processed: true,
            parentId: "0",
            propertyId: consistentPropertyId,
          },
          orderBy: { timestamp: "desc" },
        });
        parentId = latestRoot ? latestRoot.id : "0";
        rootMessageId = latestRoot?.id || null;
      }

      // Fetch first/root property data
      const firstPropertyDataMessage = await prisma.clientMessage.findFirst({
        where: {
          clientName,
          processed: true,
          propertyId: consistentPropertyId,
          parentId: "0",
        },
        orderBy: { timestamp: "asc" },
      });

      const firstProps = firstPropertyDataMessage?.property
        ? toArray(JSON.parse(firstPropertyDataMessage.property))
        : [];

      // Build final property array
      let finalProperty: any[] = [];

      if (isNewThreadSignal) {
        finalProperty = analysisArray.map((p) =>
          populateFields(p, currentSentiment, currentIntent, consistentPropertyId, parentId)
        );
      } else {
        if (hasPropertyData) {
          const merged: any[] = [...firstProps, ...analysisArray];
          finalProperty = merged.map((p) =>
            populateFields(p, currentSentiment, currentIntent, consistentPropertyId, parentId)
          );
        } else if (firstProps.length > 0) {
          finalProperty = firstProps.map((p) =>
            populateFields(p, currentSentiment, currentIntent, consistentPropertyId, parentId)
          );
        } else {
          finalProperty = analysisArray.map((p) =>
            populateFields(p, currentSentiment, currentIntent, consistentPropertyId, parentId)
          );
        }
      }

      const topPropertyId = consistentPropertyId;

      // SAVE the new message
      await prisma.clientMessage.update({
        where: { id: msg.id },
        data: {
          property: JSON.stringify(finalProperty),
          propertyId: topPropertyId,
          sentiment: currentSentiment || "Neutral",
          processed: true,
          parentId: parentId,
          needsSheetSync: true,
          sheetSynced: false,
          lastSheetSyncedAt: null
        },
      });

      console.log(
        `Processed message ${msg.id} for client "${clientName}" with propertyId = ${topPropertyId}`
      );

      // --- UPDATE ROOT/PARENT MESSAGE ---
     const dateKey = msg.timestamp.toISOString().slice(0, 10).replace(/-/g, '.'); // "2025.11.19"

// Merge with existing dailySentiment of the root
let rootDailySentiment: Record<string, string> = {};
if (rootMessageId) {
  const rootMsg = await prisma.clientMessage.findUnique({ where: { id: rootMessageId } });
  if (rootMsg?.dailySentiment) {
    rootDailySentiment = typeof rootMsg.dailySentiment === "string"
      ? JSON.parse(rootMsg.dailySentiment)
      : rootMsg.dailySentiment;
  }
}

// Update today's sentiment
rootDailySentiment[dateKey] = currentSentiment || "Neutral";

// Update root message
if (rootMessageId) {
  await prisma.clientMessage.update({
    where: { id: rootMessageId },
    data: {
      sentiment: currentSentiment || "Neutral",
      status: currentIntent || "medium_interest",
      needsSheetSync: true,
      sheetSynced: false,
      lastSheetSyncedAt: null,
      dailySentiment: rootDailySentiment
    },
  });
}
    } catch (err) {
      console.error(`❌ Error processing message ${msg.id}`, err);
    }
  }

  console.log("AI processing done.");
}

// Schedule cron
//cron.schedule(CRON_SCHEDULE, processMessages);
console.log(`⏱️ AI Cron started, running every 15 seconds`);
