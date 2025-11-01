export declare function clearCache(): void;
export declare function getCacheStatus(): {
    apiKeysCache: {
        valid: boolean;
        age: number;
    } | null;
    sheetFieldsCache: {
        valid: boolean;
        age: number;
    } | null;
    sheetCache: {
        name: string;
        exists: boolean;
        headers: boolean;
        age: number;
    }[];
    pendingMessages: {
        sheetName: string;
        count: number;
    }[];
};
export declare function syncAllSheetHeaders(): Promise<{
    sheetsUpdated: number;
    totalSheets: number;
}>;
export declare function initializeSheetsWithSync(): Promise<void>;
export declare function updateGoogleSheetId(sheetId: string): Promise<{
    success: boolean;
    sheetsUpdated: number;
    totalSheets: number;
} | undefined>;
export declare function getCurrentSheetId(): string | null;
export declare function sendToGoogleSheet(data: any, userInfo: {
    phone: string;
    name: string;
}, originalMessage?: string, messageTimestamp?: number): Promise<boolean>;
//# sourceMappingURL=googleSheets.d.ts.map