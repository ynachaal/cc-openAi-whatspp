"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateGoogleSheetId = updateGoogleSheetId;
exports.getCurrentSheetId = getCurrentSheetId;
exports.sendToGoogleSheet = sendToGoogleSheet;
const googleapis_1 = require("googleapis");
const p_queue_1 = __importDefault(require("p-queue"));
const database_1 = require("./services/database");
const rateLimit_1 = require("./config/rateLimit");
// Global variables that can be updated
let sheets = null;
// Get rate limit configuration
const rateLimitConfig = (0, rateLimit_1.getRateLimitConfig)();
// Cache for sheet existence and headers to reduce API calls
const sheetCache = new Map();
const CACHE_TTL = rateLimitConfig.CACHE.sheetExistenceTTL;
// Rate limiter state
let requestCount = 0;
let lastRequestTime = 0;
// Initialize the Google Sheets API
const auth = new googleapis_1.google.auth.GoogleAuth({
    credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
// Initialize sheets instance
function initializeSheets() {
    sheets = googleapis_1.google.sheets({ version: 'v4', auth });
}
// Initialize on module load
initializeSheets();
// Create a queue for Google Sheets writes (concurrency 1)
const sheetQueue = new p_queue_1.default({ concurrency: 1 });
// Sheet names for different transaction types
const SHEET_NAMES = {
    BUY: 'Buy_Properties',
    SELL: 'Sell_Properties',
    RENT: 'Rent_Properties',
    GENERAL: 'General_Messages'
};
// Function to get dynamic headers from database
async function getDynamicHeaders() {
    try {
        const databaseService = database_1.DatabaseService.getInstance();
        const fields = await databaseService.getSheetFields();
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
                    .replace(/\b\w/g, (l) => l.toUpperCase());
                headers.push(headerName);
            });
            // Add timestamp at the end
            headers.push('Timestamp');
            console.log("Using dynamic headers from database:", headers);
            return headers;
        }
    }
    catch (error) {
        console.error("Error fetching dynamic headers:", error);
    }
    // Fallback to static headers if database fields are not available
    console.log("Using fallback static headers");
    return [
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
        'Message Type',
        'Timestamp'
    ];
}
// Function to get Google Sheet ID from database
async function getGoogleSheetId() {
    try {
        const databaseService = database_1.DatabaseService.getInstance();
        const apiKeys = await databaseService.getApiKeys();
        if (apiKeys?.googleSheetId) {
            console.log("Using Google Sheet ID from database");
            return apiKeys.googleSheetId;
        }
        else if (process.env.GOOGLE_SHEET_ID) {
            console.log("Using Google Sheet ID from environment variables");
            return process.env.GOOGLE_SHEET_ID;
        }
        else {
            throw new Error("Google Sheet ID is not configured. Please set it in the admin panel.");
        }
    }
    catch (error) {
        console.error("Error fetching Google Sheet ID:", error);
        if (process.env.GOOGLE_SHEET_ID) {
            console.log("Falling back to environment variable");
            return process.env.GOOGLE_SHEET_ID;
        }
        throw new Error("Google Sheet ID is not configured. Please set it in the admin panel.");
    }
}
// Function to check if a sheet exists and create it if it doesn't
async function ensureSheetExists(sheetName) {
    const spreadsheetId = await getGoogleSheetId();
    try {
        // Get spreadsheet metadata to check existing sheets
        const spreadsheet = await sheets.spreadsheets.get({
            spreadsheetId,
        });
        // Check if sheet already exists
        const sheetExists = spreadsheet.data.sheets?.some((sheet) => sheet.properties?.title === sheetName);
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
        }
        else {
            console.log(`Sheet ${sheetName} already exists`);
        }
    }
    catch (error) {
        console.error(`Error ensuring sheet ${sheetName} exists:`, error);
        throw error;
    }
}
// Function to update the Google Sheet ID (kept for backward compatibility)
function updateGoogleSheetId(sheetId) {
    if (!sheetId) {
        console.warn("Google Sheet ID is empty");
        return;
    }
    console.log("Google Sheet ID update requested:", sheetId);
    // Note: This function is kept for compatibility but the ID is now fetched dynamically
}
// Function to get current sheet ID (kept for backward compatibility)
function getCurrentSheetId() {
    console.log("getCurrentSheetId() called - sheet ID is now fetched dynamically");
    return null; // Always return null since we fetch dynamically now
}
// Function to ensure headers exist for a specific sheet
async function ensureHeaders(sheetName) {
    const spreadsheetId = await getGoogleSheetId();
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
    }
    catch (error) {
        console.error(`Error checking/updating headers for ${sheetName}:`, error);
        throw error;
    }
}
// Function to append data to a specific sheet
async function appendToSheet(data, userInfo, sheetName, originalMessage) {
    const spreadsheetId = await getGoogleSheetId();
    // Ensure headers exist before appending data
    await ensureHeaders(sheetName);
    // Get dynamic fields from database to build row data
    const databaseService = database_1.DatabaseService.getInstance();
    const fields = await databaseService.getSheetFields();
    // Build row data dynamically
    const rowData = [
        userInfo.phone || '',
        userInfo.name || '',
        originalMessage || ''
    ];
    if (fields && fields.length > 0) {
        // Sort fields by order and add their values
        const sortedFields = fields.sort((a, b) => a.order - b.order);
        sortedFields.forEach(field => {
            let value = data[field.fieldName] || '';
            // Handle special formatting for different field types
            if (field.fieldType === 'array' && Array.isArray(value)) {
                value = value.join(', ');
            }
            else if (field.fieldType === 'boolean') {
                value = value ? 'Yes' : 'No';
            }
            else if (field.fieldType === 'date' && value) {
                // Ensure date is properly formatted
                try {
                    value = new Date(value).toISOString().split('T')[0];
                }
                catch {
                    // Keep original value if date parsing fails
                }
            }
            rowData.push(value);
        });
    }
    else {
        // Fallback to static field mapping if no dynamic fields
        console.warn("No dynamic fields found, using fallback data mapping");
        rowData.push(data.transaction_type || '', data.property_type || '', data.type || '', data.location || '', data.project_name || '', data.size_sqft || '', data.bedrooms || '', data.bathrooms || '', data.status || '', data.delivery_year || '', data.price_type || '', data.asking_price || '', data.price_aed || '', data.available || '', data.special_features ? data.special_features.join(', ') : '', data.contact || '', data.note || '', data.notes || '', data.unprocessable || '', data.is_multi || '', data.message_type || '');
    }
    // Add timestamp at the end
    rowData.push(new Date().toISOString());
    const values = [rowData];
    // Calculate the range based on the number of columns
    const endColumn = String.fromCharCode(65 + rowData.length - 1);
    await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${sheetName}!A:${endColumn}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
            values,
        },
    });
}
// Function to determine sheet name based on transaction type
function getSheetNameForTransaction(transactionType) {
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
async function processPropertyArray(dataArray, userInfo, originalMessage) {
    const spreadsheetId = await getGoogleSheetId();
    // Group data by transaction type
    const groupedData = {
        buy: [],
        sell: [],
        rent: [],
        general: []
    };
    // Sort data into groups
    dataArray.forEach(item => {
        if (item.transaction_type && groupedData[item.transaction_type]) {
            groupedData[item.transaction_type].push(item);
        }
        else {
            console.warn(`Unknown transaction type: ${item.transaction_type}, adding to general`);
            groupedData.general.push(item);
        }
    });
    // Send each group to its respective sheet
    const promises = [];
    for (const [transactionType, items] of Object.entries(groupedData)) {
        if (items.length > 0) {
            const sheetName = getSheetNameForTransaction(transactionType);
            console.log(`📊 Sending ${items.length} ${transactionType} properties to ${sheetName} sheet`);
            // Send each item to the appropriate sheet
            for (const item of items) {
                promises.push(sheetQueue.add(() => appendToSheet(item, userInfo, sheetName, originalMessage)));
            }
        }
    }
    // Wait for all operations to complete
    await Promise.all(promises);
}
async function sendToGoogleSheet(data, userInfo, originalMessage) {
    // Check if we can get a sheet ID
    try {
        await getGoogleSheetId(); // This will throw if no ID is available
    }
    catch (error) {
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
                await processPropertyArray(data, userInfo, originalMessage);
            }
            else {
                // Handle single object (backward compatibility)
                console.log('📊 Processing single property entry');
                const sheetName = getSheetNameForTransaction(data.transaction_type || 'buy');
                await sheetQueue.add(() => appendToSheet(data, userInfo, sheetName, originalMessage));
            }
            console.log('Data successfully sent to Google Sheets');
            return true;
        }
        catch (error) {
            attempt++;
            console.error(`Error sending data to Google Sheets (attempt ${attempt}):`, error);
            // Check if it's a rate limit error
            if (error && typeof error === 'object' && 'code' in error && error.code === 429) {
                console.log('🔄 Rate limit hit, waiting before retry...');
                await new Promise(resolve => setTimeout(resolve, rateLimitConfig.GOOGLE_SHEETS.retryDelay));
            }
            if (attempt >= maxRetries) {
                throw error;
            }
            // Wait a bit before retrying
            await new Promise(res => setTimeout(res, 2000 * attempt));
        }
    }
}
