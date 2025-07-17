# Outdated Dependencies

## Problem
- **Location**: `package.json`, `firebase/functions/package.json`, `webapp/package.json`
- **Description**: The project's `package.json` files contain outdated dependencies. Using outdated dependencies can expose the application to security vulnerabilities and prevent it from benefiting from the latest features and performance improvements.
- **Current vs Expected**: Currently, the dependencies are several versions behind the latest releases. They should be updated to the latest stable versions.

## Current Analysis
### Root package.json updates available:
- @types/jest: ^29.5.14 → ^30.0.0
- @types/node: ^20.19.2 → ^24.0.14
- concurrently: ^8.2.2 → ^9.2.0
- esbuild: ^0.20.2 → ^0.25.6
- firebase-tools: ^13.0.0 → ^14.11.0
- jest: ^29.7.0 → ^30.0.4
- ts-jest: ^29.2.5 → ^29.4.0
- typescript: ^5.6.3 → ^5.8.3

### Firebase Functions package.json updates available:
- @types/cors: ^2.8.17 → ^2.8.19
- @types/express: ^4.17.23 → ^5.0.3
- express: ^4.21.2 → ^5.1.0
- firebase-admin: ^12.7.0 → ^13.4.0
- firebase-functions: ^6.3.2 → ^6.4.0
- supertest: ^6.3.4 → ^7.1.3

### Webapp package.json updates available:
- gsap: ^3.12.5 → ^3.13.0
- three: ^0.162.0 → ^0.178.0

## Solution
- **Approach**: Use `npm-check-updates` to identify and update the outdated dependencies in all `package.json` files. After updating, run all tests to ensure that the new versions have not introduced any breaking changes.

## Implementation Plan
This task can be broken down into smaller, independent commits:

### Phase 1: Root Dependencies (Low Risk)
1. Update TypeScript tooling dependencies (@types/jest, @types/node, typescript, ts-jest)
2. Update build tools (esbuild, concurrently)
3. Update Firebase tools (firebase-tools)
4. Update Jest testing framework

### Phase 2: Firebase Functions Dependencies (Medium Risk)
1. Update type definitions (@types/cors, @types/express)
2. Update Firebase SDK packages (firebase-admin, firebase-functions)
3. Update Express.js (major version change - needs careful testing)
4. Update testing libraries (supertest)

### Phase 3: Webapp Dependencies (Low Risk)
1. Update animation libraries (gsap, three)

## Impact
- **Type**: Behavior change (dependency updates can introduce breaking changes)
- **Risk**: Medium (Express 5.x is a major version change)
- **Complexity**: Moderate
- **Benefit**: High value (improves security and keeps the project up-to-date)

## Implementation Notes
- Express 4.x → 5.x is a major version change that requires careful testing
- Some type definitions may need updates due to breaking changes
- After each phase, run the full test suite to catch any regressions
- Pay special attention to Firebase SDK updates as they can affect authentication and database operations