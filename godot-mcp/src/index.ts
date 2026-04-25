import { GodotMCPServer } from './server.js';
import { config } from './config.js';

if (config.enableDebug) {
  console.error('Godot MCP Server starting in debug mode...');
  console.error(`Godot Path: ${config.godotPath}`);
  console.error(`Log Path: ${config.godotLogPath}`);
  console.error(`Log Level: ${config.logLevel}`);
}

const server = new GodotMCPServer();

process.on('SIGINT', () => {
  console.error('Received SIGINT, shutting down...');
  server.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.error('Received SIGTERM, shutting down...');
  server.stop();
  process.exit(0);
});

server.start().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
