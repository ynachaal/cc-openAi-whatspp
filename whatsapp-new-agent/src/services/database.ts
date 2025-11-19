import axios from "axios";
import { CONFIG } from "../config/constants";
import { WhatsAppSession } from "../types/whatsapp";
import { PrismaClient } from '@prisma/client';
export interface ApiKeys {
  id?: string;
  googleSheetId?: string;
  openaiKey?: string;
  googleClientEmail?: string;
  googlePrivateKey?: string;
  createdAt?: string;
  updatedAt?: string;
}

export class DatabaseService {
  private static instance: DatabaseService;

  private constructor() {}

  public static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  
  async updateWhatsAppSession(
    isLoggedIn?: boolean, 
    lastAnalyzedMessageDate?: Date,
    lastProcessedMessageId?: string,
    activeListeningGroups?: string[]
  ): Promise<void> {
    console.log("11111111", isLoggedIn, lastAnalyzedMessageDate, lastProcessedMessageId);
    try {
      console.log("Sending request with key:", CONFIG.API_SECRET_KEY);
      await axios.post(
        `${CONFIG.NEXT_APP_URL}/api/whatsapp`,
        {
          isLoggedIn,
          lastAnalyzedMessageDate,
          lastProcessedMessageId,
          activeListeningGroups,
        },
        {
          headers: {
            Authorization: CONFIG.API_SECRET_KEY,
          },
        }
      );
    } catch (error) {
      console.error("Failed to update WhatsApp session in database:", error);
      if (axios.isAxiosError(error)) {
        console.error("Response data:", error.response?.data);
        console.error("Response status:", error.response?.status);
      }
    }
  }

  async getWhatsAppSession(): Promise<WhatsAppSession> {
    try {
      console.log("Sending request with key:", CONFIG.API_SECRET_KEY);
      const response = await axios.get(`${CONFIG.NEXT_APP_URL}/api/whatsapp`, {
        headers: {
          Authorization: CONFIG.API_SECRET_KEY,
        },
      });
      return response.data;
    } catch (error) {
      console.error("Failed to get WhatsApp session from database:", error);
      if (axios.isAxiosError(error)) {
        console.error("Response data:", error.response?.data);
        console.error("Response status:", error.response?.status);
      }
      return { isLoggedIn: false };
    }
  }

  async getApiKeys(): Promise<ApiKeys | null> {
    try {
      console.log("Fetching API keys from database...");
      const response = await axios.get(`${CONFIG.NEXT_APP_URL}/api/api-keys`, {
        headers: {
          Authorization: CONFIG.API_SECRET_KEY,
        },
      });
      console.log("API keys fetched successfully:", response.data);
      return response.data;
    } catch (error) {
      console.error("Failed to get API keys from database:", error);
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 404) {
          console.log("No API keys found in database");
          return null;
        }
        console.error("Response data:", error.response?.data);
        console.error("Response status:", error.response?.status);
      }
      return null;
    }
  }

  async getSheetFields(): Promise<any[]> {
    try {
      const response = await axios.get(`${CONFIG.NEXT_APP_URL}/api/sheet-fields`, {
        headers: {
          Authorization: CONFIG.API_SECRET_KEY,
        },
      });
      return response.data;
    } catch (error) {
      console.error("Failed to get sheet fields from database:", error);
      if (axios.isAxiosError(error)) {
        console.error("Response data:", error.response?.data);
        console.error("Response status:", error.response?.status);
      }
      return [];
    }
  }

  async checkAuthenticationStatus(): Promise<boolean> {
    try {
      console.log("🔍 Checking authentication status from database...");
      const session = await this.getWhatsAppSession();
      const isLoggedIn = session.isLoggedIn || false;
      console.log(`📊 Database authentication status: ${isLoggedIn ? 'LOGGED IN' : 'NOT LOGGED IN'}`);
      return isLoggedIn;
    } catch (error) {
      console.error("❌ Failed to check authentication status:", error);
      return false; // Default to not logged in if there's an error
    }
  }

  async saveClientMessage(data: {
  clientName: string,
  number: string,
  direction: 'incoming' | 'outgoing',
  message: string,
  timestamp: Date,
  messageId?: string
}) {
  const prisma = new PrismaClient();
  return prisma.clientMessage.create({ data });
}
async getClientNameByNumber(number: string) {
  const prisma = new PrismaClient();
  const message = await prisma.clientMessage.findFirst({
    where: { number },
    orderBy: { timestamp: 'desc' },
    select: { clientName: true }
  });
  return message?.clientName || null;
}
async getLastThreeClientMessages(number: string) {
  const prisma = new PrismaClient();
  return prisma.clientMessage.findMany({
    where: { number },
    orderBy: { timestamp: 'desc' },
    take: 3
  });
}

async markMessageProcessed(id: string) {
  const prisma = new PrismaClient();
  return prisma.clientMessage.update({
    where: { id },
    data: { processed: true }
  });
}
async getClientMessageByMessageId(messageId: string) {
    const prisma = new PrismaClient();
  return prisma.clientMessage.findUnique({ where: { messageId } });
}
}
