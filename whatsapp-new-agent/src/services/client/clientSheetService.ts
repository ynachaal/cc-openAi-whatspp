import { google } from 'googleapis';
import { DatabaseService } from '../database';


// --- CONFIGURATION ---
const CLIENT_SHEET_NAME = 'Client';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const BATCH_TIMEOUT = 2000; // 2 seconds
const BATCH_SIZE = 10; // Maximum batch size

// Global state and caches
let sheets: any = null;
let apiKeysCache: { data: any; timestamp: number } | null = null;
const sheetCache = new Map<string, { exists: boolean; headers: boolean; lastChecked: number }>();
let auth: any = null;
const batchTimeouts = new Map<string, NodeJS.Timeout>(); // Stores timeout IDs

// Defines the fixed structure of data received from the worker
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
    // NEW: Field to hold the structured daily sentiment data
    dailySentiments: any;
}

interface PendingMessage {
    data: ClientRowData; // Specific data structure for Client sheet
    userInfo: { phone: string; name: string };
    sheetName: string;
    originalMessage: string | undefined;
    messageTimestamp: number | undefined;
    sheetRowIndex: number | undefined; // <-- explicitly include undefined
    resolve: (rowIndex: number) => void; // <-- change from boolean to number
    reject: (error: any) => void;
}

// Use a map, but only expect the 'Client' key
const pendingMessages = new Map<string, PendingMessage[]>();


// --- UTILITY & CACHE FUNCTIONS (Mostly unchanged, but simplified) ---

function isCacheValid<T>(cache: { data: T; timestamp: number } | null): boolean {
    if (!cache) return false;
    return Date.now() - cache.timestamp < CACHE_TTL;
}

function getCachedApiKeys(): any | null {
    return isCacheValid(apiKeysCache) ? apiKeysCache!.data : null;
}

function setCachedApiKeys(data: any): void {
    apiKeysCache = { data, timestamp: Date.now() };
}

// Function to initialize Google Auth with credentials from database (unchanged)
async function initializeGoogleAuth() {
    try {
        let apiKeys = getCachedApiKeys();
        if (!apiKeys) {
            const databaseService = DatabaseService.getInstance();
            apiKeys = await databaseService.getApiKeys();
            setCachedApiKeys(apiKeys);
        }

        if (apiKeys?.googleClientEmail && apiKeys?.googlePrivateKey) {
            auth = new google.auth.GoogleAuth({
                credentials: {
                    client_email: apiKeys.googleClientEmail,
                    private_key: apiKeys.googlePrivateKey.replace(/\\n/g, '\n'),
                },
                scopes: ['https://www.googleapis.com/auth/spreadsheets'],
            });
        } else if (process.env['GOOGLE_CLIENT_EMAIL'] && process.env['GOOGLE_PRIVATE_KEY']) {
            auth = new google.auth.GoogleAuth({
                credentials: {
                    client_email: process.env['GOOGLE_CLIENT_EMAIL'],
                    private_key: process.env['GOOGLE_PRIVATE_KEY'].replace(/\\n/g, '\n'),
                },
                scopes: ['https://www.googleapis.com/auth/spreadsheets'],
            });
        } else {
            throw new Error("Google credentials not configured.");
        }
    } catch (error) {
        console.error("Error initializing Google Auth:", error);
        throw error;
    }
}

// Initialize sheets instance (unchanged)
async function initializeSheets() {
    if (!auth) {
        await initializeGoogleAuth();
    }
    sheets = google.sheets({ version: 'v4', auth });
}

// Function to get Google Sheet ID from database (unchanged)
async function getGoogleSheetId(): Promise<string> {
    try {
        let apiKeys = getCachedApiKeys();
        if (!apiKeys) {
            const databaseService = DatabaseService.getInstance();
            apiKeys = await databaseService.getApiKeys();
            setCachedApiKeys(apiKeys);
        }

        if (apiKeys?.googleSheetId) {
            return apiKeys.googleSheetId;
        } else if (process.env['GOOGLE_SHEET_ID']) {
            return process.env['GOOGLE_SHEET_ID'];
        } else {
            throw new Error("Google Sheet ID is not configured.");
        }
    } catch (error) {
        console.error("Error fetching Google Sheet ID:", error);
        if (process.env['GOOGLE_SHEET_ID']) {
            return process.env['GOOGLE_SHEET_ID'];
        }
        throw new Error("Google Sheet ID is not configured.");
    }
}


