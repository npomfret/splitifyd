# Webapp Issue: Centralize State Management

## Issue Description

Application state is scattered across `localStorage`, DOM attributes, and global variables, leading to synchronization bugs.

## Recommendation

Create a single source of truth for shared application state.

## Current State Analysis (2025-07-13)

Based on analysis of the codebase, current state management includes:
- **localStorage**: `splitifyd_auth_token`, `userId`
- **sessionStorage**: `pendingJoinLinkId`
- **Module-level variables**: `currentGroup`, `currentGroupId`, pagination state
- **DOM attributes**: `data-tab`, `data-expense-id`, `data-group-id`, etc.
- **URL parameters**: Group IDs, join links, return URLs
- **No centralized state management system**

## Implementation Plan

### Phase 1: Create Basic Store (MINIMAL SCOPE) ✅ COMPLETED
1. ✅ Created `webapp/src/js/store.ts` with:
   - Type-safe state interface for User and AppState
   - Proxy-based reactive state with automatic localStorage sync
   - Subscribe/unsubscribe pattern for state change notifications
   - Focus on auth state (user and authToken)
2. ✅ Created comprehensive test suite `webapp/src/js/store.test.ts`
   - 13 tests covering all functionality
   - Tests for initialization, updates, subscriptions, and reset
   - Tests for localStorage persistence
3. ✅ Build passes with no TypeScript errors

### Phase 2: Future Work (NOT IN THIS TASK)
- Migrate other state gradually (currentGroup, pagination, etc.)
- Refactor existing components to use the store
- Add persistence layer for other state
- Add devtools support

## Implementation Suggestions

Implement a simple `store.js` (or `store.ts`) using a `Proxy` object to automatically notify components of state changes. Refactor components to read from this central store.

### Example Implementation Idea:

```typescript
// webapp/src/js/store.ts

interface AppState {
  user: any | null;
  currentGroup: any | null;
  // Add other global state properties here
}

const initialState: AppState = {
  user: null,
  currentGroup: null,
};

const handlers: Set<Function> = new Set();

const store = new Proxy(initialState, {
  set(target: AppState, property: keyof AppState, value: any) {
    const oldVal = target[property];
    (target as any)[property] = value; // Update the target
    if (oldVal !== value) {
      handlers.forEach(handler => handler(property, value, oldVal));
    }
    return true;
  },
  get(target: AppState, property: keyof AppState) {
    return target[property];
  },
});

export const subscribe = (handler: Function) => {
  handlers.add(handler);
  return () => handlers.delete(handler); // Unsubscribe function
};

export const getStore = () => store;

export const updateStore = (updates: Partial<AppState>) => {
  for (const key in updates) {
    if (updates.hasOwnProperty(key)) {
      (store as any)[key] = (updates as any)[key];
    }
  }
};

// Example usage:
// import { getStore, subscribe, updateStore } from './store';

// // In a component:
// const unsubscribe = subscribe((prop, value) => {
//   if (prop === 'user') {
//     console.log('User updated:', value);
//   }
// });

// // To update state:
// updateStore({ user: { id: '123', name: 'Test User' } });

// // When component unmounts:
// unsubscribe();
```

**Next Steps:**
1.  Define the full `AppState` interface based on current scattered state.
2.  Refactor components to read from `getStore()` and update via `updateStore()`.
3.  Implement `subscribe` and `unsubscribe` in components to react to state changes and prevent memory leaks.
