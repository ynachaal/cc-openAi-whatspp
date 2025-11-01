"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WhatsAppAgentApp = void 0;
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const body_parser_1 = __importDefault(require("body-parser"));
const ws_1 = require("ws");
const http_1 = require("http");
const constants_1 = require("./config/constants");
const websocketHandler_1 = require("./handlers/websocketHandler");
const whatsappClient_1 = require("./services/whatsappClient");
const database_1 = require("./services/database");
const periodicTaskManager_1 = require("./services/periodicTaskManager");
const restartManager_1 = require("./services/restartManager");
const agent_1 = require("./agent");
const googleSheets_1 = require("./googleSheets");
class WhatsAppAgentApp {
    constructor() {
        this.apiKeys = null;
        this.app = (0, express_1.default)();
        this.server = (0, http_1.createServer)(this.app);
        this.wss = new ws_1.WebSocketServer({ server: this.server });
        // Initialize services
        this.whatsappService = whatsappClient_1.WhatsAppClientService.getInstance();
        this.databaseService = database_1.DatabaseService.getInstance();
        this.periodicTaskManager = periodicTaskManager_1.PeriodicTaskManager.getInstance();
        this.restartManager = restartManager_1.RestartManager.getInstance();
        this.webSocketHandler = websocketHandler_1.WebSocketHandler.getInstance();
        this.setupMiddleware();
        this.setupWebSocket();
        this.initializeOnStart();
    }
    static getInstance() {
        if (!WhatsAppAgentApp.instance) {
            WhatsAppAgentApp.instance = new WhatsAppAgentApp();
        }
        return WhatsAppAgentApp.instance;
    }
    setupMiddleware() {
        // this.app.use(cors(ValidationMiddleware.getCorsOptions()));
        // this.app.use(ValidationMiddleware.validateOrigin);
        this.app.use(body_parser_1.default.json());
        this.app.use(body_parser_1.default.urlencoded({ extended: true }));
        // Add restart cycle status endpoint
        this.app.get('/api/restart-status', (req, res) => {
            const uptimeInfo = this.restartManager.getUptimeInfo();
            res.json({
                restartCount: this.restartManager.getRestartCount(),
                totalRestarts: this.restartManager.getTotalRestarts(),
                uptime: uptimeInfo.runningTime,
                nextRestartIn: constants_1.CONFIG.HOURLY_RESTART_INTERVAL / 1000 / 60, // minutes
                status: "Running indefinitely - maintaining connection stability"
            });
        });
    }
    setupWebSocket() {
        this.wss.on("connection", (ws, req) => {
            console.log("New WebSocket connection established", this.whatsappService.currentQrCode, 11);
            this.webSocketHandler.handleConnection(ws, req);
            setTimeout(() => {
                this.whatsappService.sendQrCodeToWebSocket(ws);
            }, 1000);
        });
    }
    async initializeOnStart() {
        try {
            // Fetch API keys first
            this.apiKeys = await this.databaseService.getApiKeys();
            if (this.apiKeys) {
                console.log("API keys loaded successfully");
                console.log("Google Sheets ID:", this.apiKeys.googleSheetId ? "Configured" : "Not configured");
                console.log("OpenAI Key:", this.apiKeys.openaiKey ? "Configured" : "Not configured");
                // Update services with the API keys
                this.updateServicesWithApiKeys();
            }
            else {
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
        }
        catch (error) {
            console.error("Failed to initialize WhatsApp on server start:", error);
        }
    }
    // Update services with current API keys
    updateServicesWithApiKeys() {
        if (this.apiKeys?.openaiKey) {
            (0, agent_1.updateOpenAIModel)(this.apiKeys.openaiKey);
        }
        if (this.apiKeys?.googleSheetId) {
            (0, googleSheets_1.updateGoogleSheetId)(this.apiKeys.googleSheetId);
        }
    }
    // Getter method to access API keys from other services
    getApiKeys() {
        return this.apiKeys;
    }
    // Method to refresh API keys
    async refreshApiKeys() {
        try {
            this.apiKeys = await this.databaseService.getApiKeys();
            console.log("API keys refreshed successfully");
            // Update services with new API keys
            this.updateServicesWithApiKeys();
        }
        catch (error) {
            console.error("Failed to refresh API keys:", error);
        }
    }
    start() {
        this.server.listen(constants_1.CONFIG.PORT, () => {
            console.log(`Server is running on port ${constants_1.CONFIG.PORT}`);
        });
    }
    stop() {
        this.periodicTaskManager.stopPeriodicMessageCheck();
        this.restartManager.stopHourlyRestartCycle();
        this.whatsappService.close();
        this.server.close();
    }
}
exports.WhatsAppAgentApp = WhatsAppAgentApp;
