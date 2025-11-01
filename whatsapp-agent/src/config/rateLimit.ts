// Rate limiting configuration for Google Sheets API
export const RATE_LIMIT_CONFIG = {
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
} as const;

// Environment-based overrides
export function getRateLimitConfig() {
  return {
    ...RATE_LIMIT_CONFIG,
    GOOGLE_SHEETS: {
      ...RATE_LIMIT_CONFIG.GOOGLE_SHEETS,
      maxRequestsPerMinute: parseInt(process.env.GOOGLE_SHEETS_RATE_LIMIT || '60'),
      delayBetweenRequests: parseInt(process.env.GOOGLE_SHEETS_DELAY || '1000'),
      batchSize: parseInt(process.env.GOOGLE_SHEETS_BATCH_SIZE || '10'),
    },
    HISTORICAL_PROCESSING: {
      ...RATE_LIMIT_CONFIG.HISTORICAL_PROCESSING,
      batchSize: parseInt(process.env.HISTORICAL_BATCH_SIZE || '5'),
      delayBetweenBatches: parseInt(process.env.HISTORICAL_BATCH_DELAY || '3000'),
      maxMessagesPerRun: parseInt(process.env.HISTORICAL_MAX_MESSAGES || '100'),
    }
  };
}
