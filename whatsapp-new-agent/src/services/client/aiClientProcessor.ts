import OpenAI from "openai";
import { z } from "zod";
import { DatabaseService } from '../database';

let openai: OpenAI;

export async function updateAIKey(apiKey?: string) {
  if (!apiKey) return;
  openai = new OpenAI({ apiKey });
  console.log("OpenAI client updated with new API key");
}

async function initAI() {
  if (!openai) {
    let key: string | undefined;
    try {
      const dbKey = await DatabaseService.getInstance().getApiKeys();
      key = dbKey?.openaiKey || process.env['OPENAI_API_KEY'];
    } catch {
      key = process.env['OPENAI_API_KEY'];
    }
    if (!key) throw new Error("Missing OPENAI_API_KEY");
    openai = new OpenAI({ apiKey: key });
  }
}

function buildPrompt(message: string, isGroup: boolean, history: string[]) {

  const historyBlock = history.length > 0 ? history.join("\n") : "(No conversation history available)";

  return `Analyze the client's latest message and conversation context.

${historyBlock}

--- New Message ---
Client: ${message}

--- Additional Context ---
is_from_group = ${isGroup}

--- Additional Instructions ---
Determine if this message introduces a NEW PROPERTY THREAD.

CRITICAL RULE:
If the new message contains ZERO property-related fields:
→ is_new_property_thread = false

A message IS a new property thread ONLY IF:
1. The message contains at least one property-related field
AND
2. Those fields describe a *different* property than the one in conversation history.

--- Sentiment Rules ---
Classify client_sentiment strictly using these rules:

"Not Interested": rejection or no further interest.
"Highly Interested": strong buying signals.
"Interested": positive tone, wants details.
"Neutral": generic replies ("ok", "tell me", etc).
"Confused": doesn't understand.
"Frustrated": annoyance visible.
"Exploring Options": comparing or undecided.
"Price Sensitive": comments about high price / discount request.
"Urgent Request": urgent need / immediate action.

Return ONLY valid JSON following this schema:
(property_name, property_type, location, price, bedrooms, bathrooms, size_sqft, message_date, client_sentiment, client_intent, is_from_group, is_new_property_thread)
`;
}


const fallbackSchema = z.object({
  property_name: z.string().optional().nullable(),
  property_type: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  price: z.number().optional().nullable(),
  bedrooms: z.number().optional().nullable(),
  bathrooms: z.number().optional().nullable(),
  size_sqft: z.number().optional().nullable(),
  message_date: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
  is_from_group: z.boolean().optional().nullable(),
  client_sentiment: z.enum([
    "Interested", "Highly Interested", "Not Interested", "Confused",
    "Frustrated", "Neutral", "Exploring Options", "Price Sensitive", "Urgent Request"
  ]).optional().nullable(),
  client_intent: z.enum(["high_interest","medium_interest","low_interest","lost_interest"]).optional().nullable(),
  propertyId: z.string().optional(),
  is_new_property_thread: z.boolean().optional().nullable(), 
});

export async function analyzeMessage(
  message: string,
  isGroup: boolean = false,
  previousMessages: string[] = []
) {
  await initAI();

  const prompt = buildPrompt(message, isGroup, previousMessages);

  const result = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: "You analyze real estate WhatsApp messages. Return structured JSON only." },
      { role: "user", content: prompt }
    ],
    temperature: 0.3,
  });

  const rawResponse = result.choices[0]?.message?.content?.trim() || "";
  const match = rawResponse.match(/(\{.*\}|\[.*\])/s);
  const jsonString = match?.[1] ?? "{}";

  let parsed: any;
  try {
    parsed = JSON.parse(jsonString);
  } catch (err) {
    console.error("JSON parse error:", jsonString, err);
    parsed = { error: "Invalid JSON", raw: jsonString };
  }

  const parsedArray = Array.isArray(parsed) ? parsed : [parsed];

  return parsedArray.map(p => 
    fallbackSchema.safeParse(p).success ? p : { raw: p }
  );
}
