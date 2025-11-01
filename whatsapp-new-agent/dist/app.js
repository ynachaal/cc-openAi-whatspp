"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WhatsAppNewAgentApp = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const bodyParser = __importStar(require("body-parser"));
const ws_1 = require("ws");
const http_1 = require("http");
const constants_1 = require("./config/constants");
const websocketHandler_1 = require("./handlers/websocketHandler");
class WhatsAppNewAgentApp {
    constructor() {
        this.app = (0, express_1.default)();
        this.server = (0, http_1.createServer)(this.app);
        this.wss = new ws_1.WebSocketServer({ server: this.server });
        // Initialize services
        this.webSocketHandler = websocketHandler_1.WebSocketHandler.getInstance();
        this.setupMiddleware();
        this.setupWebSocket();
    }
    static getInstance() {
        if (!WhatsAppNewAgentApp.instance) {
            WhatsAppNewAgentApp.instance = new WhatsAppNewAgentApp();
        }
        return WhatsAppNewAgentApp.instance;
    }
    setupMiddleware() {
        this.app.use((0, cors_1.default)());
        this.app.use(bodyParser.json());
        this.app.use(bodyParser.urlencoded({ extended: true }));
        // Health check endpoint
        this.app.get('/health', (_req, res) => {
            res.json({
                status: "ok",
                service: "whatsapp-new-agent",
                port: constants_1.CONFIG.PORT,
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
    setupWebSocket() {
        this.wss.on("connection", (ws, req) => {
            console.log("New WebSocket connection established");
            this.webSocketHandler.handleConnection(ws, req);
        });
    }
    async start() {
        this.server.listen(constants_1.CONFIG.PORT, async () => {
            console.log(`🚀 WhatsApp New Agent WebSocket Server is running on port ${constants_1.CONFIG.PORT}`);
            console.log(`📡 WebSocket endpoint: ws://localhost:${constants_1.CONFIG.PORT}`);
            console.log(`🌐 Health check: http://localhost:${constants_1.CONFIG.PORT}/health`);
            console.log(`📊 Status: http://localhost:${constants_1.CONFIG.PORT}/status`);
            // Initialize WhatsApp agent immediately on server startup
            console.log('🔄 Initializing WhatsApp agent on server startup...');
            await this.webSocketHandler.initializeAgentOnStartup();
        });
    }
    stop() {
        console.log("🛑 Stopping WhatsApp New Agent WebSocket Server...");
        this.server.close(() => {
            console.log("✅ Server stopped successfully");
        });
    }
}
exports.WhatsAppNewAgentApp = WhatsAppNewAgentApp;
//# sourceMappingURL=app.js.map