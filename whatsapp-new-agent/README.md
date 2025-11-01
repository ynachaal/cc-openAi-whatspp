# WhatsApp New Agent

A TypeScript-based WhatsApp Web.js agent with enhanced type safety and modern development features.

## Features

- ✅ Full TypeScript support with strict type checking
- ✅ Modern ES2020+ features
- ✅ Source maps for debugging
- ✅ Hot reload development mode
- ✅ Comprehensive type definitions
- ✅ Error handling and logging
- ✅ Graceful shutdown handling

## Prerequisites

- Node.js 18+ 
- pnpm (recommended) or npm

## Installation

```bash
# Install dependencies
pnpm install

# Install TypeScript dependencies
pnpm install -D typescript @types/node ts-node
```

## Development

### Available Scripts

```bash
# Build the project
pnpm build

# Watch mode for development
pnpm dev

# Run in development mode with ts-node
pnpm dev:start

# Run the built application
pnpm start

# Clean build artifacts
pnpm clean
```

### Development Workflow

1. **Start development mode:**
   ```bash
   pnpm dev:start
   ```

2. **In another terminal, watch for changes:**
   ```bash
   pnpm dev
   ```

3. **Build for production:**
   ```bash
   pnpm build
   pnpm start
   ```

## Project Structure

```
whatsapp-new-agent/
├── src/
│   ├── index.ts          # Main entry point
│   └── types/
│       └── index.ts      # TypeScript type definitions
├── dist/                 # Compiled JavaScript (generated)
├── package.json
├── tsconfig.json
└── README.md
```

## Usage

### Basic Usage

```typescript
import WhatsAppAgent from './src/index';

const agent = new WhatsAppAgent({
  sessionName: 'my-session',
  headless: true,
  debug: true
});

// Initialize the agent
await agent.initialize();

// Send a message
await agent.sendMessage('1234567890', 'Hello from TypeScript!');

// Get all chats
const chats = await agent.getChats();

// Clean shutdown
await agent.destroy();
```

### Configuration Options

```typescript
interface WhatsAppAgentConfig {
  sessionName?: string;    // Session name for authentication
  headless?: boolean;      // Run browser in headless mode
  debug?: boolean;         // Enable debug logging
  puppeteerArgs?: string[]; // Custom Puppeteer arguments
}
```

## TypeScript Features

### Strict Type Checking

The project uses strict TypeScript configuration with:

- `noImplicitAny`: Prevents implicit `any` types
- `noImplicitReturns`: Ensures all code paths return a value
- `noUnusedLocals`: Warns about unused local variables
- `noUnusedParameters`: Warns about unused parameters
- `exactOptionalPropertyTypes`: Strict optional property handling

### Type Definitions

Comprehensive type definitions are available in `src/types/index.ts`:

- `WhatsAppAgentConfig`: Configuration interface
- `MessageHandler`: Message event handler type
- `ChatInfo`: Chat information structure
- `ContactInfo`: Contact information structure
- `MessageInfo`: Message information structure
- `AgentStatus`: Agent status information

## Error Handling

The agent includes comprehensive error handling:

```typescript
try {
  await agent.initialize();
} catch (error) {
  console.error('Initialization failed:', error);
  // Handle error appropriately
}
```

## Logging

Built-in logging with different levels:

```typescript
// Log levels: debug, info, warn, error
console.log('Info message');
console.warn('Warning message');
console.error('Error message');
```

## Development Tips

### Hot Reload

Use `pnpm dev:start` for development with automatic restart on file changes.

### Debugging

Source maps are enabled for better debugging experience. You can:

1. Set breakpoints in TypeScript files
2. Use `debugger` statements
3. Inspect variables with full type information

### Type Safety

Take advantage of TypeScript's type system:

```typescript
// This will show type errors at compile time
const config: WhatsAppAgentConfig = {
  sessionName: 'test',
  invalidOption: true // ❌ Type error
};
```

## Building for Production

```bash
# Clean previous builds
pnpm clean

# Build the project
pnpm build

# Run the production build
pnpm start
```

## Troubleshooting

### Common Issues

1. **TypeScript compilation errors:**
   - Check that all imports are correct
   - Ensure all required properties are provided
   - Verify type definitions match usage

2. **Runtime errors:**
   - Check that `dist/` directory exists after building
   - Verify all dependencies are installed
   - Check browser compatibility for Puppeteer

3. **WhatsApp Web.js issues:**
   - Ensure stable internet connection
   - Check if WhatsApp Web is accessible
   - Verify QR code scanning process

## Contributing

1. Follow TypeScript best practices
2. Add proper type annotations
3. Include error handling
4. Write descriptive commit messages
5. Test changes thoroughly

## License

ISC
