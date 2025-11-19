import OpenAI from "openai";
import { z } from "zod";
import { DatabaseService } from './database';

// Global OpenAI instance that can be updated
let openai: OpenAI;

// Function to get OpenAI API key from database
async function getOpenAIApiKey(): Promise<string> {
    try {
        const databaseService = DatabaseService.getInstance();
        const apiKeys = await databaseService.getApiKeys();
        
        if (apiKeys?.openaiKey) {
            console.log("Using OpenAI API key from database");
            return apiKeys.openaiKey;
        } else if (process.env['OPENAI_API_KEY']) {
            console.log("Using OpenAI API key from environment variables");
            return process.env['OPENAI_API_KEY'];
        } else {
            throw new Error("OpenAI API key is not configured. Please set it in the admin panel.");
        }
    } catch (error) {
        console.error("Error fetching OpenAI API key:", error);
        if (process.env['OPENAI_API_KEY']) {
            console.log("Falling back to environment variable");
            return process.env['OPENAI_API_KEY'];
        }
        throw new Error("OpenAI API key is not configured. Please set it in the admin panel.");
    }
}

// Initialize OpenAI with API key (can be updated later)
async function initializeOpenAI(apiKey?: string) {
    const key = apiKey || await getOpenAIApiKey();
    openai = new OpenAI({
        apiKey: key
    });
}

// Function to update the OpenAI client with a new API key
export function updateOpenAIModel(apiKey: string) {
    if (!apiKey) {
        console.warn("OpenAI API key is empty, using default");
        return;
    }
    
    console.log("Updating OpenAI client with new API key");
    openai = new OpenAI({
        apiKey: apiKey
    });
}

// -----------------------------------------------------------
// 🚨 MODIFIED: Fallback schema updated with all requested fields
// -----------------------------------------------------------
const fallbackSchema = z.object({
    // 💡 NEW/UPDATED FIELDS
    type: z.enum(["buy", "sell", "rent", "general"]), // Renamed from transaction_type
    property_type: z.string().optional().nullable(),
    location: z.string().optional().nullable(),
    price: z.number().optional().nullable(),
    bedrooms: z.number().optional().nullable(), // NEW
    bathrooms: z.number().optional().nullable(), // NEW
    size_sqft: z.number().optional().nullable(), // NEW
    message_date: z.string().optional().nullable(), // NEW (to hold the extracted date)
    
    // Existing fields
    note: z.string().optional().nullable(),
    is_from_group: z.boolean().optional().nullable(),
    client_sentiment: z.enum(["positive", "negative", "neutral"]).optional().nullable(),
    client_intent: z.enum(["high_interest", "low_interest", "lost_interest"]).optional().nullable(),
    client_status: z.enum(["Action Pending", "Response Awaiting", "Client Dropped"]).optional().nullable(),
});

// Function to get sheet fields from database
async function getSheetFields(): Promise<any[]> {
    try {
        const databaseService = DatabaseService.getInstance();
        const fields = await databaseService.getSheetFields();
        return fields || [];
    } catch (error) {
        console.error("Error fetching sheet fields:", error);
        return [];
    }
}

// Function to build dynamic schema based on sheet fields
async function buildDynamicSchema(): Promise<any> {
    const sheetFields = await getSheetFields();
    
    if (sheetFields.length === 0) {
        console.log("No sheet fields configured, using fallback schema");
        // Return union of single object or array for fallback
        return z.union([fallbackSchema, z.array(fallbackSchema)]);
    }
    
    // Build schema object dynamically from database fields
    const schemaFields: any = {};
    
    sheetFields.forEach(field => {
        let fieldSchema: any;
        
        switch (field.fieldType) {
            case 'text':
                fieldSchema = z.string().optional().nullable();
                break;
            case 'number':
                fieldSchema = z.number().optional().nullable();
                break;
            case 'date':
                fieldSchema = z.string().optional().nullable();
                break;
            case 'boolean':
                fieldSchema = z.boolean().optional();
                break;
            case 'enum':
                if (field.enumValues) {
                    try {
                        const enumValues = JSON.parse(field.enumValues);
                        if (Array.isArray(enumValues) && enumValues.length > 0) {
                            fieldSchema = z.enum(enumValues as [string, ...string[]]).optional().nullable();
                        } else {
                            fieldSchema = z.string().optional().nullable();
                        }
                    } catch {
                        fieldSchema = z.string().optional().nullable();
                    }
                } else {
                    fieldSchema = z.string().optional().nullable();
                }
                break;
            case 'array':
                fieldSchema = z.array(z.string()).optional().nullable();
                break;
            default:
                fieldSchema = z.string().optional().nullable();
        }
        
        schemaFields[field.fieldName] = fieldSchema;
    });

    // 🚨 Add fallback analysis and core fields if not present in sheet fields
    if (!schemaFields['type']) {
        schemaFields['type'] = z.enum(["buy", "sell", "rent", "general"]).optional().nullable(); // Ensure 'type' is present
    }
    if (!schemaFields['message_date']) {
        schemaFields['message_date'] = z.string().optional().nullable(); // Ensure 'message_date' is present
    }
    if (!schemaFields['bedrooms']) {
        schemaFields['bedrooms'] = z.number().optional().nullable(); // Ensure 'bedrooms' is present
    }
    if (!schemaFields['bathrooms']) {
        schemaFields['bathrooms'] = z.number().optional().nullable(); // Ensure 'bathrooms' is present
    }
    if (!schemaFields['size_sqft']) {
        schemaFields['size_sqft'] = z.number().optional().nullable(); // Ensure 'size_sqft' is present
    }
    if (!schemaFields['client_sentiment']) {
        schemaFields['client_sentiment'] = fallbackSchema.shape.client_sentiment;
    }
    if (!schemaFields['client_intent']) {
        schemaFields['client_intent'] = fallbackSchema.shape.client_intent;
    }
    if (!schemaFields['client_status']) {
        schemaFields['client_status'] = fallbackSchema.shape.client_status;
    }
    if (!schemaFields['is_from_group']) {
        schemaFields['is_from_group'] = fallbackSchema.shape.is_from_group;
    }
    
    const singleObjectSchema = z.object(schemaFields);
    
    // Return union of single object or array of objects to handle both cases
    return z.union([singleObjectSchema, z.array(singleObjectSchema)]);
}

