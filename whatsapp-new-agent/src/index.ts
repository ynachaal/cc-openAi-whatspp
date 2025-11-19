// Load environment variables from .env file
import dotenv from 'dotenv';
dotenv.config();
//import { processMessages } from './cron/aiMessageProcessor';

import { Client, LocalAuth } from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
import { MessageProcessor } from './services/messageProcessor';
import { DatabaseService } from './services/database';
//import './cron/clientSheet';   // <-- this runs the cron automatically
//processMessages();
import './cron/masterCron'; 
interface WhatsAppAgentConfig {
  sessionName?: string;
  headless?: boolean;
  debug?: boolean;
}

class WhatsAppAgent {
  private scanTimer: NodeJS.Timeout | null = null;
  private readonly SCAN_INTERVAL = 5000; // 5 minutes
  private client: Client | null = null;
  private config: WhatsAppAgentConfig;
  private isAuthenticated: boolean = false;
  private isReady: boolean = false;
  private isInitialized: boolean = false;
  private qrCodeCallbacks: ((qr: string, renderedQrCode?: string) => void)[] = [];
  private statusCallbacks: ((status: { authenticated: boolean; ready: boolean }) => void)[] = [];
  private messageCallbacks: ((message: any) => void)[] = [];
  private messageProcessor: MessageProcessor;
  private databaseService: DatabaseService;
  private whatsappNumbers: string[] = [];
  private refreshTimer: NodeJS.Timeout | null = null;
  private readonly REFRESH_INTERVAL = 60 * 60 * 1000; // 1 hour in milliseconds
  private startScanTimer(): void {
    if (this.scanTimer) {
      clearInterval(this.scanTimer);
    }

    console.log('⏰ Starting scan timer for new WhatsApp messages (every 5 minutes)');
    this.scanTimer = setInterval(async () => {
      try {
        await this.scanAndInsertNewMessages();
      } catch (error) {
        console.error('❌ Error during periodic message scan:', error);
      }
    }, this.SCAN_INTERVAL);
  }

