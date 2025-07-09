# Firebase Functions Test Setup Guide

This guide explains how to set up and run tests for the Firebase Functions project.

## Prerequisites

1. **Firebase CLI**: Make sure you have Firebase CLI installed
   ```bash
   npm install -g firebase-tools
   ```

2. **Firebase Emulator**: The integration tests require the Firebase emulator to be running

## Running Tests

### Unit Tests Only
To run just the unit tests (no emulator required):
```bash
cd firebase/functions
npm test -- --testPathIgnorePatterns="api.test.ts"
```

### All Tests (Including Integration)
To run all tests including integration tests:

1. Start the Firebase emulator:
   ```bash
   cd firebase
   npm run dev:with-data
   ```

2. In another terminal, run the tests:
   ```bash
   cd firebase/functions
   npm test
   ```

## Firebase Emulator Configuration for Authentication

The integration tests use Firebase Authentication. Here's how authentication is configured:

### 1. Authentication in Tests

Tests now use Firebase Auth REST API directly instead of a custom server-side login endpoint. The authentication flow is:

1. **Register users** via the `/register` API endpoint
2. **Sign in** using Firebase Auth REST API with email/password
3. **Get ID token** from the Firebase Auth response
4. **Use ID token** for authenticated API requests

### 2. Firebase API Key

The tests use a default Firebase API key for the emulator:
```javascript
const FIREBASE_API_KEY = 'AIzaSyB3bUiVfOWkuJ8X0LAlFpT5xJitunVP6xg';
```

This is the default API key for Firebase emulators and is safe to use in test environments.

### 3. Emulator URLs

The tests connect to these emulator endpoints:
- **Firestore**: `localhost:8080`
- **Auth**: `localhost:9099`
- **Functions**: `localhost:5001`

### 4. Test User Creation

The `createTestUser` helper function in `api.test.ts`:
1. Registers a new user via the API
2. Signs in using Firebase Auth REST API
3. Returns user info with ID token

Example:
```javascript
const user = await createTestUser({
  email: 'test@example.com',
  password: 'Password123!',
  displayName: 'Test User'
});
```

## Troubleshooting

### "API key not valid" Error
If you see this error in tests:
- Make sure the Firebase emulator is running
- Check that you're using the correct emulator URLs
- Verify the API key matches the emulator's expected key

### "Function does not exist" Error
This means the Firebase Functions haven't deployed to the emulator yet:
- Wait a few seconds for the emulator to fully initialize
- Check the emulator logs for any deployment errors

### Tests Timing Out
Integration tests have a 30-second timeout. If tests are timing out:
- Ensure the emulator is running and accessible
- Check that all emulator services (Auth, Firestore, Functions) are running
- Look for errors in the emulator console

## Writing New Tests

When writing tests that require authentication:

1. **For unit tests**: Mock the authentication middleware
2. **For integration tests**: Use the `createTestUser` helper to create authenticated users

Example integration test:
```javascript
describe('Authenticated endpoint', () => {
  let user;
  
  beforeAll(async () => {
    user = await createTestUser({
      email: 'test@example.com',
      password: 'Password123!',
      displayName: 'Test User'
    });
  });

  it('should access protected resource', async () => {
    const response = await apiRequest('/protected', 'GET', null, user.token);
    expect(response.status).toBe(200);
  });
});
```

## Security Notes

- The server-side `/login` endpoint has been removed for security reasons
- Authentication is now handled entirely through Firebase Auth SDK
- Tests use Firebase Auth REST API, which follows the same security model
- Never use test authentication methods in production code