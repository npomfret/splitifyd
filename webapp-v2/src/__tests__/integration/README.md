# Integration Tests

These tests run against the actual Firebase emulator to ensure our frontend code works correctly with the real API.

## Prerequisites

1. Firebase emulator must be running: `npm run dev`
2. The emulator should have a clean state (or known test data)

## Running Integration Tests

```bash
# Run all integration tests
npm run test:integration

# Run a specific integration test
npm test -- src/__tests__/integration/api-client.integration.test.ts
```

## What These Tests Cover

- **API Client Validation**: Ensures API responses match our Zod schemas
- **Real HTTP Requests**: Tests actual network communication
- **Error Handling**: Verifies proper error handling for various scenarios
- **Data Flow**: Tests the complete flow from frontend to backend

## Why Integration Tests Matter

These tests would have caught issues like:
- API returning empty strings when schema expects min(1)
- Missing or extra fields in API responses
- Type mismatches between frontend and backend
- Network and authentication issues