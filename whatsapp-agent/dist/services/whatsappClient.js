"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WhatsAppClientService = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const child_process_1 = require("child_process");
const util_1 = require("util");
const os_1 = __importDefault(require("os"));
const venom_bot_1 = require("venom-bot");
const constants_1 = require("../config/constants");
const rateLimit_1 = require("../config/rateLimit");
const database_1 = require("./database");
const messageProcessor_1 = require("./messageProcessor");
const agent_1 = require("../agent");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
const rateLimitConfig = (0, rateLimit_1.getRateLimitConfig)();
class WhatsAppClientService {
    constructor() {
        this.currentQrCode = null;
        this.client = null;
        this.connectionStatus = "disconnected";
        this.whatsappNumbers = [];
        this.isInitializing = false;
        this.initializationAbortController = null;
        this.databaseService = database_1.DatabaseService.getInstance();
        this.messageProcessor = messageProcessor_1.MessageProcessor.getInstance();
        // Clean up any leftover Chrome processes on startup
        // this.killAllChromeProcesses().catch(error => {
        //   console.error("❌ Error cleaning up Chrome processes on startup:", error);
        // });
    }
    static getInstance() {
        if (!WhatsAppClientService.instance) {
            WhatsAppClientService.instance = new WhatsAppClientService();
        }
        return WhatsAppClientService.instance;
    }
    setupMessageHandlers() {
        this.client?.onMessage(async (message) => {
            if (this.whatsappNumbers.length === 0)
                return;
            // Check if the message is from one of our listening groups
            const messageFrom = message.from;
            const isFromListeningGroup = this.whatsappNumbers.some((number) => messageFrom === number || messageFrom.includes(number));
            if (!isFromListeningGroup) {
                console.log("Message not from listening group, skipping...", messageFrom);
                return;
            }
            console.log("Message from listening group, processing...", messageFrom);
            const timestampToSave = await this.messageProcessor.processMessage(message, messageFrom);
            if (timestampToSave) {
                await this.databaseService.updateWhatsAppSession(true, timestampToSave, message.id);
            }
        });
    }
    sendQrCodeToWebSocket(ws) {
        if (ws && this.currentQrCode) {
            ws.send(JSON.stringify({
                type: "qr_code",
                data: { qrCode: this.currentQrCode },
            }));
        }
    }
    changeIsInitializing(isInitializing) {
        this.isInitializing = isInitializing;
    }
    async initialize(ws) {
        if (this.isInitializing) {
            return false;
        }
        try {
            // Cancel any ongoing initialization
            // if (this.isInitializing) {
            //   console.log("🔄 Cancelling ongoing initialization...");
            //   this.initializationAbortController?.abort();
            //   await this.resetEverything();
            // }
            this.isInitializing = true;
            this.initializationAbortController = new AbortController();
            this.connectionStatus = "loading";
            const sessionName = constants_1.CONFIG.WHATSAPP_SESSION_NAME;
            console.log("Initializing WhatsApp client...", constants_1.CONFIG);
            this.client = await (0, venom_bot_1.create)(sessionName, (base64Qrimg, asciiQR, attempt, urlCode) => {
                this.currentQrCode = base64Qrimg;
                if (ws) {
                    ws.send(JSON.stringify({
                        type: "qr_code",
                        data: {
                            qrCode: base64Qrimg,
                            attempt: attempt || 0,
                            urlCode,
                        },
                    }));
                }
                else {
                    this.currentQrCode = null;
                    ws.send(JSON.stringify({ type: "qr_code", data: { qrCode: null } }));
                    throw new Error("WebSocket is not connected");
                }
            }, async (statusSession, session) => {
                this.connectionStatus = statusSession;
                // Update session status in database
                // await this.databaseService.updateWhatsAppSession(
                //   statusSession === "successChat" || statusSession === "waitChat"
                // );
                if (ws) {
                    ws.send(JSON.stringify({
                        type: "connection_status",
                        data: {
                            status: statusSession,
                            session,
                        },
                    }));
                }
                // If session is not authenticated, close the client
                if (statusSession === "notLogged") {
                    await this.close();
                }
            }, { updatesLog: true, ...constants_1.CONFIG.BROWSER_CONFIG });
            this.connectionStatus = "connected";
            this.setupMessageHandlers();
            // Set WhatsApp numbers from database
            const session = await this.databaseService.getWhatsAppSession();
            if (session.activeListeningGroups) {
                this.whatsappNumbers = Array.isArray(session.activeListeningGroups)
                    ? session.activeListeningGroups
                    : JSON.parse(session.activeListeningGroups);
            }
            else {
                this.whatsappNumbers = [];
            }
            // Try to click the Continue button if it exists
            await this.clickContinueButtonIfExists();
            this.isInitializing = false;
            this.initializationAbortController = null;
            return true;
        }
        catch (error) {
            console.error("Error initializing WhatsApp client, trying again...", error);
            this.connectionStatus = "error";
            this.currentQrCode = null;
            this.isInitializing = false;
            this.initializationAbortController = null;
            await this.close();
            return false;
        }
    }
    async close() {
        this.currentQrCode = null;
        if (this.client) {
            try {
                await this.client.close();
            }
            catch (closeError) {
                console.error("Error closing WhatsApp client:", closeError);
            }
            this.client = null;
        }
        this.connectionStatus = "disconnected";
        this.whatsappNumbers = [];
    }
    async reload() {
        if (this.client?.waPage) {
            await this.client.waPage.reload();
        }
    }
    async logout() {
        if (!this.client) {
            throw new Error("WhatsApp client not connected");
        }
        await this.client.logout();
        await this.close();
    }
    async getAllChats() {
        if (!this.client) {
            throw new Error("WhatsApp client not connected");
        }
        // const chatGroups = await this.client.getAllChatsGroups();
        const chats = await this.client.getAllChats();
        console.log("getAllChats", chats?.length);
        // console.log("Chat groups", chatGroups);
        // const screenshotBuffer = await this.client.waPage.screenshot({ encoding: "base64" });
        // Get unread messages and extract distinct chat ids and names
        const unreadMessages = (await this.client.getUnreadMessages());
        const groupMessages = unreadMessages.filter((chat) => chat.isGroupMsg && !chat.groupInfo?.isUser);
        const chatMap = new Map();
        for (const msg of groupMessages) {
            console.log("msg", msg);
            // Prefer groupInfo.name if available, otherwise fallback to chatId._serialized or from
            let chatId = msg.chatId?._serialized || msg.from || msg.id._serialized;
            let chatName = msg.groupInfo?.name || msg.chat?.name || chatId;
            if (chatId && !chatMap.has(chatId)) {
                chatMap.set(chatId, chatName);
            }
        }
        const distinctChats = Array.from(chatMap.entries()).map(([id, name]) => ({
            id,
            name,
        }));
        console.log("Distinct unread chat ids and names:", distinctChats);
        return distinctChats;
    }
    async getAllMessagesDate(number, type, date, time, limit) {
        if (!this.client) {
            throw new Error("WhatsApp client not connected");
        }
        return await this.client.getAllMessagesDate(number, type, date, time, limit);
    }
    async analyzeMessagesSinceLastDate() {
        if (!this.client || this.whatsappNumbers.length === 0) {
            console.log("❌ Cannot analyze messages: WhatsApp client or numbers not available");
            return;
        }
        try {
            console.log("🔍 Checking for messages to analyze since last date...");
            // Get the last analyzed message date and ID from database
            const session = await this.databaseService.getWhatsAppSession();
            const lastAnalyzedDate = session.lastAnalyzedMessageDate;
            const lastProcessedMessageId = session.lastProcessedMessageId;
            console.log("📊 Session data:", JSON.stringify(session, null, 2));
            console.log("📊 Raw lastAnalyzedDate:", lastAnalyzedDate);
            console.log("📊 lastAnalyzedDate type:", typeof lastAnalyzedDate);
            console.log("📊 Last processed message ID:", lastProcessedMessageId);
            if (!lastAnalyzedDate) {
                console.log("📅 No last analyzed date found, skipping historical analysis");
                return;
            }
            // Add 1 second to the last analyzed date to avoid re-processing the same message
            const lastDate = new Date(lastAnalyzedDate);
            const nextSecondDate = new Date(lastDate.getTime() + 1000); // Add 1 second
            const now = new Date();
            const timeDiff = now.getTime() - new Date(lastAnalyzedDate).getTime();
            const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
            console.log(`📊 Last analyzed: ${lastAnalyzedDate}, Now: ${now.toISOString()}, Days difference: ${daysDiff}`);
            console.log(`🎯 Will fetch messages starting from: ${nextSecondDate.toISOString()} (last analyzed + 1 second)`);
            if (daysDiff <= 0) {
                console.log("✅ No new messages to analyze");
                return;
            }
            // Format the date and time for the API call (DD/MM/YYYY and HH:MM:SS)
            const formattedDate = `${nextSecondDate
                .getDate()
                .toString()
                .padStart(2, "0")}/${(nextSecondDate.getMonth() + 1)
                .toString()
                .padStart(2, "0")}/${nextSecondDate.getFullYear()}`;
            const formattedTime = `${nextSecondDate
                .getHours()
                .toString()
                .padStart(2, "0")}:${nextSecondDate
                .getMinutes()
                .toString()
                .padStart(2, "0")}:${nextSecondDate
                .getSeconds()
                .toString()
                .padStart(2, "0")}`;
            console.log(`🔄 Fetching messages since ${formattedDate} ${formattedTime} from ${this.whatsappNumbers.length} groups`);
            // Get all messages from all listening groups since the exact timestamp + 1 second
            let allMessages = [];
            for (const whatsappNumber of this.whatsappNumbers) {
                try {
                    console.log(`📞 Fetching messages from group: ${whatsappNumber} since ${formattedDate} ${formattedTime}`);
                    const messages = await this.getAllMessagesDate(whatsappNumber, "higherThan", formattedDate, formattedTime, 50);
                    if (messages && messages.length > 0) {
                        allMessages = allMessages.concat(messages);
                        console.log(`📨 Found ${messages.length} messages from ${whatsappNumber}`);
                    }
                }
                catch (error) {
                    console.error(`❌ Error fetching messages from ${whatsappNumber}:`, error);
                }
            }
            // Sort messages by timestamp to process in chronological order
            allMessages.sort((a, b) => a.timestamp - b.timestamp);
            // Filter out already processed messages using message ID
            let filteredMessages = allMessages;
            if (lastProcessedMessageId) {
                const lastProcessedIndex = allMessages.findIndex(msg => msg.id === lastProcessedMessageId);
                if (lastProcessedIndex !== -1) {
                    // Start from the message after the last processed one
                    filteredMessages = allMessages.slice(lastProcessedIndex + 1);
                    console.log(`🔍 Filtered out ${allMessages.length - filteredMessages.length} already processed messages`);
                }
            }
            console.log(`📨 Found ${filteredMessages.length} new messages to analyze from all groups`);
            let processedCount = 0;
            let realEstateCount = 0;
            let latestTimestamp = null;
            let lastProcessedId = null;
            // Batch process messages to reduce API calls
            const batchSize = rateLimitConfig.HISTORICAL_PROCESSING.batchSize;
            const messageBatches = [];
            for (let i = 0; i < filteredMessages.length; i += batchSize) {
                messageBatches.push(filteredMessages.slice(i, i + batchSize));
            }
            console.log(`📦 Processing ${messageBatches.length} batches of up to ${batchSize} messages each`);
            // Process messages in batches
            for (let batchIndex = 0; batchIndex < messageBatches.length; batchIndex++) {
                const batch = messageBatches[batchIndex];
                console.log(`📦 Processing batch ${batchIndex + 1}/${messageBatches.length} with ${batch.length} messages`);
                // Process all messages in the current batch
                const batchPromises = batch.map(async (message) => {
                    try {
                        const timestampToSave = await this.messageProcessor.processHistoricalMessage(message, new Date(lastAnalyzedDate));
                        if (timestampToSave) {
                            // Track the latest timestamp and message ID but don't update database yet
                            if (!latestTimestamp || timestampToSave > latestTimestamp) {
                                latestTimestamp = timestampToSave;
                            }
                            lastProcessedId = message.id;
                            processedCount++;
                            // Check if it was a real estate message
                            const analysis = await (0, agent_1.analyzeMessage)(message.body);
                            if (!("not_real_estate" in analysis)) {
                                realEstateCount++;
                            }
                        }
                    }
                    catch (error) {
                        console.error("Error processing message:", error);
                    }
                });
                // Wait for current batch to complete
                await Promise.all(batchPromises);
                // Add delay between batches to avoid overwhelming services
                if (batchIndex < messageBatches.length - 1) {
                    console.log(`⏳ Waiting ${rateLimitConfig.HISTORICAL_PROCESSING.delayBetweenBatches / 1000} seconds before processing next batch...`);
                    await new Promise((resolve) => setTimeout(resolve, rateLimitConfig.HISTORICAL_PROCESSING.delayBetweenBatches));
                }
            }
            // Update the database ONCE with the latest timestamp and message ID after processing all messages
            if (latestTimestamp && lastProcessedId) {
                console.log(`📅 Updating last analyzed message date to: ${latestTimestamp.toISOString()}`);
                console.log(`🆔 Updating last processed message ID to: ${lastProcessedId}`);
                await this.databaseService.updateWhatsAppSession(true, latestTimestamp, lastProcessedId);
            }
            console.log(`✅ Historical analysis complete: ${processedCount} messages processed, ${realEstateCount} real estate messages found`);
        }
        catch (error) {
            console.error("❌ Error analyzing messages since last date:", error);
        }
    }
    // Getters
    getClient() {
        return this.client;
    }
    getConnectionStatus() {
        return this.connectionStatus;
    }
    getWhatsAppNumbers() {
        return this.whatsappNumbers;
    }
    setWhatsAppNumbers(numbers) {
        this.whatsappNumbers = numbers;
    }
    // Backward compatibility methods
    getWhatsAppNumber() {
        return this.whatsappNumbers.length > 0 ? this.whatsappNumbers[0] : null;
    }
    setWhatsAppNumber(number) {
        this.whatsappNumbers = number ? [number] : [];
    }
    // Public method to manually kill all Chrome processes
    async forceKillAllChromeProcesses() {
        return this.killAllChromeProcesses();
    }
    async isConnected() {
        if (!this.client) {
            return false;
        }
        // If still initializing, return false to avoid "main frame too early" error
        if (this.isInitializing) {
            return false;
        }
        try {
            const isLoggedIn = await this.client.isLoggedIn();
            if (isLoggedIn) {
                return true;
            }
            const isConnected = await this.client.isConnected();
            this.connectionStatus = isConnected ? "connected" : "disconnected";
            return !!this.client && this.connectionStatus === "connected";
        }
        catch (error) {
            // Handle the "main frame too early" error gracefully
            if (error instanceof Error && error.message.includes("Requesting main frame too early")) {
                console.log("⚠️ Page not ready yet, returning false for connection status");
                return false;
            }
            // Handle other potential errors
            console.error("Error checking connection status:", error);
            return false;
        }
    }
    getIsInitializing() {
        return this.isInitializing;
    }
    async isReadyForInitialization() {
        // Check if there are any lingering session files
        const tokensPath = path_1.default.join(process.cwd(), "tokens");
        const sessionPath = path_1.default.join(process.cwd(), `${constants_1.CONFIG.WHATSAPP_SESSION_NAME}.json`);
        if (fs_1.default.existsSync(tokensPath) || fs_1.default.existsSync(sessionPath)) {
            console.log("⚠️ Found lingering session files, cleaning them up...");
            try {
                if (fs_1.default.existsSync(tokensPath)) {
                    fs_1.default.rmSync(tokensPath, { recursive: true, force: true });
                }
                if (fs_1.default.existsSync(sessionPath)) {
                    fs_1.default.unlinkSync(sessionPath);
                }
                console.log("✅ Session files cleaned up");
            }
            catch (error) {
                console.error("❌ Error cleaning session files:", error);
                return false;
            }
        }
        // Check if there are any Chrome processes and clean them up
        try {
            const platform = os_1.default.platform();
            let chromeProcessCount = 0;
            if (platform === "win32") {
                const { stdout } = await execAsync('tasklist /FI "IMAGENAME eq chrome.exe" /FO CSV');
                const lines = stdout
                    .split("\n")
                    .filter((line) => line.trim() &&
                    !line.includes("Image Name") &&
                    line.includes("chrome.exe"));
                chromeProcessCount = lines.length;
            }
            else {
                // Linux - check for any chrome-related processes
                const { stdout } = await execAsync('pgrep -f "chrome|chromium|google-chrome"').catch(() => ({ stdout: "" }));
                const pids = stdout
                    .trim()
                    .split("\n")
                    .filter((pid) => pid && !isNaN(Number(pid)));
                chromeProcessCount = pids.length;
            }
            if (chromeProcessCount > 0) {
                console.log(`⚠️ Found ${chromeProcessCount} Chrome processes, cleaning them up...`);
                await this.killAllChromeProcesses();
                // Wait a bit after cleanup
                await new Promise((resolve) => setTimeout(resolve, 3000));
            }
        }
        catch (error) {
            console.log("⚠️ Could not check Chrome processes:", error);
        }
        return true;
    }
    async killAllChromeProcesses() {
        console.log("🔍 Starting comprehensive Chrome process cleanup...");
        const platform = os_1.default.platform();
        try {
            if (platform === "win32") {
                await this.killChromeProcessesWindows();
            }
            else {
                await this.killChromeProcessesLinux();
            }
            console.log("✅ Chrome process cleanup completed");
        }
        catch (error) {
            console.error("❌ Error during Chrome process cleanup:", error);
        }
    }
    async killChromeProcessesWindows() {
        console.log("🪟 Using Windows Chrome cleanup...");
        // First, try to kill all Chrome processes by name
        await execAsync('taskkill /IM "chrome.exe" /F /T').catch(() => {
            console.log("ℹ️ No Chrome processes found by name or access denied");
        });
        // Wait a moment for processes to terminate
        await new Promise((resolve) => setTimeout(resolve, 1000));
        // Then check for any remaining Chrome processes and kill them by PID
        const { stdout } = await execAsync('tasklist /FI "IMAGENAME eq chrome.exe" /FO CSV').catch(() => ({ stdout: "" }));
        if (stdout) {
            const lines = stdout
                .split("\n")
                .filter((line) => line.trim() &&
                !line.includes("Image Name") &&
                line.includes("chrome.exe"));
            console.log(`🔍 Found ${lines.length} remaining Chrome processes`);
            for (const line of lines) {
                const parts = line.split(",");
                if (parts.length >= 2) {
                    const pid = parts[1].replace(/"/g, "").trim();
                    if (pid && pid !== "PID" && !isNaN(Number(pid))) {
                        try {
                            await execAsync(`taskkill /PID ${pid} /F`);
                            console.log(`✅ Killed Chrome process with PID: ${pid}`);
                        }
                        catch (killError) {
                            console.log(`⚠️ Could not kill Chrome process ${pid}:`, killError);
                        }
                    }
                }
            }
        }
        // Also try to kill any Chromium-based processes that might be related
        const chromiumProcesses = ["msedge.exe", "brave.exe", "chromium.exe"];
        for (const process of chromiumProcesses) {
            try {
                await execAsync(`tasklist /FI "IMAGENAME eq ${process}" /FO CSV`);
                await execAsync(`taskkill /IM "${process}" /F /T`).catch(() => { });
                console.log(`✅ Cleaned up ${process} processes`);
            }
            catch (error) {
                // Process not found, which is fine
            }
        }
    }
    async killChromeProcessesLinux() {
        console.log("🐧 Using Linux Chrome cleanup...");
        const chromeProcessNames = [
            "chrome",
            "chromium",
            "chromium-browser",
            "google-chrome",
            "google-chrome-stable",
            "google-chrome-beta",
            "google-chrome-unstable",
        ];
        // First, try graceful termination with SIGTERM
        for (const processName of chromeProcessNames) {
            try {
                console.log(`🔍 Looking for ${processName} processes...`);
                const { stdout } = await execAsync(`pgrep -f ${processName}`).catch(() => ({ stdout: "" }));
                if (stdout.trim()) {
                    const pids = stdout
                        .trim()
                        .split("\n")
                        .filter((pid) => pid && !isNaN(Number(pid)));
                    console.log(`📋 Found ${pids.length} ${processName} processes: ${pids.join(", ")}`);
                    // Try graceful termination first
                    for (const pid of pids) {
                        try {
                            await execAsync(`kill -TERM ${pid}`);
                            console.log(`📤 Sent SIGTERM to ${processName} PID: ${pid}`);
                        }
                        catch (error) {
                            console.log(`⚠️ Could not send SIGTERM to PID ${pid}:`, error);
                        }
                    }
                }
            }
            catch (error) {
                console.log(`ℹ️ No ${processName} processes found`);
            }
        }
        // Wait for graceful termination
        await new Promise((resolve) => setTimeout(resolve, 3000));
        // Force kill any remaining processes with SIGKILL
        for (const processName of chromeProcessNames) {
            try {
                const { stdout } = await execAsync(`pgrep -f ${processName}`).catch(() => ({ stdout: "" }));
                if (stdout.trim()) {
                    const pids = stdout
                        .trim()
                        .split("\n")
                        .filter((pid) => pid && !isNaN(Number(pid)));
                    console.log(`💀 Force killing remaining ${processName} processes: ${pids.join(", ")}`);
                    for (const pid of pids) {
                        try {
                            await execAsync(`kill -KILL ${pid}`);
                            console.log(`💥 Force killed ${processName} PID: ${pid}`);
                        }
                        catch (error) {
                            console.log(`⚠️ Could not force kill PID ${pid}:`, error);
                        }
                    }
                }
            }
            catch (error) {
                console.log(`ℹ️ No remaining ${processName} processes found`);
            }
        }
        // Also try using pkill as a backup
        for (const processName of chromeProcessNames) {
            try {
                await execAsync(`pkill -9 -f ${processName}`).catch(() => { });
                console.log(`🔨 Used pkill -9 on ${processName}`);
            }
            catch (error) {
                // Ignore errors, this is just a backup method
            }
        }
        // Final check - kill any process that contains 'chrome' in its command line
        try {
            console.log("🧹 Final cleanup - killing any remaining chrome-related processes...");
            await execAsync(`pkill -9 -f ".*chrome.*"`).catch(() => { });
            await execAsync(`pkill -9 -f ".*Chrome.*"`).catch(() => { });
        }
        catch (error) {
            // Ignore errors
        }
        // Wait a bit more to ensure all processes are terminated
        await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    /**
     * Attempts to click the "Continue" button if it exists on the WhatsApp Web page
     * Waits 5 seconds before attempting to click and logs the result
     */
    async clickContinueButtonIfExists() {
        try {
            if (!this.client || !this.client.waPage) {
                console.log("❌ Cannot click Continue button: WhatsApp page not available");
                return;
            }
            console.log("⏳ Waiting 5 seconds before checking for Continue button...");
            await new Promise((resolve) => setTimeout(resolve, 5000));
            const page = this.client.waPage;
            // Define the selector for the Continue button
            const continueButtonSelector = 'button:has-text("Continue"), button[class*="x889kno x1a8lsjc x13jy36j x64bnmy x1n2onr6 x1rg5ohu xk50ysn x1f6kntn xyesn5m x1rl75mt x19t5iym xz7t8uv x13xmedi x178xt8z x1lun4ml xso031l xpilrb4 x13fuv20 x18b5jzi x1q0q8m5 x1t7ytsu x1v8p93f x1o3jo1z x16stqrj xv5lvn5 x1hl8ikr xfagghw x9dyr19 x9lcvmn x1pse0pq xcjl5na xfn3atn x1k3x3db x9qntcr xuxw1ft xv52azi"]:has-text("Continue")';
            // Alternative selectors to try
            const alternativeSelectors = [
                'button:has-text("Continue")',
                'button[aria-label*="Continue"]',
                'div:has-text("Continue"):last-child',
                '*:has-text("Continue")',
                "button.x889kno.x1a8lsjc",
            ];
            let buttonFound = false;
            let clickedSuccessfully = false;
            // Try the main selector first
            try {
                const continueButton = await page.$('button:has-text("Continue")');
                if (continueButton) {
                    console.log("✅ Continue button found using text selector");
                    await continueButton.click();
                    buttonFound = true;
                    clickedSuccessfully = true;
                    console.log("✅ Successfully clicked Continue button!");
                }
            }
            catch (error) {
                console.log("ℹ️ Text-based selector didn't work, trying alternatives...");
            }
            // If not found, try alternative selectors
            if (!buttonFound) {
                for (let i = 0; i < alternativeSelectors.length; i++) {
                    try {
                        const selector = alternativeSelectors[i];
                        console.log(`🔍 Trying selector ${i + 1}: ${selector}`);
                        const button = await page.$(selector);
                        if (button) {
                            console.log(`✅ Continue button found using selector ${i + 1}`);
                            await button.click();
                            buttonFound = true;
                            clickedSuccessfully = true;
                            console.log("✅ Successfully clicked Continue button!");
                            break;
                        }
                    }
                    catch (error) {
                        console.log(`⚠️ Selector ${i + 1} failed:`, error instanceof Error ? error.message : String(error));
                    }
                }
            }
            // If still not found, try to find by class and text content using XPath
            if (!buttonFound) {
                try {
                    console.log("🔍 Trying to find button using XPath selector...");
                    // Try using XPath to find button with "Continue" text
                    const xpathSelector = '//button[contains(text(), "Continue")]';
                    const [continueButtonXPath] = await page.$x(xpathSelector);
                    if (continueButtonXPath) {
                        console.log("✅ Continue button found using XPath selector");
                        await continueButtonXPath.click();
                        buttonFound = true;
                        clickedSuccessfully = true;
                        console.log("✅ Successfully clicked Continue button using XPath!");
                    }
                }
                catch (error) {
                    console.log("⚠️ XPath selector method failed:", error instanceof Error ? error.message : String(error));
                }
            }
            // Final logging
            if (!buttonFound) {
                console.log("ℹ️ Continue button not found - this is normal if already logged in or button doesn't exist");
                // Take a screenshot for debugging if needed
                try {
                    const screenshot = await page.screenshot({ encoding: "base64" });
                    console.log("📸 Screenshot taken for debugging (base64 length):", screenshot.length);
                }
                catch (screenshotError) {
                    console.log("⚠️ Could not take screenshot:", screenshotError instanceof Error
                        ? screenshotError.message
                        : String(screenshotError));
                }
            }
            else if (!clickedSuccessfully) {
                console.log("❌ Continue button was found but could not be clicked");
            }
        }
        catch (error) {
            console.error("❌ Error while trying to click Continue button:", error);
        }
    }
    async resetEverything() {
        console.log("🔄 Starting WhatsApp client reset...");
        // Stop any ongoing initialization process
        if (this.isInitializing) {
            console.log("🛑 Stopping ongoing initialization process...");
            this.initializationAbortController?.abort();
            this.isInitializing = false;
            this.initializationAbortController = null;
        }
        // Properly destroy the client
        if (this.client) {
            try {
                // First logout from WhatsApp to clear the session
                await this.client.logout();
                console.log("✅ WhatsApp logout successful");
                // Then close the browser/page
                await this.client.close();
                console.log("✅ WhatsApp client closed successfully");
            }
            catch (error) {
                console.error("❌ Error destroying WhatsApp client:", error);
                // Even if logout fails, try to close the client
                try {
                    await this.client.close();
                }
                catch (closeError) {
                    console.error("❌ Error closing WhatsApp client:", closeError);
                }
            }
        }
        // Reset all state variables
        this.currentQrCode = null;
        this.connectionStatus = "disconnected";
        this.whatsappNumbers = [];
        this.client = null;
        // Kill all Chrome processes comprehensively
        await this.killAllChromeProcesses();
        // Remove session tokens and browser data from filesystem
        try {
            const tokensPath = path_1.default.join(process.cwd(), "tokens");
            if (fs_1.default.existsSync(tokensPath)) {
                fs_1.default.rmSync(tokensPath, { recursive: true, force: true });
                console.log("✅ Tokens folder removed successfully");
            }
            // Also remove any session files that might be created by venom-bot
            const sessionPath = path_1.default.join(process.cwd(), `${constants_1.CONFIG.WHATSAPP_SESSION_NAME}.json`);
            if (fs_1.default.existsSync(sessionPath)) {
                fs_1.default.unlinkSync(sessionPath);
                console.log("✅ Session file removed successfully");
            }
            // Remove any other potential session files
            const sessionFiles = [
                path_1.default.join(process.cwd(), `${constants_1.CONFIG.WHATSAPP_SESSION_NAME}.zip`),
                path_1.default.join(process.cwd(), `${constants_1.CONFIG.WHATSAPP_SESSION_NAME}.crdownload`),
                path_1.default.join(process.cwd(), `${constants_1.CONFIG.WHATSAPP_SESSION_NAME}.tmp`),
            ];
            for (const file of sessionFiles) {
                if (fs_1.default.existsSync(file)) {
                    fs_1.default.unlinkSync(file);
                    console.log(`✅ Removed session file: ${path_1.default.basename(file)}`);
                }
            }
        }
        catch (error) {
            console.error("❌ Error removing session files:", error);
        }
        // Wait a bit to ensure all processes are fully terminated
        await new Promise((resolve) => setTimeout(resolve, 2000));
        // Update database to reflect disconnected state
        await this.databaseService.updateWhatsAppSession(false);
        console.log("✅ WhatsApp client reset completed");
    }
}
exports.WhatsAppClientService = WhatsAppClientService;
