# Code Guidelines

This document defines the key architectural patterns, rules, and standards for the project.

---

## TypeScript

- It MUST compile!
- **DO NOT use `ts-node`** - it always causes ERR_UNKNOWN_FILE_EXTENSION problems.
- **Always use `tsx` instead** for TypeScript execution.
- Use `npx tsx script.ts` in npm scripts and bash commands.
- Only use the latest syntax (`import`, `async / await` etc).
- Use `npm run format` often!
- Import modules without `.js` suffixes; rely on TypeScript path resolution and TSX runtime.
- never "dynamic import" inside a method - imports must go at the top of the ts file
- Do not ship or check in compiled JavaScript artifacts; keep the pipeline TypeScript-only.
- Avoid raw primitives (`string`, `number`, `boolean`, `Date` etc.); define and consume branded types to encode domain semantics explicitly
- Write objects with that and behaviour - encapsulation is key
- All _external_ APIs (database, search engine, solana) etc, must be hidden behind an abstraction layer in order that we cant unit test with needing real implementations
- Embrace type safety at every opportunity
- "helpers" are tool of the lazy and stupid - avoid them, prefer OOP (just add a method to an object if it doesn't already exist)
- never add comments unless something is particularly weird or difficult to understand
- use configuration files not env vars
- never log a string - always log a JSON object with standardised field names
- Never return anonymous object types (e.g. `Promise<{ ... }>`); define a named type that expresses the aggregate instead.
- Every `.ts` file, including tests and any scripts, MUST be included in the build - everything must compile
- No anonymous types on method signatures

---

## Monorepo Architecture

The project is a monorepo containing two main packages:

- `firebase`: The backend, containing Firebase Functions written in TypeScript.
- `webapp-v2`: The frontend, a modern Preact single-page application.

### Shared Code via `@splitifyd/shared`

The monorepo uses npm workspace packages for sharing code between frontend and backend.

- **Purpose**: Share type definitions and utilities across the entire stack with absolute type safety.
- **Location**: Shared packages are located in `packages/` directory:
    - `@splitifyd/shared` - Types and utilities shared between frontend and backend
    - `@splitifyd/test-support` - Test utilities and configurations
- **Primary Use**: All types intended for use by both client and server are in the `@splitifyd/shared` package.
- **Rule**: When creating a type that will be sent to or received from the API, it **must** be defined in the shared package and imported using `@splitifyd/shared`.

```typescript
// Example from webapp-v2/src/api/apiClient.ts
import type { CreateGroupRequest, Group } from '@splitifyd/shared';
```

---

## Security

### Server-Side (`firebase`)

Security is enforced primarily on the backend, which operates on a zero-trust principle with the client.

- **Firebase Security Rules**: Define granular access control for all Firestore database operations, acting as the primary data-layer defense.
- **Authentication Middleware**: Every API request is protected by middleware that verifies the user's Firebase Auth ID token. This ensures that only authenticated users with valid sessions can access protected routes.

### Client-Side (`webapp-v2`)

The client's role in security is minimal and it does not contain any access-control logic.

- **Token-Based Authentication**: The frontend's sole security responsibility is to send the user's ID token with every API request.
- **No Client-Side Checks**: The client performs no permission checks and relies entirely on the backend to enforce access control. If the backend denies a request, the client simply handles the resulting error.

## Backend (`firebase`)

The backend is built on Firebase Functions using Express.js.

### API Structure

- **Entry Point**: All functions are defined and exported from `firebase/functions/src/index.ts`.
- **Routing**: An Express app is used to define all API routes. Route handlers are organized by feature into files within `src/`, such as `groups/handlers.ts` or `expenses/handlers.ts`.
- **Middleware**:
    - A standard middleware stack is applied to all requests in `utils/middleware.ts`.
    - Authentication is handled by a custom middleware (`auth/middleware.ts`) which verifies the Firebase Auth token on nearly every request.

### Data Validation

- **Zod**: All incoming request bodies are strictly validated using **Zod** schemas.
- **Location**: Validation schemas are co-located with their feature handlers (e.g., `groups/validation.ts`).
- **Rule**: Any new API endpoint that accepts a request body **must** have a corresponding Zod schema to validate the input.

### Error Handling

- **Let It Break**: The primary error handling strategy is to let exceptions bubble up.
- **Centralized Handler**: A final error-handling middleware in `index.ts` catches all uncaught exceptions.
- **ApiError Class**: It uses a custom `ApiError` class (`utils/errors.ts`) to produce standardized JSON error responses with a status code and error code.
- **Rule**: Avoid `try/catch` blocks within individual route handlers unless you are handling a specific, expected error case that requires a unique response. For general validation or unexpected errors, let the centralized handler manage it.

---

## Frontend (`webapp-v2`)

The frontend is a Preact application built with Vite.

### State Management

The application uses **Preact Signals** (`@preact/signals`) as its core reactivity and state management system. This provides:

- Fine-grained reactivity without unnecessary re-renders
- Automatic dependency tracking
- Synchronous updates
- TypeScript support
- **Proper encapsulation** through private class fields

#### 1. Store Pattern

Global state is organized into feature-based "stores" that encapsulate related signals, computed values, and actions. **All signals must be private class fields to enforce proper encapsulation.**

```typescript
// Example Store Structure
interface SomeStore {
    // State properties (read-only to consumers)
    readonly data: ReadonlySignal<SomeData[]>;
    readonly loading: ReadonlySignal<boolean>;
    readonly error: ReadonlySignal<string | null>;

    // Actions (the only way to mutate state)
    fetchData(): Promise<void>;
    updateData(item: SomeData): Promise<void>;
    clearError(): void;
}
```

#### 2. Signal Declaration - PROPER ENCAPSULATION

Signals must be declared as **private class fields** using the `#` syntax to ensure true encapsulation:

```typescript
// ✅ CORRECT: Private class field signals with proper encapsulation
import { signal, ReadonlySignal } from '@preact/signals';

class SomeStoreImpl implements SomeStore {
    // Private signals - cannot be accessed or mutated from outside
    #dataSignal = signal<SomeData[]>([]);
    #loadingSignal = signal<boolean>(false);
    #errorSignal = signal<string | null>(null);

    // Expose read-only access to components
    get data(): ReadonlySignal<SomeData[]> {
        return this.#dataSignal;
    }

    get loading(): ReadonlySignal<boolean> {
        return this.#loadingSignal;
    }

    get error(): ReadonlySignal<string | null> {
        return this.#errorSignal;
    }

    // Actions are the ONLY way to mutate state
    async fetchData(): Promise<void> {
        this.#loadingSignal.value = true;
        this.#errorSignal.value = null;

        try {
            const data = await api.getData();
            this.#dataSignal.value = data;
        } catch (error) {
            this.#errorSignal.value = this.getErrorMessage(error);
            throw error;
        } finally {
            this.#loadingSignal.value = false;
        }
    }

    updateData(item: SomeData): void {
        this.#dataSignal.value = [...this.#dataSignal.value, item];
    }

    clearError(): void {
        this.#errorSignal.value = null;
    }
}
```

#### ❌ ANTI-PATTERN TO AVOID

Never declare signals at the module level outside the class:

```typescript
// ❌ WRONG: Module-level signals break encapsulation
const dataSignal = signal<SomeData[]>([]); // DON'T DO THIS!
const loadingSignal = signal<boolean>(false); // DON'T DO THIS!

class SomeStoreImpl {
    get data() {
        return dataSignal.value; // This exposes mutable global state!
    }
}
```

**Why this is dangerous:** Module-level signals become global variables that any code can directly mutate via `someSignal.value = ...`, completely bypassing the store's control and making state changes unpredictable and untraceable.

#### 3. Store Singleton Pattern

Stores are exported as singleton instances:

```typescript
// Store implementation
class GroupsStoreImpl implements GroupsStore {
    // implementation...
}

// Export singleton instance
export const groupsStore = new GroupsStoreImpl();
```

### API Communication & Runtime Validation

- **ApiClient**: All communication with the backend happens through a singleton `ApiClient` class defined in `app/apiClient.ts`.
- **Zod Validation**: A standout feature is the use of **Zod** for **runtime validation of all API responses**.
    - Every expected API response has a corresponding Zod schema defined in `api/apiSchemas.ts`.
    - The `ApiClient` automatically validates incoming data against these schemas before returning it to the application.
- **Rule**: Any new API endpoint consumed by the frontend **must** have a corresponding Zod schema added to `apiSchemas.ts` to ensure runtime type safety.

### Component & Styling Patterns

- **Functional Components**: The UI is built exclusively with functional components and hooks.
- **Styling**: **Tailwind CSS** is used for all styling. Utility classes are applied directly in the JSX.
- **UI Components**: A library of reusable UI components (e.g., `Button`, `Card`, `Input`) is located in `src/components/ui`.
