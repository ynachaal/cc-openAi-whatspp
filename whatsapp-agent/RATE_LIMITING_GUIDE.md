# Rate Limiting Guide for WhatsApp Agent

## Overview

This guide explains the rate limiting improvements implemented to prevent Google Sheets API quota exceeded errors.

## Problem

The WhatsApp agent was hitting Google Sheets API rate limits, specifically:
- **Error**: "Quota exceeded for quota metric 'Read requests' and limit 'Read requests per minute per user'"
- **Cause**: Too many API calls during historical message analysis and real-time message processing

## Solutions Implemented

### 1. Rate Limiting Configuration

The system now uses configurable rate limits defined in `src/config/rateLimit.ts`:

```typescript
export const RATE_LIMIT_CONFIG = {
  GOOGLE_SHEETS: {
    maxRequestsPerMinute: 60,        // Conservative limit (Google's default is 100)
    delayBetweenRequests: 1000,      // 1 second between requests
    batchSize: 10,                   // Process 10 items per API call
    retryDelay: 60000,               // 1 minute delay on rate limit
    maxRetries: 3,                   // Maximum retry attempts
  },
  HISTORICAL_PROCESSING: {
    batchSize: 5,                    // Process 5 messages at a time
    delayBetweenBatches: 3000,      // 3 seconds between batches
    maxMessagesPerRun: 100,          // Max messages per historical run
  }
}
```

### 2. Caching System

- **Sheet Existence Cache**: Caches sheet existence for 5 minutes
- **Headers Cache**: Caches header information for 5 minutes
- **Reduces API calls** by avoiding repeated checks

### 3. Batch Processing

- **Real-time messages**: Processed individually with rate limiting
- **Historical messages**: Processed in batches of 5 with delays between batches
- **Property arrays**: Batched into groups of 10 for Google Sheets API calls

### 4. Increased Periodic Check Interval

- **Before**: Every 1 hour
- **After**: Every 3 hours
- **Reduces frequency** of historical message analysis

## Environment Variables

You can override default settings using environment variables:

```bash
# Google Sheets API rate limiting
GOOGLE_SHEETS_RATE_LIMIT=60          # Requests per minute
GOOGLE_SHEETS_DELAY=1000             # Delay between requests (ms)
GOOGLE_SHEETS_BATCH_SIZE=10          # Batch size for API calls

# Historical message processing
HISTORICAL_BATCH_SIZE=5              # Messages per batch
HISTORICAL_BATCH_DELAY=3000          # Delay between batches (ms)
HISTORICAL_MAX_MESSAGES=100          # Max messages per run
```

## Monitoring

The system logs rate limiting activities:

```
⚠️ Rate limit reached, waiting 45 seconds...
📦 Processing 3 batches of up to 5 messages each
📦 Processing batch 1/3 with 5 messages
⏳ Waiting 3 seconds before processing next batch...
📊 Batch appended 10 items to Buy_Properties
```

## Best Practices

1. **Start Conservative**: Begin with default settings (60 requests/minute)
2. **Monitor Logs**: Watch for rate limit warnings
3. **Adjust Gradually**: Increase limits only if needed
4. **Use Batching**: Let the system process messages in batches
5. **Respect Delays**: Don't reduce delays between batches

## Troubleshooting

### Still Getting Rate Limit Errors?

1. **Reduce `maxRequestsPerMinute`** to 30-40
2. **Increase `delayBetweenRequests`** to 2000-3000ms
3. **Reduce `batchSize`** to 5-8
4. **Increase `delayBetweenBatches`** to 5000-10000ms

### Performance Issues?

1. **Increase `maxRequestsPerMinute`** to 80-90
2. **Decrease `delayBetweenRequests`** to 500ms
3. **Increase `batchSize`** to 15-20
4. **Decrease `delayBetweenBatches`** to 1000-2000ms

## Default Configuration

The system uses conservative defaults that should work for most use cases:

- **60 requests per minute** (well below Google's 100 limit)
- **1 second delays** between requests
- **5 message batches** for historical processing
- **3 second delays** between batches
- **3 hour intervals** for periodic checks

These settings prioritize reliability over speed and should prevent quota exceeded errors while maintaining good performance.
