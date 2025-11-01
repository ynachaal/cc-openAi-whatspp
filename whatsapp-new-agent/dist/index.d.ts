interface WhatsAppAgentConfig {
    sessionName?: string;
    headless?: boolean;
    debug?: boolean;
}
declare class WhatsAppAgent {
    private client;
    private config;
    private isAuthenticated;
    private isReady;
    private isInitialized;
    private qrCodeCallbacks;
    private statusCallbacks;
    private messageCallbacks;
    private messageProcessor;
    private databaseService;
    private whatsappNumbers;
    private refreshTimer;
    private readonly REFRESH_INTERVAL;
    constructor(config?: WhatsAppAgentConfig);
    private getChromeExecutablePath;
    private getCurrentWhatsAppNumbers;
    private setupEventHandlers;
    getCurrentStatusCallbacks: () => ((status: {
        authenticated: boolean;
        ready: boolean;
    }) => void)[];
    private notifyStatusChange;
    onQRCode(callback: (qr: string, renderedQrCode?: string) => void): void;
    onStatusChange(callback: (status: {
        authenticated: boolean;
        ready: boolean;
    }) => void): void;
    onMessage(callback: (message: any) => void): void;
    getAuthenticationStatus(): {
        authenticated: boolean;
        ready: boolean;
    };
    private loadWhatsAppNumbers;
    getWhatsAppNumbers(): string[];
    setWhatsAppNumbers(numbers: string[]): void;
    refreshWhatsAppNumbers(): Promise<void>;
    refreshWhatsAppPage(): Promise<void>;
    manualRefresh(): Promise<void>;
    scanForMissedMessages(): Promise<void>;
    private startRefreshTimer;
    private clearRefreshTimer;
    initialize(): Promise<void>;
    forceInitialize(): Promise<void>;
    sendMessage(to: string, message: string): Promise<void>;
    getChats(): Promise<any[]>;
    isConnected(): Promise<boolean>;
    destroy(): Promise<void>;
}
export default WhatsAppAgent;
//# sourceMappingURL=index.d.ts.map