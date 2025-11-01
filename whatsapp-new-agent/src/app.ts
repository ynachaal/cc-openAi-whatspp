import express from "express";
import cors from "cors";
import * as bodyParser from "body-parser";
import { WebSocketServer } from "ws";
import { createServer } from "http";
import { CONFIG } from "./config/constants";
import { WebSocketHandler } from "./handlers/websocketHandler";

export class WhatsAppNewAgentApp {
  private static instance: WhatsAppNewAgentApp;
  private app: express.Application;
  private server: any;
  private wss: WebSocketServer;
  private webSocketHandler: WebSocketHandler;

  private constructor() {
    this.app = express();
    this.server = createServer(this.app);
    this.wss = new WebSocketServer({ server: this.server });
    
    // Initialize services
    this.webSocketHandler = WebSocketHandler.getInstance();

    this.setupMiddleware();
    this.setupWebSocket();
  }

  public static getInstance(): WhatsAppNewAgentApp {
    if (!WhatsAppNewAgentApp.instance) {
      WhatsAppNewAgentApp.instance = new WhatsAppNewAgentApp();
    }
    return WhatsAppNewAgentApp.instance;
  }

  private setupMiddleware(): void {
    this.app.use(cors());
    this.app.use(bodyParser.json());
    this.app.use(bodyParser.urlencoded({ extended: true }));
    
    // Health check endpoint
    this.app.get('/health', (_req, res) => {
      res.json({
        status: "ok",
        service: "whatsapp-new-agent",
        port: CONFIG.PORT,
        timestamp: new Date().toISOString()
      });
    });

    // Status endpoint
    this.app.get('/status', (_req, res) => {
      res.json({
        service: "whatsapp-new-agent",
        version: "1.0.0",
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        timestamp: new Date().toISOString()
      });
    });
  }

  private setupWebSocket(): void {
    this.wss.on("connection", (ws, req) => {
      console.log("New WebSocket connection established");
      this.webSocketHandler.handleConnection(ws, req);
    });
  }

  async start(): Promise<void> {
    this.server.listen(CONFIG.PORT, async () => {
      console.log(`🚀 WhatsApp New Agent WebSocket Server is running on port ${CONFIG.PORT}`);
      console.log(`📡 WebSocket endpoint: ws://localhost:${CONFIG.PORT}`);
      console.log(`🌐 Health check: http://localhost:${CONFIG.PORT}/health`);
      console.log(`📊 Status: http://localhost:${CONFIG.PORT}/status`);
      
      // Initialize WhatsApp agent immediately on server startup
      console.log('🔄 Initializing WhatsApp agent on server startup...');
      await this.webSocketHandler.initializeAgentOnStartup();
    });
  }

  stop(): void {
    console.log("🛑 Stopping WhatsApp New Agent WebSocket Server...");
    this.server.close(() => {
      console.log("✅ Server stopped successfully");
    });
  }
}
