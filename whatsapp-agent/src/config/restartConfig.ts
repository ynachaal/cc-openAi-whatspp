// Configuration for the hourly restart cycle
export const RESTART_CONFIG = {
  // Timing settings
  HOURLY_RESTART_INTERVAL: 60 * 60 * 1000, // 1 hour in milliseconds
  
  // Cleanup settings
  CLEANUP_DELAY: 15000, // Delay in milliseconds after closing WhatsApp connection
  
  // Behavior settings
  CONTINUE_ON_RECONNECTION_FAILURE: true, // Whether to continue cycle if reconnection fails
  RUN_HISTORICAL_ANALYSIS_AFTER_RESTART: true, // Whether to run historical analysis after each restart
  
  // Logging settings
  LOG_RESTART_PROGRESS: true, // Whether to log detailed restart progress
  LOG_CLEANUP_STEPS: true, // Whether to log cleanup steps
  
  // Environment-specific overrides
  OVERRIDES: {
    // For development/testing - shorter intervals
    development: {
      HOURLY_RESTART_INTERVAL: 5 * 60 * 1000, // 5 minutes
      CLEANUP_DELAY: 2000, // 2 seconds
    },
    // For production - standard intervals
    production: {
      HOURLY_RESTART_INTERVAL: 60 * 60 * 1000, // 1 hour
      CLEANUP_DELAY: 5000, // 5 seconds
    }
  }
} as const;

// Helper function to get configuration based on environment
export function getRestartConfig() {
  const env = process.env.NODE_ENV || 'production';
  const baseConfig = {
    HOURLY_RESTART_INTERVAL: RESTART_CONFIG.HOURLY_RESTART_INTERVAL,
    CLEANUP_DELAY: RESTART_CONFIG.CLEANUP_DELAY,
    CONTINUE_ON_RECONNECTION_FAILURE: RESTART_CONFIG.CONTINUE_ON_RECONNECTION_FAILURE,
    RUN_HISTORICAL_ANALYSIS_AFTER_RESTART: RESTART_CONFIG.RUN_HISTORICAL_ANALYSIS_AFTER_RESTART,
    LOG_RESTART_PROGRESS: RESTART_CONFIG.LOG_RESTART_PROGRESS,
    LOG_CLEANUP_STEPS: RESTART_CONFIG.LOG_CLEANUP_STEPS,
  };
  
  if (env === 'development' && RESTART_CONFIG.OVERRIDES.development) {
    return { ...baseConfig, ...RESTART_CONFIG.OVERRIDES.development };
  }
  
  return baseConfig;
}
