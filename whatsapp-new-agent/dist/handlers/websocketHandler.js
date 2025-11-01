"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebSocketHandler = void 0;
const ws_1 = require("ws");
const constants_1 = require("../config/constants");
const index_1 = __importDefault(require("../index"));
const database_1 = require("../services/database");
const googleSheets_1 = require("../services/googleSheets");
class WebSocketHandler {
    constructor() {
        this.connectedClients = new Set();
        this.isInitialized = false;
        this.isStartupInitialized = false;
        this.whatsappAgent = new index_1.default({
            sessionName: constants_1.CONFIG.WHATSAPP_SESSION_NAME,
            headless: true,
            debug: false
        });
        this.setupAgentCallbacks();
    }
    static getInstance() {
        if (!WebSocketHandler.instance) {
            WebSocketHandler.instance = new WebSocketHandler();
        }
        return WebSocketHandler.instance;
    }
    setupAgentCallbacks() {
        // Listen for QR code events
        this.whatsappAgent.onQRCode((qr, renderedQrCode) => {
            console.log(`📱 QR Code received: ${qr.substring(0, 20)}...`);
            this.broadcastToAllClients({
                type: "qr_code",
                data: {
                    qr,
                    renderedQrCode: renderedQrCode || null
                }
            });
        });
        // Listen for status changes
        this.whatsappAgent.onStatusChange((status) => {
            console.log(`🔄 WhatsApp status changed: authenticated=${status.authenticated}, ready=${status.ready}`);
            // If WhatsApp becomes ready and authenticated, start listening for messages
            if (status.ready && status.authenticated) {
                console.log('🎯 WhatsApp is ready and authenticated - message listening is now active!');
            }
            this.broadcastToAllClients({
                type: "connection_status",
                data: {
                    whatsappConnected: status.ready,
                    whatsappAuthenticated: status.authenticated
                }
            });
        });
        // Listen for incoming messages
        this.whatsappAgent.onMessage((messageData) => {
            this.broadcastToAllClients(messageData);
        });
    }
    broadcastToAllClients(message) {
        this.connectedClients.forEach(client => {
            if (client.readyState === ws_1.WebSocket.OPEN) {
                this.sendMessage(client, message);
            }
        });
    }
    async initializeAgent() {
        if (this.isInitialized)
            return;
        try {
            console.log("🚀 Initializing WhatsApp agent...");
            await this.whatsappAgent.initialize();
            this.isInitialized = true;
            console.log("✅ WhatsApp agent initialized successfully");
            // Check authentication status and start listening
            setTimeout(() => {
                const status = this.whatsappAgent.getAuthenticationStatus();
                if (status.authenticated && status.ready) {
                    console.log("🎯 WhatsApp is already authenticated and ready - message listening is active!");
                }
                else if (!status.authenticated) {
                    console.log("🔄 WhatsApp needs authentication, QR code will be generated...");
                }
            }, 2000);
        }
        catch (error) {
            console.error("❌ Failed to initialize WhatsApp agent:", error);
            // Retry after 5 seconds
            setTimeout(() => {
                this.isInitialized = false;
                this.initializeAgent();
            }, 5000);
        }
    }
    // Public method to initialize agent on server startup
    async initializeAgentOnStartup() {
        if (this.isStartupInitialized) {
            console.log("✅ WhatsApp agent already initialized on startup");
            return;
        }
        try {
            console.log("🚀 Starting WhatsApp agent initialization on server startup...");
            await this.initializeAgent();
            this.isStartupInitialized = true;
            console.log("✅ WhatsApp agent startup initialization completed");
        }
        catch (error) {
            console.error("❌ Failed to initialize WhatsApp agent on startup:", error);
            // Retry after 10 seconds
            setTimeout(() => {
                this.isStartupInitialized = false;
                this.initializeAgentOnStartup();
            }, 10000);
        }
    }
    // Public method to force re-authentication
    async forceReAuthentication() {
        console.log("🔄 Forcing re-authentication...");
        this.isInitialized = false;
        await this.initializeAgent();
    }
    validateOrigin(_origin) {
        return true; // Allow all origins for now
    }
    sendMessage(ws, message) {
        ws.send(JSON.stringify(message));
    }
    handleConnection(ws, req) {
        const origin = req.headers.origin;
        if (!this.validateOrigin(origin)) {
            ws.close(1008, "Unauthorized origin");
            return;
        }
        console.log("New WebSocket connection established");
        // Add client to connected clients set
        this.connectedClients.add(ws);
        // Send initial connection status
        setTimeout(async () => {
            const status = this.whatsappAgent.getAuthenticationStatus();
            this.sendMessage(ws, {
                type: "connection_status",
                data: {
                    whatsappConnected: status.ready,
                    whatsappAuthenticated: status.authenticated,
                    connectionStatus: status.ready ? "connected" : "disconnected",
                },
            });
        }, 500);
        // Handle client disconnect
        ws.on('close', () => {
            this.connectedClients.delete(ws);
            console.log("WebSocket connection closed");
        });
        ws.on("message", async (message) => {
            try {
                const data = JSON.parse(message.toString());
                await this.handleMessage(ws, data);
            }
            catch (error) {
                console.error("Error processing WebSocket message:", error);
                this.sendMessage(ws, {
                    type: "error",
                    error: "Invalid message format",
                });
            }
        });
        ws.on("close", () => {
            console.log("WebSocket connection closed");
        });
    }
    async handleMessage(ws, data) {
        switch (data.type) {
            case "login":
                await this.handleLogin(ws);
                break;
            case "logout":
                await this.handleLogout(ws);
                break;
            case "health_check":
                await this.handleHealthCheck(ws);
                break;
            case "check_login_status":
                await this.handleCheckLoginStatus(ws);
                break;
            case "get_chats":
                setTimeout(async () => {
                    await this.handleGetChats(ws);
                }, 2000);
                break;
            case "set_whatsapp_number":
                await this.handleSetWhatsAppNumber(ws, data);
                break;
            case "set_whatsapp_numbers":
                await this.handleSetWhatsAppNumbers(ws, data);
                break;
            case "reset_everything":
                await this.handleResetEverything(ws);
                break;
            case "refresh_api_keys":
                await this.handleRefreshApiKeys(ws);
                break;
            case "getChatMessagesByDate":
                await this.handleGetChatMessagesByDate(ws, data);
                break;
            case "analyze_historical_messages":
                await this.handleAnalyzeHistoricalMessages(ws);
                break;
            case "send_message":
                await this.handleSendMessage(ws, data);
                break;
            case "refresh_whatsapp_numbers":
                await this.handleRefreshWhatsAppNumbers(ws);
                break;
            case "get_whatsapp_numbers":
                await this.handleGetWhatsAppNumbers(ws);
                break;
            case "sync_sheet_columns":
                await this.handleSyncSheetColumns(ws);
                break;
            default:
                this.sendMessage(ws, {
                    type: "error",
                    error: "Unknown message type",
                });
        }
    }
    async handleLogin(ws) {
        try {
            console.log("🔄 Handling login request...");
            // Check current status
            const currentStatus = this.whatsappAgent.getAuthenticationStatus();
            console.log("Current status:", currentStatus);
            if (currentStatus.ready && currentStatus.authenticated) {
                // Already authenticated and ready
                this.sendMessage(ws, {
                    type: "login_response",
                    status: "already_connected",
                    data: {
                        whatsappConnected: true,
                        whatsappAuthenticated: true
                    }
                });
                return;
            }
            console.log("🚀 Force initializing WhatsApp agent (login message received)...");
            // Force initialize WhatsApp agent (bypassing database check)
            await this.whatsappAgent.forceInitialize();
            this.isInitialized = true;
            console.log("✅ WhatsApp agent force initialized successfully");
            // Send current status
            const status = this.whatsappAgent.getAuthenticationStatus();
            this.sendMessage(ws, {
                type: "login_response",
                status: status.ready ? "connected" : "connecting",
                data: {
                    whatsappConnected: status.ready,
                    whatsappAuthenticated: status.authenticated
                }
            });
            console.log("Login response sent");
        }
        catch (error) {
            console.error("Error during login:", error);
            this.sendMessage(ws, {
                type: "login_response",
                status: "error",
                error: "Failed to initialize WhatsApp client",
            });
        }
    }
    async handleLogout(ws) {
        const isConnected = await this.whatsappAgent.isConnected();
        if (!isConnected) {
            this.sendMessage(ws, {
                type: "logout_response",
                status: "not_connected",
            });
            return;
        }
        try {
            await this.whatsappAgent.destroy();
            // Update database with logout status
            try {
                const databaseService = database_1.DatabaseService.getInstance();
                await databaseService.updateWhatsAppSession(false);
                console.log('✅ Updated database: User logged out');
            }
            catch (error) {
                console.error('❌ Failed to update database logout status:', error);
            }
            this.sendMessage(ws, {
                type: "logout_response",
                status: "logged_out",
                data: {
                    whatsappConnected: false,
                    whatsappAuthenticated: false
                }
            });
        }
        catch (error) {
            console.error("Error during logout:", error);
            this.sendMessage(ws, {
                type: "logout_response",
                status: "error",
                error: "Failed to logout",
            });
        }
    }
    async handleHealthCheck(ws) {
        const isConnected = await this.whatsappAgent.isConnected();
        this.sendMessage(ws, {
            type: "health_response",
            data: {
                status: "ok",
                whatsappConnected: isConnected,
                connectionStatus: isConnected ? "connected" : "disconnected",
            },
        });
    }
    async handleCheckLoginStatus(ws) {
        const status = this.whatsappAgent.getAuthenticationStatus();
        setTimeout(() => {
            this.sendMessage(ws, {
                type: "login_status",
                data: {
                    whatsappConnected: status.ready,
                    whatsappAuthenticated: status.authenticated
                },
            });
        }, 1000);
    }
    async handleGetChats(ws) {
        const isConnected = await this.whatsappAgent.isConnected();
        if (!isConnected) {
            this.sendMessage(ws, {
                type: "chats_response",
                status: "error",
                error: "WhatsApp client not connected",
            });
            return;
        }
        try {
            console.log("Getting chats");
            const chats = await this.whatsappAgent.getChats();
            console.log("Chats", chats?.length);
            this.sendMessage(ws, {
                type: "chats_response",
                status: "success",
                data: chats,
            });
        }
        catch (error) {
            console.error("Error getting chats:", error);
            this.sendMessage(ws, {
                type: "chats_response",
                status: "error",
                error: "Failed to get chats",
            });
        }
    }
    async handleSendMessage(ws, data) {
        const isConnected = await this.whatsappAgent.isConnected();
        if (!isConnected) {
            this.sendMessage(ws, {
                type: "send_message_response",
                status: "error",
                error: "WhatsApp client not connected",
            });
            return;
        }
        try {
            const { to, message } = data;
            await this.whatsappAgent.sendMessage(to, message);
            this.sendMessage(ws, {
                type: "send_message_response",
                status: "success",
                message: "Message sent successfully",
            });
        }
        catch (error) {
            console.error("Error sending message:", error);
            this.sendMessage(ws, {
                type: "send_message_response",
                status: "error",
                error: "Failed to send message",
            });
        }
    }
    async handleSetWhatsAppNumber(ws, data) {
        try {
            const number = data.number;
            if (!number) {
                this.sendMessage(ws, {
                    type: "whatsapp_number_response",
                    status: "error",
                    error: "No number provided",
                });
                return;
            }
            // Convert single number to array and update the agent's WhatsApp numbers
            const numbers = [number];
            this.whatsappAgent.setWhatsAppNumbers(numbers);
            console.log(`✅ WhatsApp number updated: ${number}`);
            this.sendMessage(ws, {
                type: "whatsapp_number_response",
                status: "success",
                data: { number: number },
                message: `Successfully updated WhatsApp number: ${number}`
            });
        }
        catch (error) {
            console.error("Error setting WhatsApp number:", error);
            this.sendMessage(ws, {
                type: "whatsapp_number_response",
                status: "error",
                error: "Failed to update WhatsApp number",
            });
        }
    }
    async handleSetWhatsAppNumbers(ws, data) {
        try {
            const numbers = Array.isArray(data.numbers) ? data.numbers : [];
            // Update the agent's WhatsApp numbers
            this.whatsappAgent.setWhatsAppNumbers(numbers);
            console.log(`✅ WhatsApp numbers updated: ${numbers.length} numbers set`);
            this.sendMessage(ws, {
                type: "whatsapp_numbers_response",
                status: "success",
                data: {
                    numbers: numbers,
                    count: numbers.length
                },
                message: `Successfully updated ${numbers.length} WhatsApp numbers`
            });
        }
        catch (error) {
            console.error("Error setting WhatsApp numbers:", error);
            this.sendMessage(ws, {
                type: "whatsapp_numbers_response",
                status: "error",
                error: "Failed to update WhatsApp numbers",
            });
        }
    }
    async handleResetEverything(ws) {
        try {
            await this.whatsappAgent.destroy();
            this.sendMessage(ws, {
                type: "reset_everything_response",
                status: "success",
                message: "Everything reset successfully",
            });
        }
        catch (error) {
            console.error("Error resetting everything:", error);
            this.sendMessage(ws, {
                type: "reset_everything_response",
                status: "error",
                error: "Failed to reset everything",
            });
        }
    }
    async handleRefreshApiKeys(ws) {
        try {
            const databaseService = database_1.DatabaseService.getInstance();
            const apiKeys = await databaseService.getApiKeys();
            // If Google Sheet ID is configured, sync sheet headers
            let sheetSyncResult = null;
            if (apiKeys?.googleSheetId) {
                try {
                    console.log("🔄 Refreshing API keys and syncing sheet headers...");
                    sheetSyncResult = await (0, googleSheets_1.updateGoogleSheetId)(apiKeys.googleSheetId);
                }
                catch (syncError) {
                    console.error("❌ Failed to sync sheet headers after API key refresh:", syncError);
                }
            }
            this.sendMessage(ws, {
                type: "refresh_api_keys_response",
                status: "success",
                data: {
                    googleSheetId: apiKeys?.googleSheetId ? "Configured" : "Not configured",
                    openaiKey: apiKeys?.openaiKey ? "Configured" : "Not configured",
                    sheetSync: sheetSyncResult ? {
                        sheetsUpdated: sheetSyncResult.sheetsUpdated,
                        totalSheets: sheetSyncResult.totalSheets
                    } : null
                },
                message: sheetSyncResult
                    ? `API keys refreshed and ${sheetSyncResult.sheetsUpdated}/${sheetSyncResult.totalSheets} sheets synced successfully`
                    : "API keys refreshed successfully",
            });
        }
        catch (error) {
            console.error("Error refreshing API keys:", error);
            this.sendMessage(ws, {
                type: "refresh_api_keys_response",
                status: "error",
                error: "Failed to refresh API keys",
            });
        }
    }
    async handleGetChatMessagesByDate(ws, _data) {
        const isConnected = await this.whatsappAgent.isConnected();
        if (!isConnected) {
            this.sendMessage(ws, {
                type: "chat_messages_response",
                status: "error",
                error: "WhatsApp client not connected",
            });
            return;
        }
        try {
            // This would need to be implemented in the WhatsAppAgent class
            // For now, return empty array
            this.sendMessage(ws, {
                type: "chat_messages_response",
                status: "success",
                data: [],
            });
        }
        catch (error) {
            console.error("Error getting chat messages:", error);
            this.sendMessage(ws, {
                type: "chat_messages_response",
                status: "error",
                error: "Failed to get chat messages",
            });
        }
    }
    async handleAnalyzeHistoricalMessages(ws) {
        const isConnected = await this.whatsappAgent.isConnected();
        if (!isConnected) {
            this.sendMessage(ws, {
                type: "analyze_historical_response",
                status: "error",
                error: "WhatsApp client not connected",
            });
            return;
        }
        try {
            this.sendMessage(ws, {
                type: "analyze_historical_response",
                status: "started",
                message: "Historical message analysis started",
            });
            // Trigger the actual missed message scanning
            await this.whatsappAgent.scanForMissedMessages();
            this.sendMessage(ws, {
                type: "analyze_historical_response",
                status: "completed",
                message: "Historical message analysis completed",
            });
        }
        catch (error) {
            console.error("Error starting historical analysis:", error);
            this.sendMessage(ws, {
                type: "analyze_historical_response",
                status: "error",
                error: "Failed to start historical analysis",
            });
        }
    }
    async handleRefreshWhatsAppNumbers(ws) {
        try {
            console.log("🔄 Refreshing WhatsApp numbers from database...");
            // Refresh the agent's WhatsApp numbers from database
            await this.whatsappAgent.refreshWhatsAppNumbers();
            const currentNumbers = this.whatsappAgent.getWhatsAppNumbers();
            this.sendMessage(ws, {
                type: "refresh_whatsapp_numbers_response",
                status: "success",
                data: {
                    numbers: currentNumbers,
                    count: currentNumbers.length
                },
                message: `Successfully refreshed ${currentNumbers.length} WhatsApp numbers`
            });
        }
        catch (error) {
            console.error("Error refreshing WhatsApp numbers:", error);
            this.sendMessage(ws, {
                type: "refresh_whatsapp_numbers_response",
                status: "error",
                error: "Failed to refresh WhatsApp numbers",
            });
        }
    }
    async handleGetWhatsAppNumbers(ws) {
        try {
            const currentNumbers = this.whatsappAgent.getWhatsAppNumbers();
            this.sendMessage(ws, {
                type: "get_whatsapp_numbers_response",
                status: "success",
                data: {
                    numbers: currentNumbers,
                    count: currentNumbers.length
                },
                message: `Retrieved ${currentNumbers.length} WhatsApp numbers`
            });
        }
        catch (error) {
            console.error("Error getting WhatsApp numbers:", error);
            this.sendMessage(ws, {
                type: "get_whatsapp_numbers_response",
                status: "error",
                error: "Failed to get WhatsApp numbers",
            });
        }
    }
    async handleSyncSheetColumns(ws) {
        try {
            console.log("🔄 Syncing Google Sheets headers...");
            // Clear cache to force fresh data
            (0, googleSheets_1.clearCache)();
            // Sync all sheet headers
            const result = await (0, googleSheets_1.syncAllSheetHeaders)();
            this.sendMessage(ws, {
                type: "sync_sheet_columns_response",
                status: "success",
                data: {
                    sheetsUpdated: result.sheetsUpdated,
                    totalSheets: result.totalSheets,
                    cacheCleared: true
                },
                message: `Successfully synced headers for ${result.sheetsUpdated}/${result.totalSheets} sheets`
            });
            console.log(`✅ Sheet headers sync completed: ${result.sheetsUpdated}/${result.totalSheets} sheets updated`);
        }
        catch (error) {
            console.error("Error syncing sheet columns:", error);
            this.sendMessage(ws, {
                type: "sync_sheet_columns_response",
                status: "error",
                error: "Failed to sync sheet columns",
            });
        }
    }
}
exports.WebSocketHandler = WebSocketHandler;
//# sourceMappingURL=websocketHandler.js.map