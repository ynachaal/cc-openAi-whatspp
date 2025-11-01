import { WebSocket } from "ws";
export declare class WebSocketHandler {
    private static instance;
    private whatsappAgent;
    private connectedClients;
    private isInitialized;
    private isStartupInitialized;
    private constructor();
    static getInstance(): WebSocketHandler;
    private setupAgentCallbacks;
    private broadcastToAllClients;
    private initializeAgent;
    initializeAgentOnStartup(): Promise<void>;
    forceReAuthentication(): Promise<void>;
    private validateOrigin;
    private sendMessage;
    handleConnection(ws: WebSocket, req: any): void;
    private handleMessage;
    private handleLogin;
    private handleLogout;
    private handleHealthCheck;
    private handleCheckLoginStatus;
    private handleGetChats;
    private handleSendMessage;
    private handleSetWhatsAppNumber;
    private handleSetWhatsAppNumbers;
    private handleResetEverything;
    private handleRefreshApiKeys;
    private handleGetChatMessagesByDate;
    private handleAnalyzeHistoricalMessages;
    private handleRefreshWhatsAppNumbers;
    private handleGetWhatsAppNumbers;
    private handleSyncSheetColumns;
}
//# sourceMappingURL=websocketHandler.d.ts.map