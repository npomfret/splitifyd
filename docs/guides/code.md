# Code Guidelines

This document defines the key architectural patterns, rules, and standards for the project.

---

## General TypeScript

- Only use the latest syntax (`import`, `async / await` etc).
- **DO NOT use `ts-node`** - it always causes ERR_UNKNOWN_FILE_EXTENSION problems.
- **Always use `tsx` instead** for TypeScript execution.
- Use `npx tsx script.ts` in npm scripts and bash commands.
- Use `npm run format` often!

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

## Backend (`firebase`)

The backend is built on Firebase Functions using Express.js.

### API Structure

- **Entry Point**: All functions are defined and exported from `firebase/functions/src/index.ts`.
- **Routing**: An Express app is used to define all API routes. Route handlers are organized by feature into files within `src/`, such as `groups/handlers.ts` or `expenses/handlers.ts`.
- **Middleware**:
    - A standard middleware stack is applied to all requests in `utils/middleware.ts`.
    - Authentication is handled by a custom middleware (`auth/middleware.ts`) which verifies the Firebase Auth token on nearly every request.

### Data Validation

- **Joi**: All incoming request bodies are strictly validated using **Joi** schemas.
- **Location**: Validation schemas are co-located with their feature handlers (e.g., `groups/validation.ts`).
- **Rule**: Any new API endpoint that accepts a request body **must** have a corresponding Joi schema to validate the input.

### Error Handling

- **Let It Break**: The primary error handling strategy is to let exceptions bubble up.
- **Centralized Handler**: A final error-handling middleware in `index.ts` catches all uncaught exceptions.
- **ApiError Class**: It uses a custom `ApiError` class (`utils/errors.ts`) to produce standardized JSON error responses with a status code and error code.
- **Rule**: Avoid `try/catch` blocks within individual route handlers unless you are handling a specific, expected error case that requires a unique response. For general validation or unexpected errors, let the centralized handler manage it.

---

## Frontend (`webapp-v2`)

The frontend is a Preact application built with Vite.

### State Management

- **Preact Signals**: The app uses `@preact/signals` as its core reactivity and state management library.
- **Global Stores**: Global state is organized into feature-based "stores" (e.g., `auth-store.ts`, `groups-store.ts`). These stores are singleton classes that encapsulate signals, computed values, and actions related to a specific domain.

```typescript
// Example from app/stores/groups-store.ts
const groupsSignal = signal<Group[]>([]);
const loadingSignal = signal<boolean>(false);

class GroupsStoreImpl implements GroupsStore {
    get groups() {
        return groupsSignal.value;
    }
    // ...
    async fetchGroups() {
        /* ... */
    }
}
```

**note** we do not yet use firebase websockets for data updates, so often the UI needs to be refreshed to pick up new changes.

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