// --- CLIENT SHEET SPECIFIC LOGIC ---

// Defines the exact order of columns for the Client sheet
function getClientHeaders(): string[] {
    const baseHeaders = [
        'Date',
        'Customer Sequence - Last',
        'Middle', 
        'Classification', 
        'Name',
        'Mobile 1',
        'Budget',
        'Preferred Size',
        'Preferred Area',
        'Status',
        'Individual Name',
        'Remarks',
        'Follow Up Status',
    ];

    // NEW: Add columns for daily sentiment up to Day 10
    for (let i = 1; i <= 10; i++) {
        baseHeaders.push(`Day ${i} Response`);
    }

    return baseHeaders;
}

/**
 * Parses the dailySentiment data, orders it by date, and pads it to 10 entries.
 * UPDATED: Prepends the date to the sentiment value (e.g., 'YYYY.MM.DD:Sentiment').
 * @param dailySentimentData The object or stringified object containing daily sentiments.
 * @returns An array of 10 sentiment strings/empty strings.
 */
function getOrderedDailySentiments(dailySentimentData: any): (string)[] {
    let parsedData: Record<string, string> = {};
    
    if (typeof dailySentimentData === 'string') {
        try {
            // Handle cases where the string might be 'null' or not valid JSON
            const trimmedData = dailySentimentData.trim();
            if (trimmedData && trimmedData !== 'null') {
                parsedData = JSON.parse(trimmedData);
            }
        } catch (e) {
            console.error("Failed to parse dailySentiment JSON string:", e);
        }
    } else if (dailySentimentData && typeof dailySentimentData === 'object' && !Array.isArray(dailySentimentData)) {
        parsedData = dailySentimentData as Record<string, string>;
    }

    // Extract date keys (format YYYY.MM.DD) and sort them chronologically
    const sortedDates = Object.keys(parsedData).sort();
    
    // Map sorted dates to sentiment values, including the date in the format 'YYYY.MM.DD:Sentiment'
    const sentiments = sortedDates.map(dateKey => {
        const sentiment = parsedData[dateKey] || '';
        // Only include the combined string if a sentiment value exists
        return sentiment ? `${dateKey}:${sentiment}` : '';
    }).filter(s => s !== ''); // Filter out empty strings if sentiment was missing for a date

    
    // Pad the array up to 10 entries with empty strings
    const paddedSentiments = [...sentiments];
    while (paddedSentiments.length < 10) {
        paddedSentiments.push('');
    }

    // Return only the first 10
    return paddedSentiments.slice(0, 10);
}

// Function to map the incoming data keys to the header columns
function mapClientRowData(message: PendingMessage): any[] {
    const data = message.data;
    
    // NEW: Process daily sentiments
    const orderedSentiments = getOrderedDailySentiments(data.dailySentiments);

    return [
        data.date || '',
        data.customer_sequence_last || '',
        data.client_middle_code || '',
        data.classification || '',
        data.name || '',
        data.mobile_1 || '',
        data.budget || '',
        data.preferred_size || '',
        data.preferred_area || '',
        data.status || '',
        data.individual_name || '',
        data.remarks || '',
        data.follow_up_status || '',
        // NEW: Add daily sentiment columns
        ...orderedSentiments,
    ];
}


// --- SHEET MANAGEMENT (Restricted to CLIENT_SHEET_NAME) ---

