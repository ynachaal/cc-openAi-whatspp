"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateOpenAIModel = updateOpenAIModel;
exports.analyzeMessage = analyzeMessage;
const openai_1 = __importDefault(require("openai"));
const zod_1 = require("zod");
const database_1 = require("./services/database");
// Global OpenAI instance that can be updated
let openai;
// Function to get OpenAI API key from database
async function getOpenAIApiKey() {
    try {
        const databaseService = database_1.DatabaseService.getInstance();
        const apiKeys = await databaseService.getApiKeys();
        if (apiKeys?.openaiKey) {
            console.log("Using OpenAI API key from database");
            return apiKeys.openaiKey;
        }
        else if (process.env.OPENAI_API_KEY) {
            console.log("Using OpenAI API key from environment variables");
            return process.env.OPENAI_API_KEY;
        }
        else {
            throw new Error("OpenAI API key is not configured. Please set it in the admin panel.");
        }
    }
    catch (error) {
        console.error("Error fetching OpenAI API key:", error);
        if (process.env.OPENAI_API_KEY) {
            console.log("Falling back to environment variable");
            return process.env.OPENAI_API_KEY;
        }
        throw new Error("OpenAI API key is not configured. Please set it in the admin panel.");
    }
}
// Initialize OpenAI with API key (can be updated later)
async function initializeOpenAI(apiKey) {
    const key = apiKey || await getOpenAIApiKey();
    openai = new openai_1.default({
        apiKey: key
    });
}
// Function to update the OpenAI client with a new API key
function updateOpenAIModel(apiKey) {
    if (!apiKey) {
        console.warn("OpenAI API key is empty, using default");
        return;
    }
    console.log("Updating OpenAI client with new API key");
    openai = new openai_1.default({
        apiKey: apiKey
    });
}
// Fallback schema for when no database fields are configured
const fallbackSchema = zod_1.z.object({
    transaction_type: zod_1.z.enum(["buy", "sell", "rent", "general"]),
    property_type: zod_1.z.string().optional().nullable(),
    location: zod_1.z.string().optional().nullable(),
    price: zod_1.z.number().optional().nullable(),
    note: zod_1.z.string().optional().nullable(),
});
// Function to get sheet fields from database
async function getSheetFields() {
    try {
        const databaseService = database_1.DatabaseService.getInstance();
        const fields = await databaseService.getSheetFields();
        return fields || [];
    }
    catch (error) {
        console.error("Error fetching sheet fields:", error);
        return [];
    }
}
// Function to build dynamic schema based on sheet fields
async function buildDynamicSchema() {
    const sheetFields = await getSheetFields();
    if (sheetFields.length === 0) {
        console.log("No sheet fields configured, using fallback schema");
        // Return union of single object or array for fallback
        return zod_1.z.union([fallbackSchema, zod_1.z.array(fallbackSchema)]);
    }
    // Build schema object dynamically from database fields
    const schemaFields = {};
    sheetFields.forEach(field => {
        let fieldSchema;
        switch (field.fieldType) {
            case 'text':
                fieldSchema = zod_1.z.string().optional().nullable();
                break;
            case 'number':
                fieldSchema = zod_1.z.number().optional().nullable();
                break;
            case 'date':
                fieldSchema = zod_1.z.string().optional().nullable();
                break;
            case 'boolean':
                fieldSchema = zod_1.z.boolean().optional();
                break;
            case 'enum':
                if (field.enumValues) {
                    try {
                        const enumValues = JSON.parse(field.enumValues);
                        if (Array.isArray(enumValues) && enumValues.length > 0) {
                            fieldSchema = zod_1.z.enum(enumValues).optional().nullable();
                        }
                        else {
                            fieldSchema = zod_1.z.string().optional().nullable();
                        }
                    }
                    catch {
                        fieldSchema = zod_1.z.string().optional().nullable();
                    }
                }
                else {
                    fieldSchema = zod_1.z.string().optional().nullable();
                }
                break;
            case 'array':
                fieldSchema = zod_1.z.array(zod_1.z.string()).optional().nullable();
                break;
            default:
                fieldSchema = zod_1.z.string().optional().nullable();
        }
        schemaFields[field.fieldName] = fieldSchema;
    });
    const singleObjectSchema = zod_1.z.object(schemaFields);
    console.log("Built dynamic schema with fields:", Object.keys(schemaFields));
    // Return union of single object or array of objects to handle both cases
    return zod_1.z.union([singleObjectSchema, zod_1.z.array(singleObjectSchema)]);
}
// Function to build dynamic system prompt based on sheet fields
async function buildSystemPrompt() {
    const sheetFields = await getSheetFields();
    let fieldsDescription = '';
    if (sheetFields.length > 0) {
        fieldsDescription = '\n# Output Schema\n';
        sheetFields.forEach(field => {
            const required = field.isRequired ? ' (Required)' : '';
            fieldsDescription += `- "${field.fieldName}": ${field.fieldType}${required}\n`;
            if (field.description) {
                fieldsDescription += `  ${field.description}\n`;
            }
            if (field.fieldType === 'enum' && field.enumValues) {
                try {
                    const enumValues = JSON.parse(field.enumValues);
                    if (Array.isArray(enumValues)) {
                        fieldsDescription += `  Allowed values: ${enumValues.join(', ')}\n`;
                    }
                }
                catch { }
            }
        });
    }
    else {
        fieldsDescription = `
# Output Schema
- "transaction_type": "buy" | "sell" | "rent" | "general"
- "property_type": string | null
- "location": string | null
- "price": number | null
- "note": string | null
`;
    }
    return `
You are a real estate assistant tasked with analyzing user-provided messages to extract detailed property information.

CRITICAL TASK: Analyze the message to detect if it contains information about multiple properties or just one property.

## Multiple Property Detection:
Look for ANY indication of multiple properties including:
- Multiple different locations mentioned
- Multiple different prices mentioned  
- Multiple different property types (apartment, villa, studio, etc.)
- Multiple different sizes or bedroom counts
- Any separators between property descriptions (line breaks, dashes, bullets, etc.)
- Multiple transaction types (some for rent, some for sale)
- Lists in any format (numbered, bulleted, or just separated)
- Words indicating plurality: "properties", "units", "apartments", "villas"
- Phrases like "available", "we have", "multiple", "several", "various"

## Response Format Rules:

**If MULTIPLE properties detected:**
- Return a JSON array where each element is a property object
- Each property must be a complete, separate entry
- Extract all available information for each property individually
- Even if properties share some common information, create separate complete objects

**If SINGLE property detected:**  
- Return a single JSON object (not wrapped in array)

## Extraction Guidelines:
${fieldsDescription}

## Processing Rules:
1. **CRITICAL**: Multiple properties = JSON ARRAY, Single property = JSON OBJECT
2. Clean emojis and formatting symbols from extracted data
3. Convert prices to numbers only (remove currency symbols, k=thousands, m=millions)
4. Extract location, size, bedrooms, bathrooms, price for each property separately
5. Handle ANY message format - structured or unstructured
6. Contact information applies to all properties if mentioned once
7. If uncertain whether single or multiple, err on the side of multiple (return array)
8. Return valid JSON only - no explanatory text

## Example Scenarios:

Multiple properties (ANY format):
- "2BR Marina 1.5M, 3BR Downtown 2.1M" → ARRAY of 2 objects
- "Villa in Jumeirah for sale. Also have apartment in Marina for rent" → ARRAY of 2 objects  
- "Available: Studio 800K, 1BR 1.2M, 2BR 1.8M" → ARRAY of 3 objects
- "Properties in Dubai: Marina apartment, JBR villa, Downtown penthouse" → ARRAY of 3 objects

Single property:
- "2BR apartment Marina 1.5M" → SINGLE object
- "Looking for villa in Jumeirah around 3M budget" → SINGLE object

REMEMBER: If you detect multiple distinct properties (different locations, prices, types, sizes), return an array. Otherwise return a single object.
`;
}
async function analyzeMessage(message) {
    // Initialize OpenAI client if not already done or if API key is missing
    if (!openai || !openai.apiKey) {
        try {
            await initializeOpenAI();
        }
        catch (error) {
            console.error("Failed to initialize OpenAI client:", error);
            throw new Error("OpenAI API key is not configured. Please set it in the admin panel.");
        }
    }
    try {
        // Build dynamic prompt and schema
        const systemPrompt = await buildSystemPrompt();
        const dynamicSchema = await buildDynamicSchema();
        const completion = await openai.chat.completions.create({
            model: "gpt-4.1-2025-04-14",
            messages: [
                {
                    role: "system",
                    content: systemPrompt
                },
                {
                    role: "user",
                    content: `Analyze the following message/image: ${message}`
                }
            ],
            temperature: 0
            // Removed response_format constraint to allow arrays
        });
        const response = completion.choices[0]?.message?.content;
        if (!response) {
            throw new Error("No response from OpenAI");
        }
        // Clean the response to extract JSON (remove any extra text)
        let cleanResponse = response.trim();
        // Try to extract JSON from the response if it contains extra text
        const jsonMatch = cleanResponse.match(/(\[.*\]|\{.*\})/s);
        if (jsonMatch) {
            cleanResponse = jsonMatch[1];
        }
        // Parse the JSON response
        const result = JSON.parse(cleanResponse);
        // Validate the result against our dynamic schema
        const validatedResult = dynamicSchema.parse(result);
        // Log the result type for debugging
        if (Array.isArray(validatedResult)) {
            console.log(`🔍 AI detected ${validatedResult.length} properties in the message`);
            console.log("🔍 Property types:", validatedResult.map((p) => p.property_type || p.transaction_type).join(', '));
        }
        else {
            console.log("🔍 AI detected 1 property in the message");
            console.log("🔍 Property type:", validatedResult.property_type || validatedResult.transaction_type);
        }
        return validatedResult;
    }
    catch (e) {
        console.error("Error analyzing message:", e);
        return {
            not_real_estate: "The message is not related to real estate or could not be parsed.",
            error: e.message || e.toString()
        };
    }
}
