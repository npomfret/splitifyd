# Contextual Logger Usage Guide

## Overview

The new contextual logging system automatically includes request context (userId, correlationId, etc.) in all log messages without explicitly passing it.

## Basic Usage

### 1. Import the contextual logger

```typescript
import { contextualLogger as logger } from '../utils/contextual-logger';
import { LoggerContext } from '../utils/logger-context';
```

### 2. Logging with automatic context

```typescript
// Old way - manually passing context
logger.info('expense-created', { id: expenseId, userId, groupId, correlationId });

// New way - context automatically included
logger.info('expense-created', { id: expenseId });
// userId and correlationId are automatically included from AsyncLocalStorage
```

### 3. Adding business context

```typescript
// Add business entity context that will be included in all subsequent logs
LoggerContext.setBusinessContext({ 
    groupId: group.id,
    expenseId: expense.id 
});

// All subsequent logs will include groupId and expenseId
logger.info('processing-splits', { splitCount: 3 });
// Output includes: userId, correlationId, groupId, expenseId, splitCount
```

### 4. Creating child loggers for services

```typescript
// In a service that wants to add its own context
export class BalanceCalculator {
    private logger = contextualLogger.child({ 
        service: 'BalanceCalculator',
        operation: 'calculate-balances' 
    });
    
    async calculate(groupId: string) {
        this.logger.info('starting-calculation', { groupId });
        // Output includes: userId, correlationId, service, operation, groupId
        
        // ... calculation logic ...
        
        this.logger.info('calculation-complete', { 
            transactionCount: 42 
        });
    }
}
```

## Context Flow

1. **Request Entry** (middleware.ts)
   - Correlation ID generated
   - Request path and method captured
   - Initial context established

2. **Authentication** (auth/middleware.ts)
   - User ID, email, and role added to context
   - Context automatically propagates to all subsequent operations

3. **Business Logic** (handlers)
   - Business entity IDs (groupId, expenseId, etc.) added as needed
   - Context flows through async operations automatically

4. **Service Calls**
   - Services inherit parent context
   - Can add their own context via child loggers
   - Context maintained across async boundaries

## Migration Strategy

### Phase 1: Parallel Implementation (Current)
- New contextual logger exists alongside old logger
- Gradually migrate handlers to use contextual logger
- Both loggers can coexist

### Phase 2: Progressive Migration
```typescript
// Start with high-value handlers
import { contextualLogger as logger } from '../utils/contextual-logger';

// Remove manual context passing
logger.info('action', { id }); // userId, correlationId auto-included
```

### Phase 3: Complete Migration
- Replace all logger imports with contextual logger
- Remove manual userId/correlationId passing
- Delete old logger.ts file

## Benefits

1. **Cleaner Code** - No more passing userId, correlationId everywhere
2. **Consistent Context** - All logs have complete context
3. **Better Debugging** - Trace requests across all layers
4. **Service Isolation** - Services can add their own context
5. **Zero Config** - Works automatically once middleware is set up

## Error Logging

```typescript
try {
    // ... operation ...
} catch (error) {
    // Context automatically included in error logs too
    logger.error('Operation failed', error, {
        additionalInfo: 'specific details'
    });
    // Output includes: userId, correlationId, groupId, error details, additionalInfo
}
```

## Testing

The contextual logger works seamlessly in tests:

```typescript
describe('MyHandler', () => {
    it('should log with context', async () => {
        // Run test within a context
        await LoggerContext.run({
            correlationId: 'test-123',
            userId: 'test-user'
        }, async () => {
            // All logs within this scope will have the test context
            await myHandler(req, res);
        });
    });
});
```