// Function to check if a sheet exists and create it if it doesn't
async function ensureSheetExists(sheetName: string) {
    if (sheetName !== CLIENT_SHEET_NAME) throw new Error("This service only manages the 'Client' sheet.");
    const spreadsheetId = await getGoogleSheetId();
    // Check cache first
    const cached = sheetCache.get(sheetName);
    if (cached && Date.now() - cached.lastChecked < CACHE_TTL && cached.exists) {
        return;
    }

    // Ensure auth and sheets are initialized
    if (!auth || !sheets) {
        await initializeSheets();
    }

    try {
        const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
        const sheetExists = spreadsheet.data.sheets?.some(
            (sheet: any) => sheet.properties?.title === sheetName
        );

        sheetCache.set(sheetName, {
            exists: sheetExists,
            headers: cached?.headers || false,
            lastChecked: Date.now()
        });

        if (!sheetExists) {
            await sheets.spreadsheets.batchUpdate({
                spreadsheetId,
                requestBody: { requests: [{ addSheet: { properties: { title: sheetName } } }] },
            });
            sheetCache.set(sheetName, { exists: true, headers: false, lastChecked: Date.now() });
        }
    } catch (error) {
        console.error(`Error ensuring sheet ${sheetName} exists:`, error);
        throw error;
    }
}

// Function to ensure headers exist for the Client sheet
async function ensureHeaders(sheetName: string, forceUpdate: boolean = false) {
    if (sheetName !== CLIENT_SHEET_NAME) return;
    
    const spreadsheetId = await getGoogleSheetId();
    // Check cache first (unless forcing update)
    if (!forceUpdate) {
        const cached = sheetCache.get(sheetName);
        if (cached && Date.now() - cached.lastChecked < CACHE_TTL && cached.headers) {
            return;
        }
    }

    if (!auth || !sheets) { await initializeSheets(); }

    try {
        await ensureSheetExists(sheetName);

        const currentHeaders = getClientHeaders();
        const endColumnChar = String.fromCharCode(65 + currentHeaders.length - 1);
        const headerRange = `${sheetName}!A1:${endColumnChar}1`;

        // Check if headers exist
        const response = await sheets.spreadsheets.values.get({ spreadsheetId, range: headerRange });

        // Update logic remains the same, comparing existing vs currentHeaders
        const existingHeaders = response.data.values?.[0] || [];
        const headersChanged = existingHeaders.join(',') !== currentHeaders.slice(0, existingHeaders.length).join(',') || existingHeaders.length !== currentHeaders.length;

        if (!response.data.values || headersChanged) {
            await sheets.spreadsheets.values.update({
                spreadsheetId,
                range: headerRange,
                valueInputOption: 'USER_ENTERED',
                requestBody: { values: [currentHeaders] },
            });
            console.log(`Headers updated successfully for ${sheetName}`);
        }

        sheetCache.set(sheetName, { exists: true, headers: true, lastChecked: Date.now() });
    } catch (error) {
        console.error(`Error checking/updating headers for ${sheetName}:`, error);
        throw error;
    }
}


// --- BATCHING CORE (RENAMED and Client-Specific) ---

// --- PROCESS CLIENT BATCH ---
export async function processClientBatch(messages: PendingMessage[]) {
  if (messages.length === 0) return;

  const timeoutId = batchTimeouts.get(CLIENT_SHEET_NAME);
  if (timeoutId) {
    clearTimeout(timeoutId);
    batchTimeouts.delete(CLIENT_SHEET_NAME);
  }

  try {
    const spreadsheetId = await getGoogleSheetId();
    if (!auth || !sheets) await initializeSheets();
    await ensureHeaders(CLIENT_SHEET_NAME);

    const headers = getClientHeaders();
    const endColumn = String.fromCharCode(65 + headers.length - 1);

    for (const msg of messages) {
      const rowData = mapClientRowData(msg);

      if (msg.sheetRowIndex) {
        // ✅ Update existing row
        const rowIndex = msg.sheetRowIndex;
        const range = `${CLIENT_SHEET_NAME}!A${rowIndex}:${endColumn}${rowIndex}`;
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range,
          valueInputOption: 'USER_ENTERED',
          requestBody: { values: [rowData] },
        });
        msg.resolve(rowIndex);
      } else {
        // Append new row
        const result = await sheets.spreadsheets.values.append({
          spreadsheetId,
          range: `${CLIENT_SHEET_NAME}!A:${endColumn}`,
          valueInputOption: 'USER_ENTERED',
          requestBody: { values: [rowData] },
        });

        // Get the new row index
        const startRow = Number(result.data.updates?.updatedRange?.match(/\d+$/)?.[0]);
        msg.resolve(startRow);
      }
    }

    console.log(`📊 Batch processed: ${messages.length} messages sent to ${CLIENT_SHEET_NAME} sheet`);
  } catch (error) {
    console.error(`Error processing batch for ${CLIENT_SHEET_NAME}:`, error);
    messages.forEach(msg => msg.reject(error));
  }
}

