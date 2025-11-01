# WhatsApp Agent - Refactored Architecture

This document describes the new modular architecture of the WhatsApp Agent application.

## Project Structure

```
src/
├── config/
│   └── constants.ts          # Centralized configuration
├── types/
│   └── whatsapp.ts          # TypeScript type definitions
├── services/
│   ├── database.ts          # Database operations
│   ├── messageProcessor.ts  # Message analysis and processing
│   ├── whatsappClient.ts    # WhatsApp client management
│   └── periodicTaskManager.ts # Scheduled tasks
├── handlers/
│   └── websocketHandler.ts  # WebSocket message handling
├── middleware/
│   └── validationMiddleware.ts # Request validation
├── app.ts                   # Main application class
├── index-new.ts            # New entry point
├── agent.ts                # AI message analysis (unchanged)
└── googleSheets.ts         # Google Sheets integration (unchanged)
```

## Architecture Overview

### 1. Configuration (`config/constants.ts`)
- Centralized all configuration values
- Environment variables and constants
- Browser configuration for WhatsApp client

### 2. Types (`types/whatsapp.ts`)
- TypeScript interfaces for WhatsApp messages
- User information types
- WebSocket message types
- Connection status types

### 3. Services

#### Database Service (`services/database.ts`)
- Singleton pattern for database operations
- WhatsApp session management
- API communication with Next.js backend

#### Message Processor (`services/messageProcessor.ts`)
- Message analysis and processing logic
- User information extraction
- Timestamp validation and creation
- Integration with AI analysis and Google Sheets

#### WhatsApp Client Service (`services/whatsappClient.ts`)
- WhatsApp client initialization and management
- Message handling and routing
- Historical message analysis
- Connection status management

#### Periodic Task Manager (`services/periodicTaskManager.ts`)
- Scheduled message checking
- Background task management
- Interval management

### 4. Handlers

#### WebSocket Handler (`handlers/websocketHandler.ts`)
- WebSocket connection management
- Message routing and handling
- Client communication
- Error handling

### 5. Middleware

#### Validation Middleware (`middleware/validationMiddleware.ts`)
- Request origin validation
- CORS configuration
- Security middleware

### 6. Application (`app.ts`)
- Main application orchestrator
- Service initialization
- Server setup
- Graceful shutdown handling

## Key Improvements

### 1. Separation of Concerns
- Each service has a single responsibility
- Clear boundaries between different functionalities
- Easier to test and maintain

### 2. Singleton Pattern
- Services use singleton pattern for consistent state
- Prevents multiple instances
- Better resource management

### 3. Type Safety
- Comprehensive TypeScript types
- Better IDE support
- Reduced runtime errors

### 4. Modularity
- Easy to add new features
- Simple to modify existing functionality
- Clear dependency structure

### 5. Error Handling
- Centralized error handling
- Better error reporting
- Graceful degradation

## Usage

### Running the Application

```bash
# Use the new entry point
npm run start:new

# Or directly
node dist/index-new.js
```

### Development

```bash
# Build the project
npm run build

# Run in development mode
npm run dev:new
```

## Migration from Old Code

The old `index.ts` file has been split into logical modules:

1. **Configuration**: Moved to `config/constants.ts`
2. **Database Operations**: Moved to `services/database.ts`
3. **Message Processing**: Moved to `services/messageProcessor.ts`
4. **WhatsApp Client**: Moved to `services/whatsappClient.ts`
5. **WebSocket Handling**: Moved to `handlers/websocketHandler.ts`
6. **Middleware**: Moved to `middleware/validationMiddleware.ts`
7. **Periodic Tasks**: Moved to `services/periodicTaskManager.ts`

## Benefits

1. **Maintainability**: Easier to understand and modify
2. **Testability**: Each module can be tested independently
3. **Scalability**: Easy to add new features
4. **Debugging**: Clear separation makes debugging easier
5. **Code Reuse**: Services can be reused across different parts
6. **Documentation**: Self-documenting code structure

## Next Steps

1. Add unit tests for each service
2. Implement logging service
3. Add configuration validation
4. Create API documentation
5. Add monitoring and metrics 