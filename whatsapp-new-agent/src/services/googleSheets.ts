import { google } from 'googleapis';
import { DatabaseService } from './database';
import { formatDubaiTime } from '../utils/dubaiTime';

// Global variables that can be updated
let sheets: any = null;

// Cache for API keys, sheet fields, and sheet metadata to reduce API calls
interface CacheEntry<T> {
    data: T;
    timestamp: number;
}

let apiKeysCache: CacheEntry<any> | null = null;
let sheetFieldsCache: CacheEntry<any[]> | null = null;
const sheetCache = new Map<string, { exists: boolean; headers: boolean; lastChecked: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Initialize the Google Sheets API with dynamic credentials
let auth: any = null;

// Cache management functions
function isCacheValid<T>(cache: CacheEntry<T> | null): boolean {
    if (!cache) return false;
    return Date.now() - cache.timestamp < CACHE_TTL;
}

function getCachedApiKeys(): any | null {
    return isCacheValid(apiKeysCache) ? apiKeysCache!.data : null;
}

function setCachedApiKeys(data: any): void {
    apiKeysCache = { data, timestamp: Date.now() };
}

function getCachedSheetFields(): any[] | null {
    return isCacheValid(sheetFieldsCache) ? sheetFieldsCache!.data : null;
}

function setCachedSheetFields(data: any[]): void {
    sheetFieldsCache = { data, timestamp: Date.now() };
}

// Function to initialize Google Auth with credentials from database
async function initializeGoogleAuth() {
    try {
        // Check cache first
        let apiKeys = getCachedApiKeys();
        
        if (!apiKeys) {
        const databaseService = DatabaseService.getInstance();
            apiKeys = await databaseService.getApiKeys();
            setCachedApiKeys(apiKeys);
        }
        
        if (apiKeys?.googleClientEmail && apiKeys?.googlePrivateKey) {
            console.log("Using Google credentials from database");
            auth = new google.auth.GoogleAuth({
                credentials: {
                    client_email: apiKeys.googleClientEmail,
                    private_key: apiKeys.googlePrivateKey.replace(/\\n/g, '\n'),
                },
                scopes: ['https://www.googleapis.com/auth/spreadsheets'],
            });
        } else if (process.env['GOOGLE_CLIENT_EMAIL'] && process.env['GOOGLE_PRIVATE_KEY']) {
            console.log("Using Google credentials from environment variables");
            auth = new google.auth.GoogleAuth({
                credentials: {
                    client_email: process.env['GOOGLE_CLIENT_EMAIL'],
                    private_key: process.env['GOOGLE_PRIVATE_KEY'].replace(/\\n/g, '\n'),
                },
                scopes: ['https://www.googleapis.com/auth/spreadsheets'],
            });
        } else {
            throw new Error("Google credentials not configured. Please set them in the admin panel or environment variables.");
        }
    } catch (error) {
        console.error("Error initializing Google Auth:", error);
        throw error;
    }
}

// Initialize sheets instance
async function initializeSheets() {
    if (!auth) {
        await initializeGoogleAuth();
    }
    sheets = google.sheets({ version: 'v4', auth });
}

// Initialize on module load with automatic sheet sync
initializeSheets().then(async () => {
    try {
        console.log("🔄 Auto-syncing sheet headers on startup...");
        await syncAllSheetHeaders();
    } catch (error) {
        console.error("❌ Failed to auto-sync sheet headers on startup:", error);
    }
}).catch(console.error);

// Note: Removed sheetQueue as we now use batching for better performance

// Batch processing for multiple messages
interface PendingMessage {
    data: any;
    userInfo: { phone: string; name: string };
    sheetName: string;
    originalMessage: string | undefined;
    messageTimestamp: number | undefined;
    resolve: (value: boolean) => void;
    reject: (error: any) => void;
}

const pendingMessages = new Map<string, PendingMessage[]>();
const BATCH_TIMEOUT = 2000; // 2 seconds
const BATCH_SIZE = 10; // Maximum batch size

// Function to process batched messages
async function processBatch(sheetName: string, messages: PendingMessage[]) {
    if (messages.length === 0) return;

    try {
        const spreadsheetId = await getGoogleSheetId();
        
        // Ensure auth and sheets are initialized
        if (!auth || !sheets) {
            await initializeSheets();
        }

        // Note: Headers are no longer automatically synced - use sync_sheet_columns WebSocket message

        // Get dynamic fields from database to build row data (use cache)
        let fields = getCachedSheetFields();
        if (!fields) {
            const databaseService = DatabaseService.getInstance();
            fields = await databaseService.getSheetFields();
            setCachedSheetFields(fields);
        }

        // Build batch data
        const batchData: any[][] = [];
        
        for (const message of messages) {
            const rowData = [
                message.userInfo.phone || '',
                message.userInfo.name || '',
                message.originalMessage || ''
            ];
            
            if (fields && fields.length > 0) {
                // Sort fields by order and add their values
                const sortedFields = fields.sort((a, b) => a.order - b.order);
                sortedFields.forEach(field => {
                    let value = message.data[field.fieldName] || '';
                    
                    // Handle special formatting for different field types
                    if (field.fieldType === 'array' && Array.isArray(value)) {
                        value = value.join(', ');
                    } else if (field.fieldType === 'boolean') {
                        value = value ? 'Yes' : 'No';
                    } else if (field.fieldType === 'date' && value) {
                        // Ensure date is properly formatted
                        try {
                            value = new Date(value).toISOString().split('T')[0];
                        } catch {
                            // Keep original value if date parsing fails
                        }
                    }
                    
                    rowData.push(value);
                });
                
                // Ensure timestamp is at position 15 (index 14)
                // If we have less than 14 columns, pad with empty strings
                while (rowData.length < 14) {
                    rowData.push('');
                }
                // Add timestamp at position 15 (index 14) - use message timestamp in Dubai time
                const timestamp = message.messageTimestamp ? formatDubaiTime(message.messageTimestamp) : formatDubaiTime(Date.now());
                if (rowData.length === 14) {
                    rowData.push(timestamp);
                } else {
                    // If we already have more than 14 columns, insert timestamp at position 15
                    rowData.splice(14, 0, timestamp);
                }
            } else {
                // Fallback to static field mapping if no dynamic fields
                rowData.push(
                    message.data.transaction_type || '',
                    message.data.property_type || '',
                    message.data.type || '',
                    message.data.location || '',
                    message.data.project_name || '',
                    message.data.size_sqft || '',
                    message.data.bedrooms || '',
                    message.data.bathrooms || '',
                    message.data.status || '',
                    message.data.delivery_year || '',
                    message.data.price_type || '',
                    message.data.asking_price || '',
                    message.data.price_aed || '',
                    message.data.available || '',
                    message.data.special_features ? message.data.special_features.join(', ') : '',
                    message.data.contact || '',
                    message.data.note || '',
                    message.data.notes || '',
                    message.data.unprocessable || '',
                    message.data.is_multi || '',
                    message.data.message_type || ''
                );
                // Add timestamp at position 15 for fallback case - use message timestamp in Dubai time
                const timestamp = message.messageTimestamp ? formatDubaiTime(message.messageTimestamp) : formatDubaiTime(Date.now());
                rowData.splice(14, 0, timestamp);
            }
            batchData.push(rowData);
        }

        // Calculate the range based on the number of columns
        const endColumn = String.fromCharCode(65 + (batchData[0]?.length || 0) - 1);
        
        // Append batch data to sheet
        await sheets.spreadsheets.values.append({
            spreadsheetId,
            range: `${sheetName}!A:${endColumn}`,
            valueInputOption: 'USER_ENTERED',
            requestBody: {
                values: batchData,
            },
        });

        console.log(`📊 Batch processed: ${messages.length} messages sent to ${sheetName} sheet`);

        // Resolve all promises
        messages.forEach(message => message.resolve(true));
    } catch (error) {
        console.error(`Error processing batch for ${sheetName}:`, error);
        // Reject all promises
        messages.forEach(message => message.reject(error));
    }
}

// Function to add message to batch
function addToBatch(data: any, userInfo: { phone: string; name: string }, sheetName: string, originalMessage?: string, messageTimestamp?: number): Promise<boolean> {
    return new Promise((resolve, reject) => {
        const message: PendingMessage = {
            data,
            userInfo,
            sheetName,
            originalMessage,
            messageTimestamp,
            resolve,
            reject
        };

        // Add to pending messages
        if (!pendingMessages.has(sheetName)) {
            pendingMessages.set(sheetName, []);
        }
        pendingMessages.get(sheetName)!.push(message);

        // Check if we should process the batch
        const messages = pendingMessages.get(sheetName)!;
        if (messages.length >= BATCH_SIZE) {
            // Process immediately if batch is full
            pendingMessages.set(sheetName, []);
            processBatch(sheetName, messages);
        } else {
            // Set timeout to process batch after delay
            setTimeout(() => {
                const currentMessages = pendingMessages.get(sheetName);
                if (currentMessages && currentMessages.length > 0) {
                    pendingMessages.set(sheetName, []);
                    processBatch(sheetName, currentMessages);
                }
            }, BATCH_TIMEOUT);
        }
    });
}

// Function to clear cache (useful for testing or when configuration changes)
export function clearCache() {
    console.log("🧹 Clearing Google Sheets cache");
    apiKeysCache = null;
    sheetFieldsCache = null;
    sheetCache.clear();
    pendingMessages.clear();
}

// Function to get cache status (useful for debugging)
export function getCacheStatus() {
    return {
        apiKeysCache: apiKeysCache ? { valid: isCacheValid(apiKeysCache), age: Date.now() - apiKeysCache.timestamp } : null,
        sheetFieldsCache: sheetFieldsCache ? { valid: isCacheValid(sheetFieldsCache), age: Date.now() - sheetFieldsCache.timestamp } : null,
        sheetCache: Array.from(sheetCache.entries()).map(([name, data]) => ({
            name,
            exists: data.exists,
            headers: data.headers,
            age: Date.now() - data.lastChecked
        })),
        pendingMessages: Array.from(pendingMessages.entries()).map(([sheetName, messages]) => ({
            sheetName,
            count: messages.length
        }))
    };
}

// Function to manually sync all sheet headers (called via WebSocket or startup)
export async function syncAllSheetHeaders(): Promise<{ sheetsUpdated: number; totalSheets: number }> {
    const sheetNames = Object.values(SHEET_NAMES);
    let sheetsUpdated = 0;
    
    console.log(`🔄 Starting sync of ${sheetNames.length} sheet headers...`);
    
    // Ensure Google Sheets is initialized
    if (!auth || !sheets) {
        await initializeSheets();
    }
    
    for (const sheetName of sheetNames) {
        try {
            // Force ensure sheet exists and headers are updated
            await ensureSheetExists(sheetName);
            await ensureHeaders(sheetName, true); // Force update headers
            sheetsUpdated++;
            console.log(`✅ Headers synced for ${sheetName}`);
        } catch (error) {
            console.error(`❌ Failed to sync headers for ${sheetName}:`, error);
        }
    }
    
    console.log(`📊 Header sync completed: ${sheetsUpdated}/${sheetNames.length} sheets updated`);
    return {
        sheetsUpdated,
        totalSheets: sheetNames.length
    };
}

// Function to initialize sheets and sync headers (for startup)
export async function initializeSheetsWithSync(): Promise<void> {
    try {
        console.log("🚀 Initializing Google Sheets with automatic header sync...");
        
        // Initialize Google Sheets
        await initializeSheets();
        
        // Sync all sheet headers
        const result = await syncAllSheetHeaders();
        
        console.log(`✅ Google Sheets initialized and synced: ${result.sheetsUpdated}/${result.totalSheets} sheets ready`);
    } catch (error) {
        console.error("❌ Failed to initialize Google Sheets with sync:", error);
        throw error;
    }
}

// Sheet names for different transaction types
const SHEET_NAMES = {
    BUY: 'Buy_Properties',
    SELL: 'Sell_Properties', 
    RENT: 'Rent_Properties',
    GENERAL: 'General_Messages'
};

// Function to get dynamic headers from database
async function getDynamicHeaders(): Promise<string[]> {
    try {
        // Check cache first
        let fields = getCachedSheetFields();
        
        if (!fields) {
        const databaseService = DatabaseService.getInstance();
            fields = await databaseService.getSheetFields();
            setCachedSheetFields(fields);
        }
        
        if (fields && fields.length > 0) {
            // Start with system headers
            const headers = [
                'User Phone',
                'User Name', 
                'Original Message'
            ];
            
            // Add dynamic fields from database (sorted by order)
            const sortedFields = fields.sort((a, b) => a.order - b.order);
            sortedFields.forEach(field => {
                // Convert field name to proper header format
                const headerName = field.fieldName
                    .replace(/_/g, ' ')
                    .replace(/\b\w/g, (l: string) => l.toUpperCase());
                headers.push(headerName);
            });
            
            // Ensure timestamp is at position 15 (index 14)
            // If we have less than 14 columns, pad with empty strings
            while (headers.length < 14) {
                headers.push('');
            }
            // Add timestamp at position 15 (index 14)
            if (headers.length === 14) {
            headers.push('Timestamp');
            } else {
                // If we already have more than 14 columns, insert timestamp at position 15
                headers.splice(14, 0, 'Timestamp');
            }
            
            return headers;
        }
    } catch (error) {
        console.error("Error fetching dynamic headers:", error);
    }
    
    // Fallback to static headers if database fields are not available
    console.log("Using fallback static headers");
    const fallbackHeaders = [
        'User Phone',
        'User Name',
        'Original Message',
        'Transaction Type',
        'Property Type',
        'Type',
        'Location',
        'Project Name',
        'Size (sqft)',
        'Bedrooms',
        'Bathrooms',
        'Status',
        'Delivery Year',
        'Price Type',
        'Asking Price',
        'Price AED',
        'Available',
        'Special Features',
        'Contact',
        'Note',
        'Notes',
        'Unprocessable',
        'Is Multi',
        'Message Type'
    ];
    
    // Ensure timestamp is at position 15 (index 14)
    while (fallbackHeaders.length < 14) {
        fallbackHeaders.push('');
    }
    if (fallbackHeaders.length === 14) {
        fallbackHeaders.push('Timestamp');
    } else {
        fallbackHeaders.splice(14, 0, 'Timestamp');
    }
    
    return fallbackHeaders;
}

// Function to get Google Sheet ID from database
async function getGoogleSheetId(): Promise<string> {
    try {
        // Check cache first
        let apiKeys = getCachedApiKeys();
        
        if (!apiKeys) {
        const databaseService = DatabaseService.getInstance();
            apiKeys = await databaseService.getApiKeys();
            setCachedApiKeys(apiKeys);
        }
        
        if (apiKeys?.googleSheetId) {
            console.log("Using Google Sheet ID from database");
            return apiKeys.googleSheetId;
        } else if (process.env['GOOGLE_SHEET_ID']) {
            console.log("Using Google Sheet ID from environment variables");
            return process.env['GOOGLE_SHEET_ID'];
        } else {
            throw new Error("Google Sheet ID is not configured. Please set it in the admin panel.");
        }
    } catch (error) {
        console.error("Error fetching Google Sheet ID:", error);
        if (process.env['GOOGLE_SHEET_ID']) {
            console.log("Falling back to environment variable");
            return process.env['GOOGLE_SHEET_ID'];
        }
        throw new Error("Google Sheet ID is not configured. Please set it in the admin panel.");
    }
}

// Function to check if a sheet exists and create it if it doesn't
async function ensureSheetExists(sheetName: string) {
    const spreadsheetId = await getGoogleSheetId();

    // Check cache first
    const cached = sheetCache.get(sheetName);
    if (cached && Date.now() - cached.lastChecked < CACHE_TTL && cached.exists) {
        console.log(`Sheet ${sheetName} exists (cached)`);
        return;
    }

    // Ensure auth and sheets are initialized
    if (!auth || !sheets) {
        await initializeSheets();
    }

    try {
        // Get spreadsheet metadata to check existing sheets
        const spreadsheet = await sheets.spreadsheets.get({
            spreadsheetId,
        });

        // Check if sheet already exists
        const sheetExists = spreadsheet.data.sheets?.some(
            (sheet: any) => sheet.properties?.title === sheetName
        );

        // Update cache
        sheetCache.set(sheetName, {
            exists: sheetExists,
            headers: cached?.headers || false,
            lastChecked: Date.now()
        });

        if (!sheetExists) {
            console.log(`Creating sheet: ${sheetName}`);
            // Create the sheet
            await sheets.spreadsheets.batchUpdate({
                spreadsheetId,
                requestBody: {
                    requests: [
                        {
                            addSheet: {
                                properties: {
                                    title: sheetName,
                                },
                            },
                        },
                    ],
                },
            });
            console.log(`Sheet ${sheetName} created successfully`);
            
            // Update cache to reflect creation
            sheetCache.set(sheetName, {
                exists: true,
                headers: false, // Headers need to be set after creation
                lastChecked: Date.now()
            });
        } else {
            console.log(`Sheet ${sheetName} already exists`);
        }
    } catch (error) {
        console.error(`Error ensuring sheet ${sheetName} exists:`, error);
        throw error;
    }
}

// Function to update the Google Sheet ID and sync sheets
export async function updateGoogleSheetId(sheetId: string) {
    if (!sheetId) {
        console.warn("Google Sheet ID is empty");
        return;
    }
    
    console.log("🔄 Google Sheet ID update requested:", sheetId);
    
    try {
        // Clear cache to force fresh data
        clearCache();
        
        // Re-initialize with new sheet ID
        await initializeSheets();
        
        // Auto-sync all sheet headers with new sheet ID
        console.log("🔄 Auto-syncing sheet headers for new Google Sheet ID...");
        const result = await syncAllSheetHeaders();
        
        console.log(`✅ Google Sheet ID updated and headers synced: ${result.sheetsUpdated}/${result.totalSheets} sheets updated`);
        
        return {
            success: true,
            sheetsUpdated: result.sheetsUpdated,
            totalSheets: result.totalSheets
        };
    } catch (error) {
        console.error("❌ Failed to update Google Sheet ID and sync headers:", error);
        throw error;
    }
}

// Function to get current sheet ID (kept for backward compatibility)
export function getCurrentSheetId(): string | null {
    console.log("getCurrentSheetId() called - sheet ID is now fetched dynamically");
    return null; // Always return null since we fetch dynamically now
}

// Function to ensure headers exist for a specific sheet
async function ensureHeaders(sheetName: string, forceUpdate: boolean = false) {
    const spreadsheetId = await getGoogleSheetId();

    // Check cache first (unless forcing update)
    if (!forceUpdate) {
        const cached = sheetCache.get(sheetName);
        if (cached && Date.now() - cached.lastChecked < CACHE_TTL && cached.headers) {
            console.log(`Headers for ${sheetName} are up to date (cached)`);
            return;
        }
    }

    // Ensure auth and sheets are initialized
    if (!auth || !sheets) {
        await initializeSheets();
    }

    try {
        // First ensure the sheet exists
        await ensureSheetExists(sheetName);

        // Get dynamic headers from database
        const currentHeaders = await getDynamicHeaders();
        const headerRange = `${sheetName}!A1:${String.fromCharCode(65 + currentHeaders.length - 1)}1`;

        // Check if headers exist
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: headerRange,
        });

        // If no headers exist or they're different, update them
        const existingHeaders = response.data.values?.[0] || [];
        const headersChanged = existingHeaders.join(',') !== currentHeaders.join(',');
        
        if (!response.data.values || headersChanged) {
            await sheets.spreadsheets.values.update({
                spreadsheetId,
                range: headerRange,
                valueInputOption: 'USER_ENTERED',
                requestBody: {
                    values: [currentHeaders],
                },
            });
            console.log(`Headers updated successfully for ${sheetName}:`, currentHeaders);
        }

        // Update cache
        sheetCache.set(sheetName, {
            exists: true,
            headers: true,
            lastChecked: Date.now()
        });
    } catch (error) {
        console.error(`Error checking/updating headers for ${sheetName}:`, error);
        throw error;
    }
}

