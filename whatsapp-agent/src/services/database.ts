import axios from "axios";
import { CONFIG } from "../config/constants";
import { WhatsAppSession } from "../types/whatsapp";

export interface ApiKeys {
  id?: string;
  googleSheetId?: string;
  openaiKey?: string;
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
    isLoggedIn: boolean, 
    lastAnalyzedMessageDate?: Date,
    lastProcessedMessageId?: string
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
      console.log("Fetching sheet fields from database...");
      const response = await axios.get(`${CONFIG.NEXT_APP_URL}/api/sheet-fields`, {
        headers: {
          Authorization: CONFIG.API_SECRET_KEY,
        },
      });
      console.log("Sheet fields fetched successfully:", response.data);
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
} 