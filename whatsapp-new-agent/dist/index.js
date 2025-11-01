"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Load environment variables from .env file
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const whatsapp_web_js_1 = require("whatsapp-web.js");
const qrcode_terminal_1 = __importDefault(require("qrcode-terminal"));
const messageProcessor_1 = require("./services/messageProcessor");
const database_1 = require("./services/database");
class WhatsAppAgent {
    constructor(config = {}) {
        this.client = null;
        this.isAuthenticated = false;
        this.isReady = false;
        this.isInitialized = false;
        this.qrCodeCallbacks = [];
        this.statusCallbacks = [];
        this.messageCallbacks = [];
        this.whatsappNumbers = [];
        this.refreshTimer = null;
        this.REFRESH_INTERVAL = 60 * 60 * 1000; // 1 hour in milliseconds
        this.getCurrentStatusCallbacks = () => this.statusCallbacks;
        this.config = {
            sessionName: 'whatsapp-new-agent',
            headless: true,
            debug: false,
            ...config
        };
        // Initialize services
        this.messageProcessor = messageProcessor_1.MessageProcessor.getInstance();
        this.databaseService = database_1.DatabaseService.getInstance();
        this.client = new whatsapp_web_js_1.Client({
            authStrategy: new whatsapp_web_js_1.LocalAuth({
                clientId: this.config.sessionName || 'whatsapp-new-agent'
            }),
            puppeteer: (() => {
                const chromePath = process.env['CHROME_PATH'] || this.getChromeExecutablePath();
                const config = {
                    headless: this.config.headless ?? true,
                    args: [
                        '--no-sandbox',
                        '--disable-setuid-sandbox',
                        '--disable-dev-shm-usage',
                        '--disable-accelerated-2d-canvas',
                        '--no-first-run',
                        '--no-zygote',
                        '--single-process',
                        '--disable-gpu'
                    ]
                };
                if (chromePath) {
                    config.executablePath = chromePath;
                }
                return config;
            })()
        });
        this.setupEventHandlers();
    }
    getChromeExecutablePath() {
        // Check for environment variable first
        if (process.env['CHROME_PATH']) {
            return process.env['CHROME_PATH'];
        }
        // Try to find installed Chrome in Puppeteer cache
        const platform = process.platform;
        const homeDir = process.env['HOME'] || process.env['USERPROFILE'];
        if (!homeDir)
            return undefined;
        let chromePath;
        switch (platform) {
            case 'win32':
                chromePath = `${homeDir}\\.cache\\puppeteer\\chrome\\win64-140.0.7339.82\\chrome-win64\\chrome.exe`;
                break;
            case 'linux':
                chromePath = `${homeDir}/.cache/puppeteer/chrome/linux-140.0.7339.82/chrome-linux64/chrome`;
                break;
            case 'darwin':
                chromePath = `${homeDir}/.cache/puppeteer/chrome/mac-140.0.7339.82/chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;
                break;
            default:
                return undefined;
        }
        // Check if the file exists
        try {
            const fs = require('fs');
            if (fs.existsSync(chromePath)) {
                console.log(`✅ Found Chrome at: ${chromePath}`);
                return chromePath;
            }
        }
        catch (error) {
            console.log(`⚠️ Could not check Chrome path: ${chromePath}`);
        }
        console.log(`⚠️ Chrome not found in Puppeteer cache, using system Chrome`);
        return undefined;
    }
    getCurrentWhatsAppNumbers() {
        return this.whatsappNumbers;
    }
    setupEventHandlers() {
        this.client?.on('qr', (qr) => {
            qrcode_terminal_1.default.generate(qr, { small: true }, (renderedQrCode) => {
                console.log('QR Code rendered:', renderedQrCode);
                // Use arrow function to access current qrCodeCallbacks array
                const getCurrentQRCallbacks = () => this.qrCodeCallbacks;
                const currentCallbacks = getCurrentQRCallbacks();
                // Notify all QR code callbacks with both raw QR and rendered QR
                currentCallbacks.forEach(callback => callback(qr, renderedQrCode));
                console.log('QR Code callbacks notified:', renderedQrCode, currentCallbacks);
            });
            console.log('QR Code received:', qr);
        });
        this.client?.on('ready', async () => {
            console.log('WhatsApp client is ready!');
            this.isReady = true;
            // Update database with authentication status
            try {
                await this.databaseService.updateWhatsAppSession(true);
                console.log('✅ Updated database: User is logged in');
            }
            catch (error) {
                console.error('❌ Failed to update database authentication status:', error);
            }
            // Load WhatsApp numbers from database
            await this.loadWhatsAppNumbers();
            // Start the refresh timer
            this.startRefreshTimer();
            // Scan for missed messages after a short delay to ensure everything is ready
            setTimeout(async () => {
                await this.scanForMissedMessages();
            }, 3000); // Wait 3 seconds before scanning
            this.notifyStatusChange();
        });
        this.client?.on('authenticated', () => {
            console.log('WhatsApp client is authenticated!');
            this.isAuthenticated = true;
            this.notifyStatusChange();
        });
        this.client?.on('auth_failure', async (msg) => {
            console.error('Authentication failed:', msg);
            this.isAuthenticated = false;
            this.isReady = false;
            // Update database with authentication failure
            try {
                await this.databaseService.updateWhatsAppSession(false);
                console.log('✅ Updated database: User authentication failed');
            }
            catch (error) {
                console.error('❌ Failed to update database authentication status:', error);
            }
            this.notifyStatusChange();
        });
        this.client?.on('message', async (message) => {
            console.log('📨 Message received:', message.body);
            try {
                // Use arrow function to access current whatsappNumbers value
                // Check if we have WhatsApp numbers configured
                const currentNumbers = this.getCurrentWhatsAppNumbers();
                if (currentNumbers.length === 0) {
                    console.log('⚠️ No WhatsApp numbers configured, skipping message processing');
                    return;
                }
                // Check if message is from one of our listening groups
                const messageFrom = message.from;
                console.log("whatsappNumbers", currentNumbers);
                const isFromListeningGroup = currentNumbers.some((number) => messageFrom === number || messageFrom.includes(number));
                if (!isFromListeningGroup) {
                    console.log(`⚠️ Message not from listening group: ${messageFrom}`);
                    return;
                }
                // Notify message callbacks
                this.messageCallbacks.forEach(callback => {
                    callback({
                        type: "incoming_message",
                        data: {
                            from: message.from,
                            body: message.body,
                            timestamp: message.timestamp,
                            author: message.author,
                            notifyName: message.notifyName || null
                        }
                    });
                });
                // Process the message automatically
                const processingResult = await this.messageProcessor.processMessage(message, messageFrom);
                // Update database with last processed message info if processing was successful
                if (processingResult) {
                    try {
                        await this.databaseService.updateWhatsAppSession(true, // isLoggedIn
                        processingResult.timestamp, // lastAnalyzedMessageDate
                        processingResult.messageId, // lastProcessedMessageId
                        undefined // activeListeningGroups
                        );
                        console.log(`✅ Updated database with last processed message: ${processingResult.messageId} at ${processingResult.timestamp.toISOString()}`);
                    }
                    catch (error) {
                        console.error('❌ Failed to update database with processed message info:', error);
                    }
                }
                // Notify callbacks about processing result
                this.messageCallbacks.forEach(callback => {
                    callback({
                        type: "message_processed",
                        data: {
                            from: message.from,
                            body: message.body,
                            timestamp: message.timestamp,
                            processedTimestamp: processingResult?.timestamp,
                            success: processingResult !== null
                        }
                    });
                });
            }
            catch (error) {
                console.error('❌ Error processing message:', error);
            }
        });
        this.client?.on('disconnected', async (reason) => {
            console.log('WhatsApp client was disconnected:', reason);
            this.isAuthenticated = false;
            this.isReady = false;
            // Clear the refresh timer
            this.clearRefreshTimer();
            // Update database with disconnection status
            try {
                await this.databaseService.updateWhatsAppSession(false);
                console.log('✅ Updated database: User disconnected');
            }
            catch (error) {
                console.error('❌ Failed to update database authentication status:', error);
            }
            this.notifyStatusChange();
        });
    }
    notifyStatusChange() {
        const status = {
            authenticated: this.isAuthenticated,
            ready: this.isReady
        };
        // Use arrow function to access current statusCallbacks array
        const currentCallbacks = this.getCurrentStatusCallbacks();
        currentCallbacks.forEach(callback => callback(status));
    }
    // Public methods for status monitoring
    onQRCode(callback) {
        this.qrCodeCallbacks.push(callback);
    }
    onStatusChange(callback) {
        this.statusCallbacks.push(callback);
    }
    onMessage(callback) {
        this.messageCallbacks.push(callback);
    }
    getAuthenticationStatus() {
        return {
            authenticated: this.isAuthenticated,
            ready: this.isReady
        };
    }
    async loadWhatsAppNumbers() {
        try {
            console.log('🔄 Loading WhatsApp numbers from database...');
            const session = await this.databaseService.getWhatsAppSession();
            if (session.activeListeningGroups) {
                this.whatsappNumbers = Array.isArray(session.activeListeningGroups)
                    ? session.activeListeningGroups
                    : JSON.parse(session.activeListeningGroups);
                console.log(`✅ Loaded ${this.whatsappNumbers.length} WhatsApp numbers:`, this.whatsappNumbers);
            }
            else {
                this.whatsappNumbers = [];
                console.log('⚠️ No WhatsApp numbers configured in database');
            }
        }
        catch (error) {
            console.error('❌ Error loading WhatsApp numbers:', error);
            this.whatsappNumbers = [];
        }
    }
    getWhatsAppNumbers() {
        return this.whatsappNumbers;
    }
    setWhatsAppNumbers(numbers) {
        this.whatsappNumbers = numbers;
        console.log(`✅ WhatsApp numbers updated:`, this.whatsappNumbers);
    }
    async refreshWhatsAppNumbers() {
        try {
            console.log('🔄 Refreshing WhatsApp numbers from database...');
            await this.loadWhatsAppNumbers();
            console.log(`✅ WhatsApp numbers refreshed:`, this.whatsappNumbers);
        }
        catch (error) {
            console.error('❌ Error refreshing WhatsApp numbers:', error);
        }
    }
    async refreshWhatsAppPage() {
        try {
            if (this.client?.pupPage) {
                console.log('🔄 Refreshing WhatsApp page...');
                // await this.client.pupPage.reload();
                console.log('✅ WhatsApp page refreshed successfully');
            }
            else {
                console.log('⚠️ WhatsApp page not available for refresh');
            }
        }
        catch (error) {
            console.error('❌ Error refreshing WhatsApp page:', error);
        }
    }
    async manualRefresh() {
        console.log('🔄 Manual WhatsApp page refresh requested');
        await this.refreshWhatsAppPage();
    }
    async scanForMissedMessages() {
        try {
            if (!this.isReady || !this.isAuthenticated) {
                console.log('⚠️ WhatsApp not ready or authenticated, skipping missed message scan');
                return;
            }
            console.log('🔍 Starting scan for missed messages...');
            // Get the last processed message info from database
            const session = await this.databaseService.getWhatsAppSession();
            const lastAnalyzedDate = session.lastAnalyzedMessageDate ? new Date(session.lastAnalyzedMessageDate) : null;
            const lastProcessedMessageId = session.lastProcessedMessageId;
            if (!lastAnalyzedDate) {
                console.log('⚠️ No previous message analysis date found, skipping missed message scan');
                return;
            }
            console.log(`📅 Last analyzed message date: ${lastAnalyzedDate.toISOString()}`);
            console.log(`🆔 Last processed message ID: ${lastProcessedMessageId || 'none'}`);
            // Get all chats
            const chats = await this.getChats();
            console.log(`📱 Found ${chats.length} chats to scan`);
            let totalMessagesProcessed = 0;
            let latestProcessedTimestamp = lastAnalyzedDate;
            let latestProcessedMessageId = lastProcessedMessageId;
            // Scan each chat for missed messages
            for (const chat of chats) {
                try {
                    // Check if this chat is in our listening groups
                    const currentNumbers = this.getCurrentWhatsAppNumbers();
                    console.log("currentNumbers", currentNumbers);
                    console.log("chat.id", chat.id);
                    const isListeningChat = currentNumbers.some((number) => chat.id._serialized === number || chat.id._serialized.includes(number));
                    if (!isListeningChat) {
                        console.log(`⚠️ Skipping chat ${chat.id} - not in listening groups`);
                        continue;
                    }
                    console.log(`🔍 Scanning chat: ${chat.name || chat.id}`);
                    // Get messages from the last analyzed date
                    const messages = await chat.fetchMessages({ limit: 100 });
                    console.log(`📨 Found ${messages.length} messages in chat ${chat.name || chat.id}`);
                    // Process messages that are newer than last analyzed date
                    for (const message of messages) {
                        const messageDate = new Date(message.timestamp * 1000);
                        // Skip if message is older than or equal to last analyzed date
                        if (messageDate <= lastAnalyzedDate) {
                            continue;
                        }
                        // Skip if this is the same message we already processed
                        if (lastProcessedMessageId && message.id._serialized === lastProcessedMessageId) {
                            continue;
                        }
                        console.log(`📨 Processing missed message from ${messageDate.toISOString()}: "${message.body?.substring(0, 50)}..."`);
                        // Process the historical message
                        const processingResult = await this.messageProcessor.processHistoricalMessage(message, lastAnalyzedDate);
                        if (processingResult) {
                            if (processingResult.timestamp > latestProcessedTimestamp) {
                                latestProcessedTimestamp = processingResult.timestamp;
                                latestProcessedMessageId = processingResult.messageId;
                            }
                            totalMessagesProcessed++;
                        }
                    }
                }
                catch (error) {
                    console.error(`❌ Error scanning chat ${chat.id}:`, error);
                }
            }
            // Update database with new timestamp and message ID if we processed any messages
            if (totalMessagesProcessed > 0) {
                await this.databaseService.updateWhatsAppSession(true, // isLoggedIn
                latestProcessedTimestamp, // lastAnalyzedMessageDate
                latestProcessedMessageId, // lastProcessedMessageId
                undefined // activeListeningGroups
                );
                console.log(`✅ Processed ${totalMessagesProcessed} missed messages`);
                console.log(`📅 Updated last analyzed date to: ${latestProcessedTimestamp.toISOString()}`);
                console.log(`🆔 Updated last processed message ID to: ${latestProcessedMessageId}`);
            }
            else {
                console.log('✅ No missed messages found');
            }
        }
        catch (error) {
            console.error('❌ Error scanning for missed messages:', error);
        }
    }
    startRefreshTimer() {
        if (this.refreshTimer) {
            this.clearRefreshTimer();
        }
        console.log('⏰ Starting WhatsApp page refresh timer (1 hour interval)');
        this.refreshTimer = setInterval(async () => {
            if (this.isReady && this.isAuthenticated) {
                await this.refreshWhatsAppPage();
            }
            else {
                console.log('⚠️ Skipping page refresh - WhatsApp not ready or authenticated');
            }
        }, this.REFRESH_INTERVAL);
    }
    clearRefreshTimer() {
        if (this.refreshTimer) {
            console.log('🛑 Clearing WhatsApp page refresh timer');
            clearInterval(this.refreshTimer);
            this.refreshTimer = null;
        }
    }
    async initialize() {
        try {
            // Check authentication status from database first
            const isLoggedIn = await this.databaseService.checkAuthenticationStatus();
            if (!isLoggedIn) {
                console.log('🔒 User is not logged in according to database. WhatsApp initialization skipped.');
                console.log('💡 Send a "login" message via WebSocket to initialize WhatsApp.');
                return;
            }
            console.log('✅ User is logged in according to database. Proceeding with WhatsApp initialization...');
            await this.client?.initialize();
            this.isInitialized = true;
            console.log('WhatsApp agent initialized successfully');
        }
        catch (error) {
            console.error('Failed to initialize WhatsApp agent:', error);
            throw error;
        }
    }
    async forceInitialize() {
        try {
            console.log('🚀 Force initializing WhatsApp agent (bypassing database check)...');
            // If client is already initialized, destroy it first to force new QR code generation
            if (this.isInitialized || this.isReady || this.isAuthenticated) {
                console.log('🔄 Client already initialized, destroying first to generate new QR code...');
                try {
                    await this.client?.destroy();
                    console.log('✅ Client destroyed successfully');
                }
                catch (destroyError) {
                    console.log('⚠️ Error destroying client (might not be initialized):', destroyError);
                }
                // Reset states
                this.isInitialized = false;
                this.isReady = false;
                this.isAuthenticated = false;
                // Create new client instance
                this.client = new whatsapp_web_js_1.Client({
                    authStrategy: new whatsapp_web_js_1.LocalAuth({
                        clientId: this.config.sessionName || 'whatsapp-new-agent'
                    }),
                    puppeteer: (() => {
                        const chromePath = process.env['CHROME_PATH'] || this.getChromeExecutablePath();
                        const config = {
                            headless: this.config.headless ?? true,
                            args: [
                                '--no-sandbox',
                                '--disable-setuid-sandbox',
                                '--disable-dev-shm-usage',
                                '--disable-accelerated-2d-canvas',
                                '--no-first-run',
                                '--no-zygote',
                                '--single-process',
                                '--disable-gpu'
                            ]
                        };
                        if (chromePath) {
                            config.executablePath = chromePath;
                        }
                        return config;
                    })()
                });
                // Re-setup event handlers for the new client
                this.setupEventHandlers();
            }
            await this.client?.initialize();
            this.isInitialized = true;
            console.log('WhatsApp agent force initialized successfully');
        }
        catch (error) {
            console.error('Failed to force initialize WhatsApp agent:', error);
            throw error;
        }
    }
    async sendMessage(to, message) {
        try {
            const chatId = to.includes('@c.us') ? to : `${to}@c.us`;
            await this.client?.sendMessage(chatId, message);
            console.log(`Message sent to ${to}: ${message}`);
        }
        catch (error) {
            console.error('Failed to send message:', error);
            throw error;
        }
    }
    async getChats() {
        try {
            return await this.client?.getChats() || [];
        }
        catch (error) {
            console.error('Failed to get chats:', error);
            throw error;
        }
    }
    async isConnected() {
        try {
            return this.client?.pupPage !== null && this.client?.pupPage !== undefined;
        }
        catch (error) {
            return false;
        }
    }
    async destroy() {
        try {
            // Clear the refresh timer
            this.clearRefreshTimer();
            await this.client?.logout();
            await this.client?.pupBrowser?.close();
            await this.client?.destroy();
            this.isAuthenticated = false;
            this.isReady = false;
            this.client = null;
            console.log('WhatsApp agent destroyed');
        }
        catch (error) {
            console.error('Failed to destroy WhatsApp agent:', error);
            throw error;
        }
    }
}
// Export the main class
exports.default = WhatsAppAgent;
// Example usage
if (require.main === module) {
    // Start the WebSocket server
    const { WhatsAppNewAgentApp } = require('./app');
    const app = WhatsAppNewAgentApp.getInstance();
    app.start();
    // Graceful shutdown
    process.on('SIGINT', async () => {
        console.log('\n🛑 Shutting down...');
        app.stop();
        process.exit(0);
    });
    process.on('SIGTERM', async () => {
        console.log('\n🛑 Shutting down...');
        app.stop();
        process.exit(0);
    });
}
//# sourceMappingURL=index.js.map