// Note: Removed appendToSheet function as we now use batching for better performance

// Function to determine sheet name based on transaction type
function getSheetNameForTransaction(transactionType: string): string {
    switch (transactionType) {
        case 'buy':
            return SHEET_NAMES.BUY;
        case 'sell':
            return SHEET_NAMES.SELL;
        case 'rent':
            return SHEET_NAMES.RENT;
        case 'general':
            return SHEET_NAMES.GENERAL;
        default:
            console.warn(`Unknown transaction type: ${transactionType}, using General sheet as default`);
            return SHEET_NAMES.GENERAL;
    }
}

// Function to process array of property data
async function processPropertyArray(dataArray: any[], userInfo: { phone: string; name: string }, originalMessage?: string, messageTimestamp?: number) {
    // Group data by transaction type
    const groupedData: { [key: string]: any[] } = {
        buy: [],
        sell: [],
        rent: [],
        general: []
    };

    // Sort data into groups
    dataArray.forEach(item => {
        if (item.transaction_type && groupedData[item.transaction_type]) {
            groupedData[item.transaction_type]?.push(item);
        } else {
            console.warn(`Unknown transaction type: ${item.transaction_type}, adding to general`);
            groupedData['general']?.push(item);
        }
    });

    // Send each group to its respective sheet using batching
    const promises = [];
    
    for (const [transactionType, items] of Object.entries(groupedData)) {
        if (items.length > 0) {
            const sheetName = getSheetNameForTransaction(transactionType);
            console.log(`📊 Batching ${items.length} ${transactionType} properties for ${sheetName} sheet`);
            
            // Add each item to the batch
            for (const item of items) {
                promises.push(
                    addToBatch(item, userInfo, sheetName, originalMessage, messageTimestamp)
                );
            }
        }
    }

    // Wait for all operations to complete
    await Promise.all(promises);
}

