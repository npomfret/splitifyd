# Task: Decouple Firebase from UI for Robust Component Testing

## 1. The Problem: Untestable UI Components

A significant portion of the web application's UI components are currently untestable in isolation using Playwright component tests. This is due to the tight coupling between the components and the Firebase SDK, particularly Firebase Authentication.

### 1.1. Key Issues

1.  **Forced Authentication Flow**: Nearly every component or view assumes an authenticated user is present. If the Firebase Auth state is not authenticated, the application's routing logic immediately redirects to the `/login` page. This makes it impossible to mount and test a component like `Dashboard` or `ExpenseForm` on its own.

2.  **Failed Mocking Attempts**: Previous attempts to mock the Firebase SDK at a low level have proven to be overly complex, brittle, and have ultimately failed. The Firebase API surface is large and stateful, making it a poor candidate for direct mocking.

3.  **Low-Value Tests**: As a result, existing tests fall into two categories, both of which provide little to no real value (as documented in `playwright-unit-test-analysis.md`):
    *   **"Fake DOM" Tests**: Tests that inject their own artificial DOM and scripts, testing a mock-up of the application that exists only in the test file, not the real components.
    *   **Redirect Tests**: Tests that attempt to render an authenticated-only component, fail, and then simply assert that the application correctly redirected to the login page. This leaves the component's actual functionality completely untested.

The core issue is the lack of a "seam" or boundary between the UI components and the external Firebase dependency, preventing us from controlling the application's state during tests.

## 2. The Solution: Service Abstraction & Dependency Injection

The solution is to introduce a well-defined abstraction layer for all Firebase services. This architectural pattern will decouple the UI from Firebase, allowing us to "inject" a mock version of the service during testing.

### 2.1. The Strategy

1.  **Service Abstraction**: We will create a new module, `firebaseService.ts`, that encapsulates **all** interactions with the Firebase SDK. This includes authentication (`signIn`, `signOut`, `onAuthStateChanged`), Firestore (`getDocument`, `updateDocument`), and any other Firebase features used by the application. UI components will **only** be allowed to interact with this service, never with the Firebase SDK directly.

2.  **Mock Implementation**: We will create a corresponding mock service, `mockFirebaseService.ts`, which has the exact same interface (functions and signatures) as the real service. However, its methods will not make any network calls. Instead, they will return hardcoded, predictable data. For example, `mockFirebaseService.getCurrentUser()` could return a static mock user object, simulating a logged-in state instantly.

3.  **Test-Time Swapping**: We will configure our testing environment (Vite/Vitest/Playwright) to automatically replace any import of the real `firebaseService.ts` with our `mockFirebaseService.ts` whenever tests are run. This is the "dependency injection" step. It ensures that when a component calls `firebaseService.getCurrentUser()`, it receives the mock data, not a real auth state.

## 3. Implementation Plan

### Phase 1: Create the Service Abstraction

1.  **Define the Service Interface (`IFirebaseService.ts`):**
    - Create an interface that defines the contract for all Firebase interactions (e.g., `getCurrentUser`, `signInWithEmail`, `getGroup`, `updateExpense`).

2.  **Create the Real `FirebaseService.ts`:**
    - Implement the `IFirebaseService` interface.
    - This class will contain all the actual Firebase SDK calls.
    - This becomes the single entry point for all Firebase operations in the application.

### Phase 2: Create the Mock Service

1.  **Create `MockFirebaseService.ts`:**
    - Implement the `IFirebaseService` interface again, but for testing purposes.
    - Methods will return static data (e.g., `getCurrentUser` returns a pre-defined user object).
    - It can be designed to be configurable, allowing tests to simulate various states (e.g., logged in, logged out, admin user, API error).

### Phase 3: Configure Test Environment

1.  **Update Vite Configuration:**
    - Use the `resolve.alias` feature in `vitest.config.ts` and `playwright.config.ts`.
    - Create an alias that maps the path to the real `firebaseService.ts` to the path of the `mockFirebaseService.ts`.

    ```typescript
    // Example for vitest.config.ts
    export default defineConfig({
      test: {
        // ...
      },
      resolve: {
        alias: {
          // When code imports from '~/services/firebaseService',
          // the test runner will substitute it with the mock version.
          '~/services/firebaseService': path.resolve(__dirname, './src/__tests__/mocks/mockFirebaseService.ts'),
        },
      },
    });
    ```

### Phase 4: Refactor Application Code

1.  **Update Component Imports:**
    - Systematically go through the `webapp-v2` codebase.
    - Replace all direct imports from `firebase/auth`, `firebase/firestore`, etc., with imports from the new `firebaseService.ts`.
    - Refactor the components to call the service methods (e.g., `firebaseService.getCurrentUser()`) instead of the SDK directly.

## 4. Benefits of This Approach

-   **Testability**: Components can be mounted and tested in any state (`loggedIn`, `loggedOut`, `loading`, `error`) simply by configuring the mock service.
-   **Reliability & Speed**: Tests will be fast and reliable as they will not depend on any network requests or external services.
-   **Architectural Improvement**: Enforces a clean separation of concerns, making the application easier to understand, maintain, and refactor.
-   **Control**: Gives us full and predictable control over our application's state during testing.
-   **Eliminates Flaky Tests**: Removes the primary source of complexity and flakiness from our component test suite.
