//import cron from "node-cron";
import { PrismaClient, ClientMessage } from "@prisma/client";

// Update Google Sheets helper import to use the client-specific batching function
import { addToClientBatch } from "../services/client/clientSheetService";

// Initialize Prisma
const prisma = new PrismaClient();

// --- TYPES (Copied from service for consistency) ---

// Defines the fixed structure of data sent to the client sheet service
interface ClientRowData {
  date: string;
  customer_sequence_last: string;
  client_middle_code: string;
  classification: string;
  name: string;
  mobile_1: string;
  budget: string;
  preferred_size: string;
  preferred_area: string;
  status: string;
  individual_name: string;
  remarks: string;
  follow_up_status: string;
  // FIXED: Changed type from specific structure to 'any' to accommodate Prisma's JsonValue type,
  // which is handled by the parsing logic in clientSheetService.ts
  dailySentiments: any;
}

// Define a type for the merged property data
// Using Record<string, any> allows safe bracket notation access (mergedProperty['key'])
type MergedPropertyData = Record<string, any>;

// Define a type for the sentiment/status return object
type SentimentStatus = {
  sentiment: string | null;
  status: string | null;
  timestamp: Date | null;
};

// --- CONSTANTS ---

const CLASSIFICATION_MAP: Record<string, string> = {
  REC: "Agent Commercial",
  RER: "Agent Residential",
  RESL: "Residential Client - Lease",
  RESP: "Residential Client - Purchase",
  RET: "Retail Client - Purchase",
  RST: "Restaurant Client",
  SLN: "Saloon Client",
  BSNL: "Beauty Saloon Client",
  SPMKT: "Super Market client",
  PHA: "Pharma Client",
  OPT: "Optical",
  LND: "Laundry",
  PET: "Pet Care",
  STD: "Studio",
  FLW: "Flower",
  NRS: "Nursery",
  CAF: "Cafe",
  BAK: "Bakery",
  CLN: "Clinic",
  OTH: "Others",
};

// ------------------------------
// Helper: merge latest property data for a propertyId (UNCHANGED)
// ------------------------------
async function getLatestPropertyData(propertyId: string): Promise<MergedPropertyData> {
  const msgs: ClientMessage[] = await prisma.clientMessage.findMany({
    where: { propertyId, processed: true },
    orderBy: { timestamp: 'asc' }, // earliest first
  });

  const merged: MergedPropertyData = {};
  for (const m of msgs) {
    if (!m.property) continue;
    try {
      const parsed = JSON.parse(m.property);
      const arr = Array.isArray(parsed) ? parsed : [parsed];
      for (let p of arr) {
        if (typeof p !== "object" || p === null) continue;

        // ⭐ FIX: unwrap { raw: { ... } }
        if (p.raw && typeof p.raw === "object") {
          p = p.raw;
        }

        for (const [k, v] of Object.entries(p)) {
          if (v !== undefined && v !== null && v !== '') {
            merged[k] = v;
          }
        }
      }
    } catch {
      continue;
    }
  }

  console.log(`Merged property for ${propertyId}:`, merged);
  return merged;
}

// ------------------------------
// Helper: choose latest outgoing sentiment for "latest day" (UNCHANGED)
// ------------------------------
async function pickLatestOutgoingSentimentForProperty(propertyId: string): Promise<SentimentStatus> {
  const outgoing: ClientMessage[] = await prisma.clientMessage.findMany({
    where: { propertyId, processed: true, direction: "outgoing" },
    orderBy: { timestamp: "asc" },
  });

  if (!outgoing || outgoing.length === 0) return { sentiment: null, status: null, timestamp: null };

  const groups: Record<string, ClientMessage[]> = {};
  for (const m of outgoing) {
    const dateKey = m.timestamp.toISOString().slice(0, 10);
    if (!groups[dateKey]) groups[dateKey] = [];
    groups[dateKey].push(m);
  }

  const days = Object.keys(groups).sort();
  const latestDay = days[days.length - 1];

  if (!latestDay) {
    return { sentiment: null, status: null, timestamp: null };
  }

  const dayMessages: ClientMessage[] = groups[latestDay] || [];

  if (dayMessages.length === 0) return { sentiment: null, status: null, timestamp: null };

  dayMessages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  const latestMsg = dayMessages[dayMessages.length - 1];

  if (!latestMsg) {
    return { sentiment: null, status: null, timestamp: null };
  }

  return {
    sentiment: latestMsg.sentiment || null,
    status: latestMsg.status || null,
    timestamp: latestMsg.timestamp
  };
}

