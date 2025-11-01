import { analyzeMessage } from "./agent";
import { sendToGoogleSheet } from "./googleSheets";
import { CONFIG } from "../config/constants";
import { UserInfo } from "../types/whatsapp";
import WAWebJS, { Message } from "whatsapp-web.js";

export class MessageProcessor {
  private static instance: MessageProcessor;

  private constructor() {}

  public static getInstance(): MessageProcessor {
    if (!MessageProcessor.instance) {
      MessageProcessor.instance = new MessageProcessor();
    }
    return MessageProcessor.instance;
  }

  private async extractUserInfo(message: WAWebJS.Message): Promise<UserInfo> {
    try {
      // Extract phone number from message.from (remove @c.us suffix if present)
      let phone = "";

      // For WhatsApp Web.js Message objects, use message.from
      if ((message as Message).from) {
        phone =
          (message as Message).from
            ?.replace("@c.us", "")
            .replace("@g.us", "") || "";
      }
      // For WhatsAppMessage objects, try sender.id.user
      else if (message?.id?.remote) {
        const userId = message?.id?.remote;
        phone = userId?.replace("@c.us", "").replace("@g.us", "") || "";
      }
      // Fallback to author if available
      else if ((message as Message).author) {
        phone =
          (message as Message).author
            ?.replace("@c.us", "")
            .replace("@g.us", "") || "";
      }

      // Get name from sender object (try different name fields)
      const contact = await message.getContact();
      const name =
        // whatsappMessage.sender?.pushname||"" +
        // whatsappMessage.sender?.name||"" +
        // whatsappMessage.sender?.shortName||"" +
        (contact?.pushname||"") + " " +
        (message.author||"") + " " +
        (contact?.name||"") + " " +
        (contact?.verifiedName||"") + " " +
        ((message as any)?._data?.notifyName || "") || "Unknown";

      console.log(`👤 User info - Phone: ${phone}, Name: ${name}`,contact);
      return { phone:contact.number, name };
    } catch (error) {
      console.error("Error getting user info:", error);
      return {
        phone: message.from.replace("@c.us", "").replace("@g.us", ""),
        name: "Unknown",
      };
    }
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

    // Since the message is already filtered by the client service, we can process it directly
    // But we still validate to ensure it's from the expected number
    if (
      message.from !== whatsappNumber &&
      !message.from.includes(whatsappNumber)
    ) {
      console.log(
        `⚠️ Message from ${message.from} doesn't match expected number ${whatsappNumber}, skipping`
      );
      return null;
    }

    const messageBody = message.body;
    // console.log(
    //   "messageBody==== \n\n\n\n",
    //   JSON.stringify(message),
    //   "\n\n\n\n"
    // );
    // Skip very short messages (less than configured minimum)
    if (messageBody.length < CONFIG.MIN_MESSAGE_LENGTH) {
      console.log(
        `⏭️  Skipping short message (${messageBody.length}/${CONFIG.MIN_MESSAGE_LENGTH} chars): "${messageBody}"`
      );
      return null;
    }

    console.log(
      `🔍 Processing message (${
        messageBody.length
      } chars): "${messageBody.substring(0, 100)}${
        messageBody.length > 100 ? "..." : ""
      }"`
    );

    // Get user information
    const userInfo = await this.extractUserInfo(message);

    // Analyze the message with AI
    const analysis = await analyzeMessage(messageBody);
    // Send all messages to Google Sheet (including general messages)
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

    // Analyze the message with AI
    const analysis = await analyzeMessage(message.body);

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
