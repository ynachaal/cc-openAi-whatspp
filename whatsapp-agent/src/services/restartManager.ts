import { CONFIG } from "../config/constants";
import { getRestartConfig } from "../config/restartConfig";
import { WhatsAppClientService } from "./whatsappClient";
import { DatabaseService } from "./database";
import { PeriodicTaskManager } from "./periodicTaskManager";

export class RestartManager {
  private static instance: RestartManager;
  private restartInterval: NodeJS.Timeout | null = null;
  private whatsappService: WhatsAppClientService;
  private databaseService: DatabaseService;
  private periodicTaskManager: PeriodicTaskManager;
  private restartCount: number = 0;
  private readonly restartConfig = getRestartConfig();

  private constructor() {
    this.whatsappService = WhatsAppClientService.getInstance();
    this.databaseService = DatabaseService.getInstance();
    this.periodicTaskManager = PeriodicTaskManager.getInstance();
  }

  public static getInstance(): RestartManager {
    if (!RestartManager.instance) {
      RestartManager.instance = new RestartManager();
    }
    return RestartManager.instance;
  }

  /**
   * Start the hourly restart cycle
   */
  startHourlyRestartCycle(): void {
    // Clear existing interval if any
    if (this.restartInterval) {
      clearInterval(this.restartInterval);
    }

    console.log("🔄 Starting hourly WhatsApp restart cycle...");
    console.log(`⏰ Will restart every ${this.restartConfig.HOURLY_RESTART_INTERVAL / 1000 / 60} minutes`);
    console.log(`♾️ Restart cycle will run indefinitely to maintain connection stability`);

    this.restartInterval = setInterval(async () => {
      await this.performHourlyRestart();
    }, this.restartConfig.HOURLY_RESTART_INTERVAL);
  }

  /**
   * Stop the restart cycle
   */
  stopHourlyRestartCycle(): void {
    if (this.restartInterval) {
      clearInterval(this.restartInterval);
      this.restartInterval = null;
      console.log("⏹️ Stopped hourly restart cycle");
    }
  }

  /**
   * Perform the hourly restart process
   */
  private async performHourlyRestart(): Promise<void> {
    try {
      this.restartCount++;
      console.log(`🔄 Starting restart cycle ${this.restartCount} - maintaining connection stability`);

             // Step 1: Stop message processing
       console.log("⏹️ Stopping message processing...");
       this.periodicTaskManager.stopPeriodicMessageCheck();

             // Step 2: Reload WhatsApp page
       console.log("🔄 Reloading WhatsApp page...");
       await this.whatsappService.reload();

             // Step 3: Wait a moment for page reload
       console.log("⏳ Waiting for page reload to complete...");
       await new Promise(resolve => setTimeout(resolve, this.restartConfig.CLEANUP_DELAY));

       // Step 4: Continue with restart cycle (no shutdown)
       console.log(`🔄 Continuing restart cycle ${this.restartCount} - maintaining connection stability`);

       // Step 5: Verify WhatsApp connection is stable
       console.log("🔍 Verifying WhatsApp connection stability...");
       const success = await this.whatsappService.isConnected();
      
             if (success) {
         console.log("✅ WhatsApp connection verified and stable");
         
         // Step 6: Run historical message analysis (if enabled)
         if (this.restartConfig.RUN_HISTORICAL_ANALYSIS_AFTER_RESTART) {
           console.log("🔍 Running historical message analysis...");
           await this.whatsappService.analyzeMessagesSinceLastDate();
         } else {
           console.log("⏭️ Skipping historical message analysis (disabled in config)");
         }
         
         console.log(`✅ Restart cycle ${this.restartCount} completed successfully`);
       } else {
         console.error("❌ WhatsApp connection verification failed");
         // Continue with the cycle even if verification fails
       }

    } catch (error) {
      console.error(`❌ Error during restart cycle ${this.restartCount}:`, error);
      // Continue with the cycle even if there's an error
    }
  }



  /**
   * Get current restart count
   */
  getRestartCount(): number {
    return this.restartCount;
  }

  /**
   * Get total restart count since start
   */
  getTotalRestarts(): number {
    return this.restartCount;
  }

  /**
   * Get uptime information
   */
  getUptimeInfo(): { restartCount: number; runningTime: string } {
    const runningHours = Math.floor(this.restartCount);
    const runningTime = `${runningHours} hour${runningHours !== 1 ? 's' : ''}`;
    return { restartCount: this.restartCount, runningTime };
  }

  /**
   * Reset restart count (useful for testing)
   */
  resetRestartCount(): void {
    this.restartCount = 0;
    console.log("🔄 Restart count reset to 0");
  }
}