  private clearScanTimer(): void {
    if (this.scanTimer) {
      console.log('🛑 Clearing scan timer');
      clearInterval(this.scanTimer);
      this.scanTimer = null;
    }
  }
  constructor(config: WhatsAppAgentConfig = {}) {
    this.config = {
      sessionName: 'whatsapp-new-agent',
      headless: true,
      debug: false,
      ...config
    };

    // Initialize services
    this.messageProcessor = MessageProcessor.getInstance();
    this.databaseService = DatabaseService.getInstance();

    this.client = new Client({
      authStrategy: new LocalAuth({
        clientId: this.config.sessionName || 'whatsapp-new-agent'
      }),
      puppeteer: (() => {
        const chromePath = process.env['CHROME_PATH'] || this.getChromeExecutablePath();
        const config: any = {
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

  private getChromeExecutablePath(): string | undefined {
    // Check for environment variable first
    if (process.env['CHROME_PATH']) {
      return process.env['CHROME_PATH'];
    }

    // Try to find installed Chrome in Puppeteer cache
    const platform = process.platform;
    const homeDir = process.env['HOME'] || process.env['USERPROFILE'];

    if (!homeDir) return undefined;

    let chromePath: string;

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
    } catch (error) {
      console.log(`⚠️ Could not check Chrome path: ${chromePath}`);
    }

    console.log(`⚠️ Chrome not found in Puppeteer cache, using system Chrome`);
    return undefined;
  }

  private getCurrentWhatsAppNumbers(): string[] {
    return this.whatsappNumbers;
  }
  public async scanAndInsertNewMessages(): Promise<void> {
    console.log('⚠️ scanAndInsertNewMessages');

    if (!this.isReady || !this.isAuthenticated) {
      console.log('⚠️ WhatsApp client not ready, skipping scan');
      return;
    }

    try {
      const chats = await this.getChats();
      const currentNumbers = this.getCurrentWhatsAppNumbers(); // your admin numbers
      if (!currentNumbers.length) {
        console.log('⚠️ No WhatsApp numbers configured, skipping scan');
        return;
      }

      // Helper to clean number
      function clean(id: string | undefined) {
        return (id ?? "").replace(/@.+$/, "");
      }

      let totalInserted = 0;

      for (const chat of chats) {

        // --- 1️⃣ Skip GROUPS & BROADCASTS ---
        if (chat.isGroup || chat.id.server === "g.us") continue;
        if (chat.id.server === "broadcast") continue;

        // --- 2️⃣ Only chats related to your admin numbers ---
        const chatNumber = clean(chat.id._serialized);

        const isRelevantChat = currentNumbers.some(num =>
          chatNumber.endsWith(clean(num))
        );

        if (!isRelevantChat) continue;

        // --- 3️⃣ Fetch last messages ---
        const messages = await chat.fetchMessages({ limit: 100 });

        for (const message of messages) {
          const messageDate = new Date(message.timestamp * 1000);

          if (!message.body || message.body.trim() === "") continue;

          // Skip duplicates
          const existing = await this.databaseService.getClientMessageByMessageId(
            message.id._serialized
          );
          if (existing) continue;

          // Determine direction
          const isIncoming = message.from
            ? !currentNumbers.some(num => clean(message.from!) === clean(num))
            : false;
          const direction = isIncoming ? "incoming" : "outgoing";

          console.log(`📨 New ${direction} message from ${message.from} at ${messageDate.toISOString()}: "${message.body.substring(0, 50)}..."`);
          // --- 4️⃣ Extract client/admin name ---
          const contact = await message.getContact();

          let clientName = "";
          if (isIncoming) {
            // Incoming → contact is client

            clientName =
              contact?.name ||
              contact?.notifyName ||
              chat.name ||
              chat.contact?.pushname ||
              chat.contact?.name ||
              chat.contact?.notifyName ||
              "";
            console.log("==== Debug Contact Fields ====");
            console.log("contact.pushname:", contact?.pushname);
            console.log("contact.name:", contact?.name);
            console.log("contact.notifyName:", contact?.notifyName);
            console.log("chat.name:", chat.name);
            console.log("chat.contact.pushname:", chat.contact?.pushname);
            console.log("chat.contact.name:", chat.contact?.name);
            console.log("chat.contact.notifyName:", chat.contact?.notifyName);
            console.log("message.from:", message.from);
            console.log("message.to:", message.to);
            console.log("isIncoming:", isIncoming);
            console.log("==============================");
          } else {
            // Outgoing → message.getContact() is YOU (admin)
            // So use chat.contact to get client
            clientName =
              chat.name ||
              chat.contact?.pushname ||
              chat.contact?.name ||
              chat.contact?.notifyName ||
              "";
          }

          console.log(`Extracted client name: ${clientName}`);

          // --- 5️⃣ Only save if CLT name appears (Incoming or Outgoing) ---
          if (!clientName.toLowerCase().includes("clt")) continue;
          console.log(`message.to`, message.to);
          console.log(`message.from`, message.from);
          // Save message
          await this.databaseService.saveClientMessage({
            clientName,
            number: isIncoming ? message.from : message.from,
            direction,
            message: message.body,
            timestamp: messageDate,
            messageId: message.id._serialized,
          });

          totalInserted++;
        }
      }

      console.log(`✅ Scan complete. Inserted ${totalInserted} new messages.`);
    } catch (error) {
      console.error("❌ Error scanning and inserting messages:", error);
    }
  }

  private setupEventHandlers(): void {
    this.client?.on('qr', (qr: string) => {
      qrcode.generate(qr, { small: true }, (renderedQrCode) => {
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
      this.startRefreshTimer();
      // Update database with authentication status
      try {
        await this.databaseService.updateWhatsAppSession(true);
        console.log('✅ Updated database: User is logged in');
      } catch (error) {
        console.error('❌ Failed to update database authentication status:', error);
      }

      // Load WhatsApp numbers from database
      await this.loadWhatsAppNumbers();

      // Start the refresh timer
      this.startRefreshTimer();
      this.startScanTimer(); // << ADD THIS
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

    this.client?.on('auth_failure', async (msg: string) => {
      console.error('Authentication failed:', msg);
      this.isAuthenticated = false;
      this.isReady = false;

      // Update database with authentication failure
      try {
        await this.databaseService.updateWhatsAppSession(false);
        console.log('✅ Updated database: User authentication failed');
      } catch (error) {
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
        const isFromListeningGroup = currentNumbers.some(
          (number) => messageFrom === number || messageFrom.includes(number)
        );

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
              notifyName: (message as any).notifyName || null
            }
          });
        });

        // Process the message automatically
        const processingResult = await this.messageProcessor.processMessage(message, messageFrom);

        // Update database with last processed message info if processing was successful
        if (processingResult) {
          try {
            await this.databaseService.updateWhatsAppSession(
              true, // isLoggedIn
              processingResult.timestamp, // lastAnalyzedMessageDate
              processingResult.messageId, // lastProcessedMessageId
              undefined // activeListeningGroups
            );
            console.log(`✅ Updated database with last processed message: ${processingResult.messageId} at ${processingResult.timestamp.toISOString()}`);
          } catch (error) {
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
      } catch (error) {
        console.error('❌ Error processing message:', error);
      }
    });

    this.client?.on('disconnected', async (reason: string) => {
      console.log('WhatsApp client was disconnected:', reason);
      this.isAuthenticated = false;
      this.isReady = false;

      // Clear the refresh timer
      this.clearRefreshTimer();
      this.clearScanTimer(); // << ADD THIS

      // Update database with disconnection status
      try {
        await this.databaseService.updateWhatsAppSession(false);
        console.log('✅ Updated database: User disconnected');
      } catch (error) {
        console.error('❌ Failed to update database authentication status:', error);
      }

      this.notifyStatusChange();
    });
  }

  getCurrentStatusCallbacks = () => this.statusCallbacks;

  private notifyStatusChange(): void {
    const status = {
      authenticated: this.isAuthenticated,
      ready: this.isReady
    };
    // Use arrow function to access current statusCallbacks array
    const currentCallbacks = this.getCurrentStatusCallbacks();
    currentCallbacks.forEach(callback => callback(status));
  }

  // Public methods for status monitoring
  public onQRCode(callback: (qr: string, renderedQrCode?: string) => void): void {
    this.qrCodeCallbacks.push(callback);
  }

  public onStatusChange(callback: (status: { authenticated: boolean; ready: boolean }) => void): void {
    this.statusCallbacks.push(callback);
  }

  public onMessage(callback: (message: any) => void): void {
    this.messageCallbacks.push(callback);
  }

  public getAuthenticationStatus(): { authenticated: boolean; ready: boolean } {
    return {
      authenticated: this.isAuthenticated,
      ready: this.isReady
    };
  }

  private async loadWhatsAppNumbers(): Promise<void> {
    try {
      console.log('🔄 Loading WhatsApp numbers from database...');
      const session = await this.databaseService.getWhatsAppSession();

      if (session.activeListeningGroups) {
        this.whatsappNumbers = Array.isArray(session.activeListeningGroups)
          ? session.activeListeningGroups
          : JSON.parse(session.activeListeningGroups);

        console.log(`✅ Loaded ${this.whatsappNumbers.length} WhatsApp numbers:`, this.whatsappNumbers);
      } else {
        this.whatsappNumbers = [];
        console.log('⚠️ No WhatsApp numbers configured in database');
      }
    } catch (error) {
      console.error('❌ Error loading WhatsApp numbers:', error);
      this.whatsappNumbers = [];
    }
  }

  public getWhatsAppNumbers(): string[] {
    return this.whatsappNumbers;
  }

  public setWhatsAppNumbers(numbers: string[]): void {
    this.whatsappNumbers = numbers;
    console.log(`✅ WhatsApp numbers updated:`, this.whatsappNumbers);
  }

  public async refreshWhatsAppNumbers(): Promise<void> {
    try {
      console.log('🔄 Refreshing WhatsApp numbers from database...');
      await this.loadWhatsAppNumbers();
      console.log(`✅ WhatsApp numbers refreshed:`, this.whatsappNumbers);
    } catch (error) {
      console.error('❌ Error refreshing WhatsApp numbers:', error);
    }
  }

  public async refreshWhatsAppPage(): Promise<void> {
    try {
      if (this.client?.pupPage) {
        console.log('🔄 Refreshing WhatsApp page...');
        // await this.client.pupPage.reload();
        console.log('✅ WhatsApp page refreshed successfully');
      } else {
        console.log('⚠️ WhatsApp page not available for refresh');
      }
    } catch (error) {
      console.error('❌ Error refreshing WhatsApp page:', error);
    }
  }

  public async manualRefresh(): Promise<void> {
    console.log('🔄 Manual WhatsApp page refresh requested');
    await this.refreshWhatsAppPage();
  }

  public async scanForMissedMessages(): Promise<void> {
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
          const isListeningChat = currentNumbers.some(
            (number) => chat.id._serialized === number || chat.id._serialized.includes(number)
          );

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
        } catch (error) {
          console.error(`❌ Error scanning chat ${chat.id}:`, error);
        }
      }

      // Update database with new timestamp and message ID if we processed any messages
      if (totalMessagesProcessed > 0) {
        await this.databaseService.updateWhatsAppSession(
          true, // isLoggedIn
          latestProcessedTimestamp, // lastAnalyzedMessageDate
          latestProcessedMessageId, // lastProcessedMessageId
          undefined // activeListeningGroups
        );
        console.log(`✅ Processed ${totalMessagesProcessed} missed messages`);
        console.log(`📅 Updated last analyzed date to: ${latestProcessedTimestamp.toISOString()}`);
        console.log(`🆔 Updated last processed message ID to: ${latestProcessedMessageId}`);
      } else {
        console.log('✅ No missed messages found');
      }

    } catch (error) {
      console.error('❌ Error scanning for missed messages:', error);
    }
  }

  private startRefreshTimer(): void {
    if (this.refreshTimer) {
      this.clearRefreshTimer();
    }

    console.log('⏰ Starting WhatsApp page refresh timer (1 hour interval)');
    this.refreshTimer = setInterval(async () => {
      if (this.isReady && this.isAuthenticated) {
        await this.refreshWhatsAppPage();
      } else {
        console.log('⚠️ Skipping page refresh - WhatsApp not ready or authenticated');
      }
    }, this.REFRESH_INTERVAL);
  }

  private clearRefreshTimer(): void {
    if (this.refreshTimer) {
      console.log('🛑 Clearing WhatsApp page refresh timer');
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  public async initialize(): Promise<void> {
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
    } catch (error) {
      console.error('Failed to initialize WhatsApp agent:', error);
      throw error;
    }
  }

  public async forceInitialize(): Promise<void> {
    try {
      console.log('🚀 Force initializing WhatsApp agent (bypassing database check)...');

      // If client is already initialized, destroy it first to force new QR code generation
      if (this.isInitialized || this.isReady || this.isAuthenticated) {
        console.log('🔄 Client already initialized, destroying first to generate new QR code...');
        try {
          await this.client?.destroy();
          console.log('✅ Client destroyed successfully');
        } catch (destroyError) {
          console.log('⚠️ Error destroying client (might not be initialized):', destroyError);
        }

        // Reset states
        this.isInitialized = false;
        this.isReady = false;
        this.isAuthenticated = false;

        // Create new client instance
        this.client = new Client({
          authStrategy: new LocalAuth({
            clientId: this.config.sessionName || 'whatsapp-new-agent'
          }),
          puppeteer: (() => {
            const chromePath = process.env['CHROME_PATH'] || this.getChromeExecutablePath();
            const config: any = {
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
    } catch (error) {
      console.error('Failed to force initialize WhatsApp agent:', error);
      throw error;
    }
  }

  public async sendMessage(to: string, message: string): Promise<void> {
    try {
      const chatId = to.includes('@c.us') ? to : `${to}@c.us`;
      await this.client?.sendMessage(chatId, message);
      console.log(`Message sent to ${to}: ${message}`);
    } catch (error) {
      console.error('Failed to send message:', error);
      throw error;
    }
  }

  public async getChats(): Promise<any[]> {
    try {
      return await this.client?.getChats() || [];
    } catch (error) {
      console.error('Failed to get chats:', error);
      throw error;
    }
  }

  public async isConnected(): Promise<boolean> {
    try {
      return this.client?.pupPage !== null && this.client?.pupPage !== undefined;
    } catch (error) {
      return false;
    }
  }

  public async destroy(): Promise<void> {
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
    } catch (error) {
      console.error('Failed to destroy WhatsApp agent:', error);
      throw error;
    }
  }

}

// Export the main class
export default WhatsAppAgent;

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