export function addToClientBatch(
  data: ClientRowData,
  userInfo: { phone: string; name: string },
  originalMessage?: string,
  messageTimestamp?: number,
  sheetRowIndex?: number
): Promise<number> {
  return new Promise((resolve, reject) => {
    const message: PendingMessage = {
      data,
      userInfo,
      sheetName: CLIENT_SHEET_NAME,
      originalMessage,
      messageTimestamp,
      sheetRowIndex,  // optional existing row index for updates
      resolve,
      reject
    };

    if (!pendingMessages.has(CLIENT_SHEET_NAME)) {
      pendingMessages.set(CLIENT_SHEET_NAME, []);
    }
    pendingMessages.get(CLIENT_SHEET_NAME)!.push(message);

    const messages = pendingMessages.get(CLIENT_SHEET_NAME)!;

    if (messages.length >= BATCH_SIZE) {
      pendingMessages.set(CLIENT_SHEET_NAME, []);
      processClientBatch(messages);
    } else {
      if (!batchTimeouts.has(CLIENT_SHEET_NAME)) {
        const timeoutId = setTimeout(() => {
          const currentMessages = pendingMessages.get(CLIENT_SHEET_NAME);
          if (currentMessages && currentMessages.length > 0) {
            pendingMessages.set(CLIENT_SHEET_NAME, []);
            processClientBatch(currentMessages);
          }
        }, BATCH_TIMEOUT);
        batchTimeouts.set(CLIENT_SHEET_NAME, timeoutId);
      }
    }
  });
}


// --- EXPORTED UTILITIES (Simplified/Renamed) ---

// Function to clear cache (updated to clear batchTimeouts)
export function clearClientCache() {
    apiKeysCache = null;
    sheetCache.clear();
    pendingMessages.clear();
    Array.from(batchTimeouts.values()).forEach(clearTimeout);
    batchTimeouts.clear();
}

// Function to manually sync sheet headers (only for Client sheet)
export async function syncClientSheetHeaders(): Promise<void> {
    console.log(`🔄 Starting sync of ${CLIENT_SHEET_NAME} sheet headers...`);

    if (!auth || !sheets) {
        await initializeSheets();
    }

    try {
        await ensureHeaders(CLIENT_SHEET_NAME, true); // Force update headers
        console.log(`✅ Headers synced for ${CLIENT_SHEET_NAME}`);
    } catch (error) {
        console.error(`❌ Failed to sync headers for ${CLIENT_SHEET_NAME}:`, error);
        throw error;
    }
}

// Function to update the Google Sheet ID and sync sheets
export async function updateGoogleSheetIdAndSyncClient(sheetId: string) {
    if (!sheetId) return;

    try {
        clearClientCache();

        await initializeSheets();

        await syncClientSheetHeaders();

        return { success: true };
    } catch (error) {
        console.error("❌ Failed to update Google Sheet ID and sync client headers:", error);
        throw error;
    }
}


// --- INITIALIZATION ---

initializeSheets().then(async () => {
    try {
        console.log(`🔄 Auto-syncing ${CLIENT_SHEET_NAME} sheet headers on startup...`);
        await ensureHeaders(CLIENT_SHEET_NAME);
    } catch (error) {
        console.error("❌ Failed to auto-sync client sheet headers on startup:", error);
    }
}).catch(console.error);