# Hourly WhatsApp Restart Guide

## Overview

This guide explains the new hourly restart functionality that automatically closes and reopens WhatsApp connections every hour, and shuts down the server after 24 hours.

## Why Hourly Restarts?

- **Prevents connection issues**: WhatsApp Web connections can become stale or unstable over time
- **Ensures fresh sessions**: Each restart creates a new, clean connection
- **Reduces memory leaks**: Regular restarts help prevent memory accumulation
- **Maintains reliability**: Consistent behavior over long-running periods
- **Automated maintenance**: No manual intervention required

## How It Works

### 1. **Hourly Cycle**
- Every hour, the system automatically:
  - Stops message processing
  - Reloads WhatsApp page
  - Waits for page reload (5 seconds)
  - Verifies connection stability
  - Runs historical message analysis (with duplicate prevention)
  - Restarts message processing

### 2. **Continuous Operation**
- The restart cycle runs indefinitely to maintain connection stability
- No automatic shutdown - the system keeps running continuously
- Each restart refreshes the WhatsApp page while maintaining the session
- Historical message analysis runs after each restart with duplicate prevention
- System tracks both timestamp and message ID to prevent reprocessing

## Configuration

### Environment-Based Settings

The system automatically adjusts based on your environment:

#### **Production Mode** (default)
```typescript
HOURLY_RESTART_INTERVAL: 60 * 60 * 1000, // 1 hour
CLEANUP_DELAY: 5000,                      // 5 seconds
```

#### **Development Mode**
```typescript
HOURLY_RESTART_INTERVAL: 5 * 60 * 1000,  // 5 minutes
CLEANUP_DELAY: 2000,                      // 2 seconds
```

### Custom Configuration

Edit `src/config/restartConfig.ts` to customize:

```typescript
export const RESTART_CONFIG = {
  HOURLY_RESTART_INTERVAL: 60 * 60 * 1000, // Custom interval
  CLEANUP_DELAY: 3000,                      // Custom cleanup delay
  RUN_HISTORICAL_ANALYSIS_AFTER_RESTART: true, // Enable/disable analysis
  // ... other settings
};
```

## Monitoring

### API Endpoint

Check restart status via HTTP API:

```bash
GET /api/restart-status
```

**Response:**
```json
{
  "restartCount": 5,
  "totalRestarts": 5,
  "uptime": "5 hours",
  "nextRestartIn": 60,
  "status": "Running indefinitely - maintaining connection stability"
}
```

### Log Messages

The system provides detailed logging:

```
🔄 Starting hourly WhatsApp restart cycle...
⏰ Will restart every 60 minutes
♾️ Restart cycle will run indefinitely to maintain connection stability

🔄 Starting restart cycle 1 - maintaining connection stability
⏹️ Stopping message processing...
🔄 Reloading WhatsApp page...
⏳ Waiting for page reload to complete...
🔄 Continuing restart cycle 1 - maintaining connection stability
🔍 Verifying WhatsApp connection stability...
✅ WhatsApp connection verified and stable
🔍 Running historical message analysis...
⏰ Restarting message processing...
✅ Restart cycle 1 completed successfully
```

## Troubleshooting

### Common Issues

#### **Connection Verification Fails**
- The system continues the cycle even if verification fails
- Check WhatsApp Web availability
- Verify browser configuration
- Check if page reload completed successfully

#### **Historical Analysis Fails**
- Analysis failures don't stop the restart cycle
- Check Google Sheets API quotas
- Verify OpenAI API access

#### **Server Performance Issues**
- Monitor restart frequency and timing
- Check for memory leaks during long running periods
- Verify browser cleanup is working properly

### Manual Control

#### **Stop Restart Cycle**
```typescript
const restartManager = RestartManager.getInstance();
restartManager.stopHourlyRestartCycle();
```

#### **Reset Restart Count**
```typescript
restartManager.resetRestartCount();
```

#### **Check Status**
```typescript
console.log(`Restarts: ${restartManager.getRestartCount()}`);
console.log(`Total: ${restartManager.getTotalRestarts()}`);
console.log(`Uptime: ${restartManager.getUptimeInfo().runningTime}`);
```

## Integration

### With Existing Services

The restart manager integrates seamlessly with:

- **WhatsAppClientService**: Manages connection lifecycle, real-time message processing, and page reloads
- **PeriodicTaskManager**: Runs historical analysis after restarts
- **DatabaseService**: Updates connection state
- **WebSocketHandler**: Maintains client connections

### Startup Sequence

1. WhatsApp client initializes
2. Restart cycle starts automatically
3. First restart occurs after 1 hour
4. Cycle continues every hour indefinitely
5. System maintains optimal connection stability through page reloads

## Best Practices

### **Production Deployment**
- Use production configuration (1-hour intervals)
- Monitor restart logs for issues
- Set up process manager (PM2, systemd) for auto-restart
- Monitor long-term performance and memory usage
- Consider using the API endpoint for monitoring

### **Development/Testing**
- Use development configuration (5-minute intervals)
- Monitor restart behavior closely
- Test reconnection scenarios
- Verify graceful shutdown

### **Monitoring**
- Check `/api/restart-status` regularly
- Monitor log files for restart patterns
- Set up alerts for failed reconnections
- Track restart count progression

## Example Usage

### **Basic Implementation**
```typescript
import { RestartManager } from './services/restartManager';

// Start the restart cycle
const restartManager = RestartManager.getInstance();
restartManager.startHourlyRestartCycle();

// Check status
console.log(`Restarts: ${restartManager.getRestartCount()}`);
```

### **Custom Configuration**
```typescript
// In restartConfig.ts
export const RESTART_CONFIG = {
  HOURLY_RESTART_INTERVAL: 30 * 60 * 1000, // 30 minutes
  CLEANUP_DELAY: 3000,                      // 3 seconds
  // ... other custom settings
};
```

## Conclusion

The hourly restart system provides automated WhatsApp page refresh management, ensuring reliable operation indefinitely while maintaining system stability and performance. The system runs continuously without shutdown, using page reloads to maintain fresh connections while preserving the WhatsApp session and providing consistent message processing capabilities.
