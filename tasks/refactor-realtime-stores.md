# Task: Refactor Real-time Stores for Robustness

## 1. Overview

The goal is to apply the robust, reference-counted subscription model from `comments-store.ts` to other stores that manage real-time Firestore subscriptions, improving testability and predictability.

**Model Pattern (comments-store.ts)** - Successfully implements:
- Private class fields for signals (#-prefixed)
- Reference-counted subscriptions
- Explicit state machine (`idle`, `subscribing`, `subscribed`)
- Clean register/deregister API

## 2. Current State Analysis (Updated: 2025-01-03)

### ✅ Completed
- **`comments-store.ts`**: Fully refactored with reference-counting pattern (serves as template)

### ❌ Verified Issues That Need Fixing

#### HIGH PRIORITY - Signal Encapsulation Violations
1. **`LoginPage.tsx`** (lines 14-16): Module-level signals break testability
   ```typescript
   const emailSignal = signal('');  // Global mutable state!
   const passwordSignal = signal('');
   const formDefaultsLoadedSignal = signal(false);
   ```

2. **`useConfig.ts`** (lines 25-27): Module-level signals
   ```typescript
   const configSignal = signal<AppConfiguration | null>(null);
   const loadingSignal = signal(false);
   const errorSignal = signal<Error | null>(null);
   ```

#### MEDIUM PRIORITY - Store Architecture Issues
1. **`group-detail-store-enhanced.ts`**:
   - Uses single `currentGroupId` - can only track one group
   - No reference counting (multiple components = duplicate subscriptions)
   - Has proper signal encapsulation BUT missing multi-resource support

2. **`permissions-store.ts`**:
   - Has `dispose()` method but NO components call it
   - No reference counting
   - Uses regular signals (not private) but at class level (acceptable)

#### MEDIUM PRIORITY - Missing Cleanup
1. **`ExpenseDetailPage`**: No subscription cleanup
2. **`GroupDetailPage`**: Calls `dispose()` but no reference counting means issues with nested components

## 3. Implementation Plan

### Phase 1: Critical Signal Encapsulation (Day 1)

#### Fix 1: Create ConfigStore
- Create `webapp-v2/src/stores/config-store.ts` with private signals
- Replace `useConfig.ts` module-level signals with store instance
- Maintain backward compatibility

#### Fix 2: Fix LoginPage Signals
- Convert module signals to component `useState` with sessionStorage
- Test form persistence across navigation

### Phase 2: Store Reference Counting (Days 2-3)

#### Fix 3: Enhance GroupDetailStore
- Add `Map<groupId, number>` for reference counting
- Implement `registerComponent(groupId, userId)` / `deregisterComponent(groupId)` 
- Support multiple concurrent group subscriptions
- Use comments-store pattern as template

#### Fix 4: Fix PermissionsStore
- Add reference counting for group subscriptions
- Hook up component cleanup calls (currently missing)
- Support multiple groups

### Phase 3: Component Cleanup (Day 4)

#### Fix 5: Add Missing Cleanup
- `ExpenseDetailPage`: Add useEffect cleanup
- All components using stores: Ensure proper deregister calls

### Phase 4: Testing & Validation (Day 5)

- Unit tests for reference counting
- Memory leak testing (navigation stress test)
- Firebase listener count monitoring

## 4. Why This Matters for Testability & Predictability

### Current Problems:
1. **Module-level signals** = global mutable state → impossible to test in isolation
2. **Missing cleanup** → memory leaks and unpredictable behavior  
3. **No reference counting** → duplicate subscriptions and race conditions
4. **Single resource assumption** → breaks with concurrent component instances

### Benefits After Refactor:
- **Testable**: No global state, isolated store instances
- **Predictable**: Reference counting prevents subscription leaks
- **Robust**: Proper cleanup prevents memory issues
- **Scalable**: Multiple resource support

## 5. Success Metrics

- [ ] Zero module-level signals 
- [ ] No Firebase listener accumulation during navigation
- [ ] Memory stable during stress testing (100+ page navigations)
- [ ] All components have proper cleanup

## 6. Time Estimate: 5 days

**Priority: Phase 1 (signal encapsulation) should be done immediately as it breaks testability**

## 7. Implementation Templates

### Reference-Counting Pattern (from comments-store)
```typescript
registerComponent(targetId: string): void {
    const currentCount = this.#subscriberCounts.get(targetId) || 0;
    this.#subscriberCounts.set(targetId, currentCount + 1);
    
    if (currentCount === 0) {
        // First subscriber - create subscription
        this.#subscribeToResource(targetId);
    }
}
```

### Proper Signal Encapsulation
```typescript
class Store {
    readonly #dataSignal = signal<Data>(null);  // Private!
    
    get dataSignal(): ReadonlySignal<Data> {
        return this.#dataSignal;  // Readonly access
    }
}
```

### Component Cleanup Pattern
```typescript
useEffect(() => {
    store.registerComponent(resourceId);
    return () => store.deregisterComponent(resourceId);
}, [resourceId]);
```