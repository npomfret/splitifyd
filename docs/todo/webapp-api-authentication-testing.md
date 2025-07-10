# Webapp Issue: API & Authentication Testing

## Issue Description

API and authentication testing needs to be expanded to include integration tests for the API service layer, authentication flow testing with proper mocking, and error handling and type safety in API calls.

## Recommendation

Create integration tests for the API service layer, add authentication flow testing with proper mocking, and test error handling and type safety in API calls.

## Implementation Suggestions

1.  **Integration Tests for API Service Layer (`api.test.ts`):**
    *   Create a new test file `webapp/src/js/api.test.ts`.
    *   Test `apiService` methods (e.g., `getGroups`, `createGroup`, `getExpense`, `updateExpense`, `deleteGroup`, `joinGroupByLink`).
    *   Use mocking libraries (e.g., `jest-fetch-mock` or `msw`) to mock `fetch` requests and simulate API responses without making actual network calls.
    *   Verify that the service methods correctly transform data and handle different HTTP status codes.

2.  **Authentication Flow Testing (`auth.test.ts`):**
    *   Create a new test file `webapp/src/js/auth.test.ts`.
    *   Test `AuthManager` methods (e.g., `handleLogin`, `handleRegister`, `handlePasswordReset`, `logout`).
    *   Mock `window.firebaseAuth` methods (e.g., `signInWithEmailAndPassword`, `createUserWithEmailAndPassword`, `sendPasswordResetEmail`, `onAuthStateChanged`, `signOut`).
    *   Verify successful login/registration, correct token handling, and proper redirection.
    *   Test error scenarios (e.g., invalid credentials, email already in use, network errors).

3.  **Error Handling and Type Safety in API Calls:**
    *   Within the API service and authentication tests, explicitly test error paths.
    *   Verify that `apiCall` correctly throws errors for non-`2xx` responses and that these errors are caught and handled appropriately by the calling service methods.
    *   Ensure that the TypeScript types are correctly enforced throughout the API request and response cycle, catching any type mismatches at compile time.

**General Testing Best Practices:**
*   **Mock External Dependencies:** For unit/integration tests, mock all external dependencies (network requests, Firebase SDK, `localStorage`) to ensure tests are fast, reliable, and isolated.
*   **Clear Test Data:** Ensure that each test starts with a clean slate and that no test data persists between runs.
*   **Edge Cases:** Test edge cases and error conditions to ensure robustness.