// Function to build dynamic system prompt based on sheet fields
async function buildSystemPrompt(): Promise<string> {
    const sheetFields = await getSheetFields();
    
    let fieldsDescription = '';
    if (sheetFields.length > 0) {
        fieldsDescription = '\n# Output Schema\n';
        sheetFields.forEach(field => {
            const required = field.isRequired ? ' (Required)' : '';
            fieldsDescription += `- "${field.fieldName}": ${field.fieldType}${required}\n`;
            if (field.description) {
                fieldsDescription += `  ${field.description}\n`;
            }
            if (field.fieldType === 'enum' && field.enumValues) {
                try {
                    const enumValues = JSON.parse(field.enumValues);
                    if (Array.isArray(enumValues)) {
                        fieldsDescription += `  Allowed values: ${enumValues.join(', ')}\n`;
                    }
                } catch {}
            }
        });
        
        // 🚨 Append the new core and analysis fields manually to the description
        fieldsDescription += `- "message_date": date string | null (Extract the most likely date from the message)\n`;
        fieldsDescription += `- "bedrooms": number | null\n`;
        fieldsDescription += `- "bathrooms": number | null\n`;
        fieldsDescription += `- "size_sqft": number | null\n`;
        fieldsDescription += `- "is_from_group": boolean | null\n`;
        fieldsDescription += `- "client_sentiment": "positive" | "negative" | "neutral" | null (Sentiment of the client in the entire conversation)\n`;
        fieldsDescription += `- "client_intent": "high_interest" | "low_interest" | "lost_interest" | null (Prediction of client's likelihood to purchase/rent)\n`;
        fieldsDescription += `- "client_status": "Action Pending" | "Response Awaiting" | "Client Dropped" | null (Current status in the sales pipeline)\n`;

    } else {
        // 🚨 UPDATED FALLBACK DESCRIPTION
        fieldsDescription = `
# Output Schema
- "type": "buy" | "sell" | "rent" | "general" (The transaction type)
- "property_type": string | null
- "location": string | null
- "price": number | null
- "message_date": date string | null (Extract the most likely date from the message, e.g., '2024-05-15')
- "bedrooms": number | null
- "bathrooms": number | null
- "size_sqft": number | null (Property size in square feet)
- "note": string | null
- "is_from_group": boolean | null
- "client_sentiment": "positive" | "negative" | "neutral" | null
- "client_intent": "high_interest" | "low_interest" | "lost_interest" | null
- "client_status": "Action Pending" | "Response Awaiting" | "Client Dropped" | null
`;
    }
    
    return `
You are a real estate assistant tasked with analyzing user-provided messages and conversational history to extract detailed property information, **determine client sentiment**, **predict client intent**, and **identify the current Client Status**.

CRITICAL TASK: Analyze the combined context (new message and past messages) to determine property details, client sentiment, and pipeline status. The messages in the history are prefixed with 'Client:' or 'Agent:' to indicate the sender.

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

## New Sentiment and Intent Rules:
1. **Client Sentiment ("client_sentiment")**: Analyze the tone of the entire conversation (history + new message) to determine the client's current emotional state regarding the process.
    - **"positive"**: Eager, polite, asking for next steps, expressing satisfaction.
    - **"negative"**: Complaining, expressing frustration, using demanding language, showing doubt.
    - **"neutral"**: Simple inquiries, acknowledgments, or short answers that lack emotion.
2. **Client Intent ("client_intent")**: Predict the likelihood of the client moving forward with a transaction (buy/rent) based on the entire conversation history.
    - **"high_interest"**: Asking for viewing, discussing financing, making an offer, or consistently engaging positively.
    - **"low_interest"**: Slow to reply, vague answers, asking general non-specific questions, or sporadic engagement.
    - **"lost_interest"**: Explicitly stating they are no longer interested, or showing consistent negative sentiment and failure to commit.
3. **Client Status ("client_status")**: Determine the client's current status in the sales funnel based on the *sender of the last message* in the conversation history.
    - **"Response Awaiting"**: The **Agent** sent the last message in the history and the Client has **not replied in the new message**.
    - **"Action Pending"**: The **Client** sent the last message in the history and the **Agent needs to reply or take action**. (This includes the content of the new message being analyzed).
    - **"Client Dropped"**: The conversation has been silent for a long period (assume this if history is very old or intent is lost), OR the client explicitly stated **"not interested"**.

## Processing Rules:
1. **CRITICAL**: Multiple properties = JSON ARRAY, Single property = JSON OBJECT
2. **CRITICAL**: The message context will indicate if it is from a group chat. Extract this as a **boolean** value ("true" or "false") into the **"is_from_group"** field for ALL returned objects (both single and array).
3. **CRITICAL**: Populate the "client_sentiment", "client_intent", and "client_status" fields based on the provided conversation history and the new message.
4. Clean emojis and formatting symbols from extracted data
5. Convert prices to numbers only (remove currency symbols, k=thousands, m=millions)
6. Extract location, size, bedrooms, bathrooms, price for each property separately
7. Handle ANY message format - structured or unstructured
8. Contact information applies to all properties if mentioned once
9. If uncertain whether single or multiple, err on the side of multiple (return array)
10. Return valid JSON only - no explanatory text

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

// -----------------------------------------------------------
// 🚨 MODIFIED: Function signature updated to accept previousMessages
// -----------------------------------------------------------
export async function analyzeMessage(message: string, isGroup: boolean, previousMessages: string[] = []) {
    // Initialize OpenAI client if not already done or if API key is missing
    if (!openai || !openai.apiKey) {
        try {
            await initializeOpenAI();
        } catch (error) {
            console.error("Failed to initialize OpenAI client:", error);
            throw new Error("OpenAI API key is not configured. Please set it in the admin panel.");
        }
    }

    try {
        // Build dynamic prompt and schema
        const systemPrompt = await buildSystemPrompt();
        const dynamicSchema = await buildDynamicSchema();
        
        // 💡 CONTEXT STRING BUILDER
        const groupContext = isGroup 
            ? "The message originated from a GROUP CHAT (is_from_group should be true)." 
            : "The message originated from a direct INDIVIDUAL chat (is_from_group should be false).";

        // 💡 HISTORY CONTEXT BUILDER (using array for context)
        const historyContext = previousMessages.length > 0
            ? `\n\n--- Conversation History (Most Recent First, includes sender prefix) ---\n${previousMessages.join('\n')}\n----------------------------------------------------`
            : "\n\n(No recent conversation history available.)";

        const completion = await openai.chat.completions.create({
            model: "gpt-5-mini",
            messages: [
                {
                    role: "system",
                    content: systemPrompt
                },
                {
                    role: "user",
                    // 💡 UPDATED: Pass the group and history context to the user prompt
                    content: 
`Context: ${groupContext}${historyContext}
\n\n--- NEW MESSAGE TO ANALYZE (from Client) ---
Client: ${message}` // IMPORTANT: Prefix the new message as 'Client:' for Status rule 3 to work correctly
                }
            ],
            reasoning_effort:"low"
        });

        const response = completion.choices[0]?.message?.content;
        if (!response) {
            throw new Error("No response from OpenAI");
        }

        // Clean the response to extract JSON (remove any extra text)
        let cleanResponse = response.trim();
        
        // Try to extract JSON from the response if it contains extra text
        const jsonMatch = cleanResponse.match(/(\[.*\]|\{.*\})/s);
        if (jsonMatch && jsonMatch[1]) {
            cleanResponse = jsonMatch[1];
        }

        // Parse the JSON response
        const result = JSON.parse(cleanResponse);
        
        // Validate the result against our dynamic schema
        const validatedResult = dynamicSchema.parse(result);

        // Log the result type for debugging
        if (Array.isArray(validatedResult)) {
            console.log(`🔍 AI detected ${validatedResult.length} properties in the message`);
            console.log("🔍 Property types:", validatedResult.map((p: any) => p.property_type || p.type).join(', '));
            // 💡 Log all new fields
            if (validatedResult.length > 0) {
                const p = validatedResult[0];
                console.log(`🔍 is_from_group: ${p.is_from_group}, Sentiment: ${p.client_sentiment}, Intent: ${p.client_intent}, Status: ${p.client_status}`);
            }
        } else {
            console.log("🔍 AI detected 1 property in the message");
            console.log("🔍 Property type:", validatedResult.property_type || validatedResult.type);
            // 💡 Log all new fields
            console.log(`🔍 is_from_group: ${validatedResult.is_from_group}, Sentiment: ${validatedResult.client_sentiment}, Intent: ${validatedResult.client_intent}, Status: ${validatedResult.client_status}`);
        }

        return validatedResult;
    } catch (e: any) {
        console.error("Error analyzing message:", e);
        return {
            not_real_estate: "The message is not related to real estate or could not be parsed.",
            error: e.message || e.toString()
        };
    }
}