// ------------------------------
// Helper: Build the specific row data object for the Client Sheet
// UPDATED to use 'any' for dailySentiments parameter
// ------------------------------
function buildClientSheetData(
  rootMessage: ClientMessage,
  mergedProperty: MergedPropertyData,
  latestSentiment: string | null,
  latestFollowStatus: string | null,
  dailySentiments: any // FIXED: Changed type to 'any'
): ClientRowData {

  const rootAny = rootMessage as any;

  // Date
  const date = rootMessage.timestamp.toLocaleDateString("en-US", { year: 'numeric', month: '2-digit', day: '2-digit' });


  // Allowed middle codes
  const MIDDLE_CODES = [
    "REC", "RER", "RESL", "RESP", "RET", "RST", "SLN", "BSNL", "SPMKT",
    "PHA", "OPT", "LND", "PET", "STD", "FLW", "NRS", "CAF", "BAK", "CLN", "OTH"
  ];
  const fullName = rootAny.clientName || ''; // <-- use actual DB column for client name
  let name = '';
  let middle = '';


  for (const code of MIDDLE_CODES) {
    const regex = new RegExp(`\\b${code}\\b`);
    if (regex.test(fullName)) {
      middle = code;
      break;
    }
  }

  // Name is everything before middle code
  if (middle) {
    const parts = fullName.split(middle);
    name = parts[0].trim();
  } else {
    // fallback: remove trailing CLTXXX if present
    name = fullName.replace(/CLT\d+$/, '').trim();
  }

  // Classification
  const classification = CLASSIFICATION_MAP[middle] || 'Others';

  let mobile = '';
  if (rootAny.messageId) {
    const match = rootAny.messageId.match(/_(\d+)@c\.us/);
    if (match && match[1]) {
      mobile = match[1]; // "918968593200"
    }
  }

  // Or fallback to empty string
  const mobile_1 = mobile || '';
  const propertyName = mergedProperty['property_name'] || '';

  return {
    date,
    customer_sequence_last: 'CLT', // fixed
    client_middle_code: middle,
    classification,
    name: propertyName || '',
    mobile_1: mobile_1,
    budget: mergedProperty['price'] ? mergedProperty['price'].toString() : '',
    preferred_size: mergedProperty['size_sqft'] ? mergedProperty['size_sqft'].toString() : '',
    preferred_area: mergedProperty['location'] || '',
    status: latestSentiment || '',
    individual_name: name,
    remarks: '',
    follow_up_status: latestFollowStatus || '',
    dailySentiments: dailySentiments // NEW: Pass daily sentiments object/string
  };
}

// ------------------------------
// Main worker: create one row per propertyId
// ------------------------------
export async function processPropertyIdClientSync(): Promise<void> {
  console.log("Running processPropertyIdClientSync...");
  try {
    // Find propertyIds that have processed messages and a parentId='0' root message
    const distinctProps = await prisma.clientMessage.findMany({
      where: { processed: true, propertyId: { not: null } },
      select: { propertyId: true },
      distinct: ["propertyId"],
    });

    if (!distinctProps || distinctProps.length === 0) {
      return;
    }

    for (const entry of distinctProps) {
      const pid = entry.propertyId as string;
      if (!pid) continue;

      // Find root message for this propertyId (parentId='0'), earliest first
      const root: ClientMessage | null = await prisma.clientMessage.findFirst({
        where: {
          propertyId: pid, parentId: "0", processed: true, OR: [
            { sheetSynced: false },
            { needsSheetSync: true }
          ]
        },

        orderBy: { timestamp: "asc" }, // earliest root
      });

      if (!root) continue;

      // Use 'any' cast for root to safely access 'phone' and 'name' in the batch call
      const rootAny = root as any;

      // Build merged property data & sentiment/status once
      const mergedProperty = await getLatestPropertyData(pid);
      const { sentiment, status } = await pickLatestOutgoingSentimentForProperty(pid);
      const latestSentiment = sentiment;
      const latestFollowStatus = status;

      // Extract daily sentiment data from the root message (JsonValue type)
      const dailySentiments = root.dailySentiment;


      // --- 1. Append New Row Logic (or Update) ---
      if (!root.sheetSynced || root.needsSheetSync) {

        try {
          // ⭐️ Build the data row
          const clientData: ClientRowData = buildClientSheetData(
            root,
            mergedProperty,
            latestSentiment,
            latestFollowStatus,
            dailySentiments // NEW: Pass daily sentiments
          );

          // ⭐️ USE THE NEW CLIENT BATCH FUNCTION
          const rowIndex = await addToClientBatch(
            clientData,
            { phone: rootAny.phone || '', name: rootAny.name || '' },
            root.message || undefined,
            undefined,             // timestamp optional
            root.sheetRowIndex || undefined,    // pass previous row index if exists
          );

          // Mark root as synced so we don't append it again
          await prisma.clientMessage.update({
            where: { id: root.id },
            data: {
              sheetSynced: true,
              needsSheetSync: false,
              lastSheetSyncedAt: new Date(),
              sheetRowIndex: rowIndex,  // optional: store the row number in DB
              sentiment: latestSentiment ?? root.sentiment, // Ensure DB summary is latest
              status: latestFollowStatus ?? root.status // Ensure DB summary is latest
            },
          });

        } catch (err) {
          console.error(`Failed to enqueue propertyId=${pid} row:`, err);
        }
      }
    }
  } catch (err) {
    console.error("processPropertyIdClientSync error:", err);
  }
}

// Schedule cron - every 30 seconds (UNCHANGED)
//cron.schedule("*/30 * * * * *", () => {
// processPropertyIdClientSync().catch(console.error);
//});

console.log("📆 Property->Client sheet cron active (one row per propertyId)");