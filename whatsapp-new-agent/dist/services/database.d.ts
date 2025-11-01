import { WhatsAppSession } from "../types/whatsapp";
export interface ApiKeys {
    id?: string;
    googleSheetId?: string;
    openaiKey?: string;
    googleClientEmail?: string;
    googlePrivateKey?: string;
    createdAt?: string;
    updatedAt?: string;
}
export declare class DatabaseService {
    private static instance;
    private constructor();
    static getInstance(): DatabaseService;
    updateWhatsAppSession(isLoggedIn?: boolean, lastAnalyzedMessageDate?: Date, lastProcessedMessageId?: string, activeListeningGroups?: string[]): Promise<void>;
    getWhatsAppSession(): Promise<WhatsAppSession>;
    getApiKeys(): Promise<ApiKeys | null>;
    getSheetFields(): Promise<any[]>;
    checkAuthenticationStatus(): Promise<boolean>;
}
//# sourceMappingURL=database.d.ts.map