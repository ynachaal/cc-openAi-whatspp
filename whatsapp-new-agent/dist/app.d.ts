export declare class WhatsAppNewAgentApp {
    private static instance;
    private app;
    private server;
    private wss;
    private webSocketHandler;
    private constructor();
    static getInstance(): WhatsAppNewAgentApp;
    private setupMiddleware;
    private setupWebSocket;
    start(): Promise<void>;
    stop(): void;
}
//# sourceMappingURL=app.d.ts.map