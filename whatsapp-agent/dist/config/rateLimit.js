"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RATE_LIMIT_CONFIG = void 0;
exports.getRateLimitConfig = getRateLimitConfig;
// Rate limiting configuration for Google Sheets API
exports.RATE_LIMIT_CONFIG = {
    // Google Sheets API limits
    GOOGLE_SHEETS: {
        maxRequestsPerMinute: 60, // Conservative limit (Google's default is 100 per minute per user)
        delayBetweenRequests: 1000, // 1 second between requests
        batchSize: 10, // Process up to 10 items in a single API call
        retryDelay: 60000, // 1 minute delay when rate limit is hit
        maxRetries: 3, // Maximum number of retry attempts
    },
    // Historical message processing
    HISTORICAL_PROCESSING: {
        batchSize: 5, // Process 5 messages at a time
        delayBetweenBatches: 3000, // 3 seconds between batches
        maxMessagesPerRun: 100, // Maximum messages to process in one historical run
    },
    // Cache settings
    CACHE: {
        sheetExistenceTTL: 5 * 60 * 1000, // 5 minutes cache TTL for sheet existence
        headersTTL: 5 * 60 * 1000, // 5 minutes cache TTL for headers
    }
};
// Environment-based overrides
function getRateLimitConfig() {
    return {
        ...exports.RATE_LIMIT_CONFIG,
        GOOGLE_SHEETS: {
            ...exports.RATE_LIMIT_CONFIG.GOOGLE_SHEETS,
            maxRequestsPerMinute: parseInt(process.env.GOOGLE_SHEETS_RATE_LIMIT || '60'),
            delayBetweenRequests: parseInt(process.env.GOOGLE_SHEETS_DELAY || '1000'),
            batchSize: parseInt(process.env.GOOGLE_SHEETS_BATCH_SIZE || '10'),
        },
        HISTORICAL_PROCESSING: {
            ...exports.RATE_LIMIT_CONFIG.HISTORICAL_PROCESSING,
            batchSize: parseInt(process.env.HISTORICAL_BATCH_SIZE || '5'),
            delayBetweenBatches: parseInt(process.env.HISTORICAL_BATCH_DELAY || '3000'),
            maxMessagesPerRun: parseInt(process.env.HISTORICAL_MAX_MESSAGES || '100'),
        }
    };
}
