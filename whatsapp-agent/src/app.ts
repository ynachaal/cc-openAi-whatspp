import "dotenv/config";
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import { WebSocketServer } from "ws";
import { createServer } from "http";
import { CONFIG } from "./config/constants";
import { ValidationMiddleware } from "./middleware/validationMiddleware";
import { WebSocketHandler } from "./handlers/websocketHandler";
import { WhatsAppClientService } from "./services/whatsappClient";
import { DatabaseService, ApiKeys } from "./services/database";
import { PeriodicTaskManager } from "./services/periodicTaskManager";
import { RestartManager } from "./services/restartManager";
import { updateOpenAIModel } from "./agent";
import { updateGoogleSheetId } from "./googleSheets";

export class WhatsAppAgentApp {
  private static instance: WhatsAppAgentApp;
  private app: express.Application;
  private server: any;
  private wss: WebSocketServer;
  private whatsappService: WhatsAppClientService;
  private databaseService: DatabaseService;
  private periodicTaskManager: PeriodicTaskManager;
  private restartManager: RestartManager;
  private webSocketHandler: WebSocketHandler;
  private apiKeys: ApiKeys | null = null;

  private constructor() {
    this.app = express();
    this.server = createServer(this.app);
    this.wss = new WebSocketServer({ server: this.server });
    
    // Initialize services
    this.whatsappService = WhatsAppClientService.getInstance();
    this.databaseService = DatabaseService.getInstance();
    this.periodicTaskManager = PeriodicTaskManager.getInstance();
    this.restartManager = RestartManager.getInstance();
    this.webSocketHandler = WebSocketHandler.getInstance();

    this.setupMiddleware();
    this.setupWebSocket();
    this.initializeOnStart();
  }

  public static getInstance(): WhatsAppAgentApp {
    if (!WhatsAppAgentApp.instance) {
      WhatsAppAgentApp.instance = new WhatsAppAgentApp();
    }
    return WhatsAppAgentApp.instance;
  }

  private setupMiddleware(): void {
    // this.app.use(cors(ValidationMiddleware.getCorsOptions()));
    // this.app.use(ValidationMiddleware.validateOrigin);
    this.app.use(bodyParser.json());
    this.app.use(bodyParser.urlencoded({ extended: true }));
    
    // Add restart cycle status endpoint
    this.app.get('/api/restart-status', (req, res) => {
      const uptimeInfo = this.restartManager.getUptimeInfo();
      res.json({
        restartCount: this.restartManager.getRestartCount(),
        totalRestarts: this.restartManager.getTotalRestarts(),
        uptime: uptimeInfo.runningTime,
        nextRestartIn: CONFIG.HOURLY_RESTART_INTERVAL / 1000 / 60, // minutes
        status: "Running indefinitely - maintaining connection stability"
      });
    });
  }

  private setupWebSocket(): void {
    this.wss.on("connection", (ws, req) => {
      console.log("New WebSocket connection established", this.whatsappService.currentQrCode, 11);
      this.webSocketHandler.handleConnection(ws, req);
      setTimeout(() => {
        this.whatsappService.sendQrCodeToWebSocket(ws);
      }, 1000);
    });
  }

  private async initializeOnStart(): Promise<void> {
    try {
      // Fetch API keys first
      this.apiKeys = await this.databaseService.getApiKeys();
      if (this.apiKeys) {
        console.log("API keys loaded successfully");
        console.log("Google Sheets ID:", this.apiKeys.googleSheetId ? "Configured" : "Not configured");
        console.log("OpenAI Key:", this.apiKeys.openaiKey ? "Configured" : "Not configured");
        
        // Update services with the API keys
        this.updateServicesWithApiKeys();
      } else {
        console.log("No API keys found in database");
      }

      const session = await this.databaseService.getWhatsAppSession();
      console.log("Session:", session);
      if (session.isLoggedIn) {
        await this.whatsappService.initialize();
        
        // Start historical message analysis in background
        setTimeout(() => {
          this.whatsappService.analyzeMessagesSinceLastDate().catch(error => {
            console.error("Error in background message analysis:", error);
          });
        }, 5000);
        
                 // Start message processing (historical analysis only)
         // this.periodicTaskManager.startPeriodicMessageCheck();
        
        // Start the hourly restart cycle
        console.log("🔄 Starting hourly restart cycle...");
        this.restartManager.startHourlyRestartCycle();
      }
    } catch (error) {
      console.error("Failed to initialize WhatsApp on server start:", error);
    }
  }

  // Update services with current API keys
  private updateServicesWithApiKeys(): void {
    if (this.apiKeys?.openaiKey) {
      updateOpenAIModel(this.apiKeys.openaiKey);
    }
    
    if (this.apiKeys?.googleSheetId) {
      updateGoogleSheetId(this.apiKeys.googleSheetId);
    }
  }

  // Getter method to access API keys from other services
  public getApiKeys(): ApiKeys | null {
    return this.apiKeys;
  }

  // Method to refresh API keys
  public async refreshApiKeys(): Promise<void> {
    try {
      this.apiKeys = await this.databaseService.getApiKeys();
      console.log("API keys refreshed successfully");
      
      // Update services with new API keys
      this.updateServicesWithApiKeys();
    } catch (error) {
      console.error("Failed to refresh API keys:", error);
    }
  }

  start(): void {
    this.server.listen(CONFIG.PORT, () => {
      console.log(`Server is running on port ${CONFIG.PORT}`);
    });
  }

  stop(): void {
    this.periodicTaskManager.stopPeriodicMessageCheck();
    this.restartManager.stopHourlyRestartCycle();
    this.whatsappService.close();
    this.server.close();
  }
} 