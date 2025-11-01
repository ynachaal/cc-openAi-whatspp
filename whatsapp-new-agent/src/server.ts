    import { WhatsAppNewAgentApp } from './app';

console.log('🚀 Starting WhatsApp New Agent WebSocket Server...');

const app = WhatsAppNewAgentApp.getInstance();
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
