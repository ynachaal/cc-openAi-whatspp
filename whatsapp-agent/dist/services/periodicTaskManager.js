"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PeriodicTaskManager = void 0;
const whatsappClient_1 = require("./whatsappClient");
class PeriodicTaskManager {
    constructor() {
        this.whatsappService = whatsappClient_1.WhatsAppClientService.getInstance();
    }
    static getInstance() {
        if (!PeriodicTaskManager.instance) {
            PeriodicTaskManager.instance = new PeriodicTaskManager();
        }
        return PeriodicTaskManager.instance;
    }
    /**
     * Stop message processing (no interval to clear)
     */
    stopPeriodicMessageCheck() {
        console.log("⏹️  Stopped message processing");
    }
    /**
     * Check if message processing is running
     */
    isPeriodicCheckRunning() {
        // Since we don't use intervals anymore, always return false
        // This method is kept for backward compatibility
        return false;
    }
    /**
     * Run historical analysis once to catch missed messages
     */
    async runHistoricalAnalysisOnce() {
        try {
            const whatsappConnected = await this.whatsappService.isConnected();
            if (whatsappConnected && this.whatsappService.getWhatsAppNumbers().length > 0) {
                console.log("🔍 Running historical message analysis to catch missed messages...");
                await this.whatsappService.analyzeMessagesSinceLastDate();
                console.log("✅ Historical analysis completed");
            }
            else {
                console.log("⏭️  Skipping historical analysis - WhatsApp client or numbers not available");
            }
        }
        catch (error) {
            console.error("❌ Error in historical message analysis:", error);
        }
    }
}
exports.PeriodicTaskManager = PeriodicTaskManager;