export async function sendToGoogleSheet(data: any, userInfo: { phone: string; name: string }, originalMessage?: string, messageTimestamp?: number): Promise<boolean> {
    console.log("📊 sendToGoogleSheet called with userInfo:", userInfo);
    console.log("📊 Phone number:", userInfo.phone);
    console.log("📊 Name:", userInfo.name);
    
    // Check if we can get a sheet ID
    try {
        await getGoogleSheetId(); // This will throw if no ID is available
    } catch (error) {
        console.warn("Google Sheet ID not configured, skipping sheet update");
        return false;
    }

    // Retry logic: up to 3 attempts
    const maxRetries = 3;
    let attempt = 0;
    while (attempt < maxRetries) {
        try {
            // Handle the new array format from the parser
            if (Array.isArray(data)) {
                console.log(`📊 Processing ${data.length} property entries`);
                await processPropertyArray(data, userInfo, originalMessage, messageTimestamp);
            } else {
                // Handle single object (backward compatibility) - use batching
                console.log('📊 Processing single property entry');
                const sheetName = getSheetNameForTransaction(data.transaction_type || 'buy');
                await addToBatch(data, userInfo, sheetName, originalMessage, messageTimestamp);
            }
            
            console.log('Data successfully sent to Google Sheets');
            return true;
        } catch (error) {
            attempt++;
            console.error(`Error sending data to Google Sheets (attempt ${attempt}):`, error);
            
            // Check if it's a rate limit error
            if (error && typeof error === 'object' && 'code' in error && error.code === 429) {
                console.log('🔄 Rate limit hit, waiting before retry...');
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
            
            if (attempt >= maxRetries) {
                throw error;
            }
            // Wait a bit before retrying
            await new Promise(res => setTimeout(res, 2000 * attempt));
        }
    }
    
    return false; // This should never be reached, but TypeScript requires it
}
