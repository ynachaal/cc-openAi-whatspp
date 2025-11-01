"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = require("./app");
console.log('🚀 Starting WhatsApp New Agent WebSocket Server...');
const app = app_1.WhatsAppNewAgentApp.getInstance();
app.start().catch((error) => {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
});
// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down...');
    app.stop();
    process.exit(0);
});
process.on('SIGTERM', async () => {
    console.log('\n🛑 Shutting down...');
    app.stop();
    process.exit(0);
});
//# sourceMappingURL=server.js.map