import { analyzeMessage } from "./agent";
import { sendToGoogleSheet } from "./googleSheets";
import { CONFIG } from "../config/constants";
import { UserInfo } from "../types/whatsapp";
import WAWebJS, { Message } from "whatsapp-web.js";

export class MessageProcessor {
    private static instance: MessageProcessor;

    private constructor() { }

    private isOutgoing(message: Message): boolean {
        return message.fromMe === true;
    }

    private isAdminInitiating(message: Message): boolean {
        return this.isOutgoing(message) && !this.isGroupMessage(message);
    }

    public static getInstance(): MessageProcessor {
        if (!MessageProcessor.instance) {
            MessageProcessor.instance = new MessageProcessor();
        }
        return MessageProcessor.instance;
    }

    private async extractUserInfo(message: WAWebJS.Message): Promise<UserInfo> {
        try {
            // ... (existing phone extraction logic - omitted for brevity)

            const contact = await message.getContact();

            // 1. Prioritize the most reliable name fields (Verified, Custom Saved Name)
            let name = contact?.verifiedName || contact?.name;

            // 2. Fallback to common chat/push name
            if (!name) {
                name = contact?.pushname || (message as any)?._data?.notifyName;
            }

            // 3. Last fallback (e.g., if message is from a group and 'author' has a name)
            if (!name) {
                name = (message as WAWebJS.Message).author;
            }

            // 4. Default if all else fails
            if (!name) {
                name = "Unknown";
            }

            // 5. Clean up extra whitespace that may be left over
            name = name.trim();

            console.log(`👤 User info - Phone: ${contact.number}, Name: ${name}`, contact);
            return { phone: contact.number, name };

        } catch (error) {
            console.error("Error getting user info:", error);
            // ... (Error return logic - omitted for brevity)
            return {
                phone: message.from.replace("@c.us", "").replace("@g.us", ""),
                name: "Unknown",
            };
        }
    }

    // 💡 NEW HELPER METHOD
    private isGroupMessage(message: Message): boolean {
        // WhatsApp Web.js uses '@g.us' suffix for group chats
        return message.from.endsWith('@g.us');
    }

    private createTimestampFromMessage(message: Message): Date | null {
        // Check if timestamp is in seconds or milliseconds
        if (message.timestamp.toString().length === 10) {
            // Timestamp is in seconds, convert to milliseconds
            return new Date(message.timestamp * 1000);
        } else {
            // Timestamp is already in milliseconds
            return new Date(message.timestamp);
        }
    }

    private validateTimestamp(timestamp: Date): boolean {
        if (
            isNaN(timestamp.getTime()) ||
            timestamp.getFullYear() < 1970 ||
            timestamp.getFullYear() > 2100
        ) {
            console.error(`❌ Invalid timestamp: ${timestamp}, skipping date update`);
            return false;
        }
        return true;
    }

    async processMessage(
        message: Message,
        whatsappNumber: string
    ): Promise<{ timestamp: Date; messageId: string } | null> {
        console.log(
            `📨 Processing message from ${message.from} (listening to: ${whatsappNumber})`
        );


        // ✅ Allow both incoming user messages and your own outgoing messages
        if (!message.fromMe && !message.from.includes(whatsappNumber)) {
            console.log(`⚠️ Skipping message from unknown source: ${message.from}`);
            return null;
        }

        const messageBody = message.body;

        console.log(`📝 Message body: "${messageBody}"`);

        // Skip very short messages (less than configured minimum)
        if (messageBody.length < CONFIG.MIN_MESSAGE_LENGTH) {
            console.log(
                `⏭️  Skipping short message (${messageBody.length}/${CONFIG.MIN_MESSAGE_LENGTH} chars): "${messageBody}"`
            );
            return null;
        }

        console.log(
            `🔍 Processing message (${messageBody.length
            } chars): "${messageBody.substring(0, 100)}${messageBody.length > 100 ? "..." : ""
            }"`
        );

        // Get user information
        const userInfo = await this.extractUserInfo(message);

        // 💡 NEW/FIXED: Determine group status and pass it to analyzeMessage
        const isGroup = this.isGroupMessage(message);
        const analysis = await analyzeMessage(messageBody, isGroup);

        // Send all messages to Google Sheet (including general messages)
        if (this.isAdminInitiating(message)) {
            console.log("📌 Admin initiated conversation, adding user to client sheet");

            await sendToGoogleSheet(
                { category: "admin_initiated" },
                userInfo,
                messageBody,
                message.timestamp
            );
        }
        console.log("📊 Sending message analysis to Google Sheet");
        await sendToGoogleSheet(analysis, userInfo, messageBody, message.timestamp);

        // Create and validate timestamp
        const timestampToSave = this.createTimestampFromMessage(message);
        if (!timestampToSave || !this.validateTimestamp(timestampToSave)) {
            return null;
        }

        console.log(`📅 Saving timestamp: ${timestampToSave.toISOString()}`);
        return { timestamp: timestampToSave, messageId: message.id._serialized };
    }

    async processHistoricalMessage(
        message: Message,
        lastAnalyzedDate: Date
    ): Promise<{ timestamp: Date; messageId: string } | null> {
        // Skip messages that are too short
        if (!message.body || message.body.length < CONFIG.MIN_MESSAGE_LENGTH) {
            return null;
        }

        // Skip messages older than or equal to the last analyzed date
        const messageDate = new Date(message.timestamp * 1000);
        if (messageDate <= lastAnalyzedDate) {
            return null;
        }

        console.log(
            `🔍 Analyzing message from ${messageDate.toISOString()}: "${message.body.substring(
                0,
                100
            )}${message.body.length > 100 ? "..." : ""}"`
        );

        // Get user information
        const userInfo = await this.extractUserInfo(message);

        // 💡 NEW/FIXED: Determine group status and pass it to analyzeMessage
        const isGroup = this.isGroupMessage(message);
        const analysis = await analyzeMessage(message.body, isGroup);

        // Send all messages to Google Sheet (including general messages)
        console.log("📊 Sending historical message analysis to Google Sheet");
        await sendToGoogleSheet(
            analysis,
            userInfo,
            message.body,
            message.timestamp
        );

        // Create and validate timestamp
        const timestampToSave = this.createTimestampFromMessage(message);
        if (!timestampToSave || !this.validateTimestamp(timestampToSave)) {
            return null;
        }

        console.log(`📅 Saving timestamp: ${timestampToSave.toISOString()}`);
        return { timestamp: timestampToSave, messageId: message.id._serialized };
    }
}