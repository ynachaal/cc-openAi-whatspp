import { PrismaClient } from "@prisma/client";
//import cron from "node-cron";
import { analyzeMessage } from "../services/client/aiClientProcessor";
import { v4 as uuidv4 } from "uuid";

const prisma = new PrismaClient();
//const CRON_SCHEDULE = "*/15 * * * * *"; // every 15 seconds

/**
 * Safely parses a JSON string, handling potential errors.
 * @param data The input data, potentially a JSON string or an already parsed object.
 * @returns The parsed object or an empty object/array on failure.
 */
function safeParseJson(data: any, fallback: any = {}) {
  if (typeof data === "string") {
    try {
      return JSON.parse(data);
    } catch (e) {
      console.error("Failed to parse JSON string:", e);
      return fallback;
    }
  }
  return data || fallback;
}

function toArray(analysis: any): any[] {
  if (!analysis) return [];
  // Use safeParseJson here if analysis itself might be a JSON string,
  // but typically analyzeMessage returns an object/array.
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

  // Increase take for better efficiency, as recommended
  const BATCH_SIZE = 10; 
  const messages = await prisma.clientMessage.findMany({
    where: { processed: false },
    take: BATCH_SIZE,
    orderBy: { timestamp: "asc" },
  });

  if (messages.length === 0) {
    console.log("No new messages.");
    return;
  }

  for (const msg of messages) {
    // NOTE: For mission-critical tasks, the entire content of this loop should be 
    // wrapped in a Prisma transaction to ensure atomicity (all updates succeed or none do).
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

      // NEW: Extract specific follow-up status
      const currentFollowUpStatus =
        analysisArray[0]?.follow_up_status ||
        analysisArray[0]?.raw?.follow_up_status ||
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

      // FIX: Use safeParseJson here to prevent crashes if 'property' field is corrupted
      const parsedRootProperty = safeParseJson(firstPropertyDataMessage?.property, []);

      const firstProps = firstPropertyDataMessage?.property
        ? toArray(parsedRootProperty)
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
      const dateKey = msg.timestamp.toISOString().slice(0, 10).replace(/-/g, '.');

      if (rootMessageId) {
        const rootMsg = await prisma.clientMessage.findUnique({ where: { id: rootMessageId } });

        if (rootMsg) {
          // FIX: Use safeParseJson to robustly handle existing dailySentiment
          let rootDailySentiment = safeParseJson(rootMsg.dailySentiment, {});
          
          // The sentiment of the message currently being processed is the latest known state for the thread.
          const newRootSentiment = currentSentiment || "Neutral";

          // Update today's sentiment tracking
          // This tracks the sentiment of the last message processed for that day
          rootDailySentiment[dateKey] = newRootSentiment;

          // Determine the status for the root message: prioritize specific follow-up status
          // If the AI provided a specific status, use that. Otherwise, fall back to the generic intent.
          const newRootStatus = currentFollowUpStatus || currentIntent || "medium_interest";

          // Update root message with the sentiment of the current (latest processed) message
          await prisma.clientMessage.update({
            where: { id: rootMessageId },
            data: {
              // FIX: This line is critical. By always setting the root sentiment 
              // to the sentiment of the message being processed, we ensure that if 
              // processing is out-of-order, the last message processed determines the status.
              // In a strict time-ordered system, this reflects the latest state.
              sentiment: newRootSentiment,
              status: newRootStatus, // <-- Using the prioritized status here
              needsSheetSync: true,
              sheetSynced: false,
              lastSheetSyncedAt: null,
              dailySentiment: rootDailySentiment
            },
          });
          console.log(`Updated root message ${rootMessageId} to sentiment: ${newRootSentiment} and status: ${newRootStatus}`);
        } else {
          console.warn(`Root message ${rootMessageId} not found for update.`);
        }
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