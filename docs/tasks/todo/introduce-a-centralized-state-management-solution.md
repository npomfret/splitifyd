# Task: Introduce a Centralized State Management Solution

**Objective:** To implement a simple, centralized state management solution to act as a single source of truth for the application's state. This will decouple components and make state easier to manage, track, and debug.

**Status:** Not Started

**Dependencies:**
*   `create-a-basecomponent-class.md`: Components will need to subscribe to the store, so having a consistent component model is beneficial.

---

## Detailed Steps

### Step 1: Create the State Management Module

1.  **Create a new file:** `webapp/src/js/store.ts`.
2.  **Implement the state management logic:** This will be a simple implementation of the observer pattern.

    ```typescript
    // webapp/src/js/store.ts

    type State = {
      user: import('./types/global').FirebaseUser | null;
      // Add other global state properties here as needed
    };

    type Subscriber = (state: State) => void;

    let state: State = {
      user: null,
    };

    const subscribers: Subscriber[] = [];

    export const getState = (): State => state;

    export const setState = (newState: Partial<State>): void => {
      state = { ...state, ...newState };
      subscribers.forEach(subscriber => subscriber(state));
    };

    export const subscribe = (subscriber: Subscriber): (() => void) => {
      subscribers.push(subscriber);
      // Return an unsubscribe function
      return () => {
        const index = subscribers.indexOf(subscriber);
        if (index > -1) {
          subscribers.splice(index, 1);
        }
      };
    };
    ```

### Step 2: Refactor Authentication State

**Target Files:**
*   `webapp/src/js/app-init.ts`
*   `webapp/src/js/auth.ts`
*   Any other files that currently rely on `authManager` for user state.

**Actions:**

1.  **Update `app-init.ts`:**
    *   In the `setupAuthListener` function, instead of a custom handler, the `onAuthStateChanged` callback will now directly update the central store.

        ```typescript
        // webapp/src/js/app-init.ts
        import { setState } from './store';

        // ... inside setupAuthListener
        firebaseAuthInstance!.onAuthStateChanged((user: FirebaseUser | null) => {
          setState({ user });
        });
        ```

2.  **Update `auth.ts`:**
    *   Remove any local state management for the user object.
    *   Functions like `isAuthenticated` will now get their data from the central store.

        ```typescript
        // webapp/src/js/auth.ts
        import { getState } from './store';

        // ... inside the AuthManager class
        isAuthenticated(): boolean {
          return !!getState().user;
        }
        ```

3.  **Refactor Components:**
    *   Any component that needs to know the user's authentication status will now subscribe to the store instead of querying `authManager`.
    *   For example, the header component that shows the user's name or a "Login" button would be a prime candidate for this refactoring.

---

## Acceptance Criteria

*   The `webapp/src/js/store.ts` file is created and implemented.
*   The application's authentication state is managed exclusively by the new store.
*   The `onAuthStateChanged` listener in `app-init.ts` updates the store.
*   Components that depend on authentication state now subscribe to the store.
*   There is no functional regression in the authentication system.