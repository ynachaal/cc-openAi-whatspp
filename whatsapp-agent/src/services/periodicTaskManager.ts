import { CONFIG } from "../config/constants";
import { WhatsAppClientService } from "./whatsappClient";

export class PeriodicTaskManager {
  private static instance: PeriodicTaskManager;
  private whatsappService: WhatsAppClientService;

  private constructor() {
    this.whatsappService = WhatsAppClientService.getInstance();
  }

  public static getInstance(): PeriodicTaskManager {
    if (!PeriodicTaskManager.instance) {
      PeriodicTaskManager.instance = new PeriodicTaskManager();
    }
    return PeriodicTaskManager.instance;
  }

  /**
   * Stop message processing (no interval to clear)
   */
  stopPeriodicMessageCheck(): void {
    console.log("⏹️  Stopped message processing");
  }

  /**
   * Check if message processing is running
   */
  isPeriodicCheckRunning(): boolean {
    // Since we don't use intervals anymore, always return false
    // This method is kept for backward compatibility
    return false;
  }

  /**
   * Run historical analysis once to catch missed messages
   */
  private async runHistoricalAnalysisOnce(): Promise<void> {
    try {
      const whatsappConnected = await this.whatsappService.isConnected();
      if (whatsappConnected && this.whatsappService.getWhatsAppNumbers().length > 0) {
        console.log("🔍 Running historical message analysis to catch missed messages...");
        await this.whatsappService.analyzeMessagesSinceLastDate();
        console.log("✅ Historical analysis completed");
      } else {
        console.log("⏭️  Skipping historical analysis - WhatsApp client or numbers not available");
      }
    } catch (error) {
      console.error("❌ Error in historical message analysis:", error);
    }
  }
} 