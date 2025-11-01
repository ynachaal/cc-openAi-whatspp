import { WhatsAppAgentApp } from "./app";

// Create and start the application using singleton pattern
const app = WhatsAppAgentApp.getInstance();
app.start();

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down gracefully...');
  app.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  app.stop();
  process.exit(0);
}); 