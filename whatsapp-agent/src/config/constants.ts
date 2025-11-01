export const CONFIG = {
  PORT: process.env.PORT || 3000,
  NEXT_APP_URL: process.env.NEXT_APP_URL || "http://localhost:3200",
  API_SECRET_KEY: "s3dfgERGfdKIhgn234%454$5",
  MIN_MESSAGE_LENGTH: 30,
  PERIODIC_CHECK_INTERVAL: 60 * 60 * 60 * 1000, // 3 hours in milliseconds (increased from 1 hour)
  HOURLY_RESTART_INTERVAL: 60 * 60 * 1000, // 1 hour in milliseconds
  ALLOWED_ORIGINS: [
    process.env.NEXT_APP_URL || "http://localhost:3200",
    "http://localhost:3200"
  ],
  WHATSAPP_SESSION_NAME: "whatsapp-session",
  BROWSER_CONFIG: {
    headless: "old" as const,
    browserPathExecutable: process.env.BROWSER_PATH_EXECUTABLE,
    browserArgs: ["--no-sandbox", "--disable-setuid-sandbox"] as string[],
    disableWelcome: true,
    disableSpins: true,
    autoClose: 0,
  }
} as const; 