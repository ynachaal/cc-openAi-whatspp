"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CONFIG = void 0;
exports.CONFIG = {
    PORT: process.env['PORT'] || 3000, // Different port from the original agent
    NEXT_APP_URL: process.env['NEXT_APP_URL'] || "http://localhost:3200",
    API_SECRET_KEY: "s3dfgERGfdKIhgn234%454$5",
    MIN_MESSAGE_LENGTH: 30,
    PERIODIC_CHECK_INTERVAL: 60 * 60 * 60 * 1000, // 3 hours in milliseconds
    HOURLY_RESTART_INTERVAL: 60 * 60 * 1000, // 1 hour in milliseconds
    ALLOWED_ORIGINS: [
        process.env['NEXT_APP_URL'] || "http://localhost:3200",
        "http://localhost:3200"
    ],
    WHATSAPP_SESSION_NAME: "whatsapp-new-agent-session",
    BROWSER_CONFIG: {
        headless: "old",
        browserPathExecutable: process.env['BROWSER_PATH_EXECUTABLE'],
        browserArgs: ["--no-sandbox", "--disable-setuid-sandbox"],
        disableWelcome: true,
        disableSpins: true,
        autoClose: 0,
    }
};
//# sourceMappingURL=constants.js.map