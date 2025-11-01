import { Message } from "whatsapp-web.js";
export declare class MessageProcessor {
    private static instance;
    private constructor();
    static getInstance(): MessageProcessor;
    private extractUserInfo;
    private createTimestampFromMessage;
    private validateTimestamp;
    processMessage(message: Message, whatsappNumber: string): Promise<{
        timestamp: Date;
        messageId: string;
    } | null>;
    processHistoricalMessage(message: Message, lastAnalyzedDate: Date): Promise<{
        timestamp: Date;
        messageId: string;
    } | null>;
}
//# sourceMappingURL=messageProcessor.d.ts.map