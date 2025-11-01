"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseService = void 0;
const axios_1 = __importDefault(require("axios"));
const constants_1 = require("../config/constants");
class DatabaseService {
    constructor() { }
    static getInstance() {
        if (!DatabaseService.instance) {
            DatabaseService.instance = new DatabaseService();
        }
        return DatabaseService.instance;
    }
    async updateWhatsAppSession(isLoggedIn, lastAnalyzedMessageDate, lastProcessedMessageId) {
        console.log("11111111", isLoggedIn, lastAnalyzedMessageDate, lastProcessedMessageId);
        try {
            console.log("Sending request with key:", constants_1.CONFIG.API_SECRET_KEY);
            await axios_1.default.post(`${constants_1.CONFIG.NEXT_APP_URL}/api/whatsapp`, {
                isLoggedIn,
                lastAnalyzedMessageDate,
                lastProcessedMessageId,
            }, {
                headers: {
                    Authorization: constants_1.CONFIG.API_SECRET_KEY,
                },
            });
        }
        catch (error) {
            console.error("Failed to update WhatsApp session in database:", error);
            if (axios_1.default.isAxiosError(error)) {
                console.error("Response data:", error.response?.data);
                console.error("Response status:", error.response?.status);
            }
        }
    }
    async getWhatsAppSession() {
        try {
            console.log("Sending request with key:", constants_1.CONFIG.API_SECRET_KEY);
            const response = await axios_1.default.get(`${constants_1.CONFIG.NEXT_APP_URL}/api/whatsapp`, {
                headers: {
                    Authorization: constants_1.CONFIG.API_SECRET_KEY,
                },
            });
            return response.data;
        }
        catch (error) {
            console.error("Failed to get WhatsApp session from database:", error);
            if (axios_1.default.isAxiosError(error)) {
                console.error("Response data:", error.response?.data);
                console.error("Response status:", error.response?.status);
            }
            return { isLoggedIn: false };
        }
    }
    async getApiKeys() {
        try {
            console.log("Fetching API keys from database...");
            const response = await axios_1.default.get(`${constants_1.CONFIG.NEXT_APP_URL}/api/api-keys`, {
                headers: {
                    Authorization: constants_1.CONFIG.API_SECRET_KEY,
                },
            });
            console.log("API keys fetched successfully:", response.data);
            return response.data;
        }
        catch (error) {
            console.error("Failed to get API keys from database:", error);
            if (axios_1.default.isAxiosError(error)) {
                if (error.response?.status === 404) {
                    console.log("No API keys found in database");
                    return null;
                }
                console.error("Response data:", error.response?.data);
                console.error("Response status:", error.response?.status);
            }
            return null;
        }
    }
    async getSheetFields() {
        try {
            console.log("Fetching sheet fields from database...");
            const response = await axios_1.default.get(`${constants_1.CONFIG.NEXT_APP_URL}/api/sheet-fields`, {
                headers: {
                    Authorization: constants_1.CONFIG.API_SECRET_KEY,
                },
            });
            console.log("Sheet fields fetched successfully:", response.data);
            return response.data;
        }
        catch (error) {
            console.error("Failed to get sheet fields from database:", error);
            if (axios_1.default.isAxiosError(error)) {
                console.error("Response data:", error.response?.data);
                console.error("Response status:", error.response?.status);
            }
            return [];
        }
    }
}
exports.DatabaseService = DatabaseService;
