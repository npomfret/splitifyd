# Code Guidelines

This document defines the key architectural patterns, rules, and standards for the project.

---

## TypeScript

- It MUST compile! 
- All of it must compile.  Never exclude TypeScript code from a compile.
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
- In general, constructors should do nothing except set fields, use factory methods otherwise

---

## Monorepo Architecture

The project is a monorepo containing two main packages:

- `firebase`: The backend, containing Firebase Functions written in TypeScript.
- `webapp-v2`: The frontend, a modern Preact single-page application.

### Shared Code via `@billsplit-wl/shared`

The monorepo uses npm workspace packages for sharing code between frontend and backend.

- **Purpose**: Share type definitions and utilities across the entire stack with absolute type safety.
- **Location**: Shared packages are located in `packages/` directory:
    - `@billsplit-wl/shared` - Types and utilities shared between frontend and backend
    - `@billsplit-wl/test-support` - Test utilities and configurations
- **Primary Use**: All types intended for use by both client and server are in the `@billsplit-wl/shared` package.
- **Rule**: When creating a type that will be sent to or received from the API, it **must** be defined in the shared package and imported using `@billsplit-wl/shared`.

```typescript
// Example from webapp-v2/src/api/apiClient.ts
import type { CreateGroupRequest, Group } from '@billsplit-wl/shared';
```

---

## Security

See `docs/guides/security.md` for all security patterns (zero-trust client, auth middleware, permission checks, CSP).

