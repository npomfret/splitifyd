# State Management Guide

This guide defines the patterns and conventions for managing state in the webapp-v2 application using Preact Signals.

## Overview

The application uses **Preact Signals** (`@preact/signals`) as its core reactivity and state management system. This provides:

- Fine-grained reactivity without unnecessary re-renders
- Automatic dependency tracking
- Synchronous updates
- TypeScript support
- **Proper encapsulation** through private class fields

## Architecture

### 1. Store Pattern

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

### 2. Signal Declaration - PROPER ENCAPSULATION

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

### ❌ ANTI-PATTERN TO AVOID

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

### 3. Store Singleton Pattern

Stores are exported as singleton instances:

```typescript
// Store implementation
class GroupsStoreImpl implements GroupsStore {
    // implementation...
}

// Export singleton instance
export const groupsStore = new GroupsStoreImpl();
```

## Component Usage Patterns

### Reading Store State

With properly encapsulated stores, components access state through ReadonlySignals:

**Pattern 1: Direct Signal Access (Simple Cases)**

```typescript
// For simple, direct access in components
import { groupsStore } from '../stores/groups-store';

function MyComponent() {
  // groupsStore.groups is a ReadonlySignal<Group[]>
  // Use .value to access the current value
  return <div>{groupsStore.groups.value.length} groups</div>;
}
```

**Pattern 2: useComputed for Derived State (Recommended)**

```typescript
// For derived state or when combining multiple signals
import { useComputed } from '@preact/signals';
import { groupsStore } from '../stores/groups-store';

function MyComponent() {
  const activeGroups = useComputed(() =>
    groupsStore.groups.value.filter(g => g.active)
  );

  const hasError = useComputed(() =>
    groupsStore.error.value !== null
  );

  return <div>{activeGroups.value.length} active groups</div>;
}
```

**Important:** Components can only read state, never mutate it directly:

```typescript
// ❌ This won't work anymore (and that's good!)
groupsStore.groups.value = []; // TypeError: Cannot set property value of #<ReadonlySignal>

// ✅ Use store actions instead
await groupsStore.clearGroups(); // Proper way to mutate state
```

### Local Component State

Use `useSignal` for component-local state:

```typescript
import { useSignal } from '@preact/signals';

function MyComponent() {
  const isOpen = useSignal(false);
  const searchTerm = useSignal('');

  return (
    <div>
      <input
        value={searchTerm.value}
        onInput={(e) => searchTerm.value = e.currentTarget.value}
      />
      <button onClick={() => isOpen.value = !isOpen.value}>
        Toggle
      </button>
    </div>
  );
}
```

## Form State Management

### Complex Forms

For complex forms with many fields, use a single signal with an object:

```typescript
interface FormData {
  name: string;
  email: string;
  amount: number;
}

function MyForm() {
  const formData = useSignal<FormData>({
    name: '',
    email: '',
    amount: 0
  });

  const updateField = (field: keyof FormData, value: any) => {
    formData.value = {
      ...formData.value,
      [field]: value
    };
  };

  return (
    <form>
      <input
        value={formData.value.name}
        onInput={(e) => updateField('name', e.currentTarget.value)}
      />
    </form>
  );
}
```

### Simple Forms

For simple forms with few fields, individual signals are acceptable:

```typescript
function SimpleForm() {
  const email = useSignal('');
  const password = useSignal('');

  return (
    <form>
      <input
        value={email.value}
        onInput={(e) => email.value = e.currentTarget.value}
      />
    </form>
  );
}
```

## Best Practices

### 1. Consistent Access Pattern

Choose one pattern and use it consistently throughout the application:

```typescript
// CHOOSE ONE:

// Option A: Direct store access for reading, actions for mutations
const groups = groupsStore.groups; // Read directly
await groupsStore.fetchGroups(); // Call actions

// Option B: Always use useComputed for reading
const groups = useComputed(() => groupsStore.groups);
await groupsStore.fetchGroups();
```

**Recommendation**: Use `useComputed` when you need derived state or are combining multiple signals. Use direct access for simple reads.

### 2. Error Handling

Always handle errors at the store level and expose them as ReadonlySignals:

```typescript
class StoreImpl {
    #loadingSignal = signal<boolean>(false);
    #errorSignal = signal<string | null>(null);
    #dataSignal = signal<SomeData[]>([]);

    get loading(): ReadonlySignal<boolean> {
        return this.#loadingSignal;
    }

    get error(): ReadonlySignal<string | null> {
        return this.#errorSignal;
    }

    async fetchData() {
        this.#loadingSignal.value = true;
        this.#errorSignal.value = null;

        try {
            const data = await api.getData();
            this.#dataSignal.value = data;
        } catch (error) {
            this.#errorSignal.value = this.getErrorMessage(error);
            throw error; // Re-throw for component-level handling if needed
        } finally {
            this.#loadingSignal.value = false;
        }
    }
}
```

### 3. Loading States

Use the new `LoadingState` component for consistent loading UI:

```typescript
import { LoadingState } from '../components/ui';

function MyComponent() {
  // Access the ReadonlySignal directly
  const loading = groupsStore.loading;

  if (loading.value) {
    return <LoadingState message="Loading groups..." />;
  }

  return <div>Content</div>;
}
```

### 4. Error Display

Use the new `ErrorState` component for consistent error UI:

```typescript
import { ErrorState } from '../components/ui';

function MyComponent() {
  // Access the ReadonlySignal directly
  const error = groupsStore.error;

  if (error.value) {
    return (
      <ErrorState
        error={error.value}
        onRetry={() => groupsStore.fetchGroups()}
      />
    );
  }

  return <div>Content</div>;
}
```

## Anti-Patterns to Avoid

### ❌ Creating signals inside components

```typescript
// WRONG: Creates new signal on every render
function BadComponent() {
  const data = signal([]); // ❌ Don't do this
  return <div>{data.value.length}</div>;
}

// CORRECT: Use useSignal hook
function GoodComponent() {
  const data = useSignal([]); // ✅
  return <div>{data.value.length}</div>;
}
```

### ❌ Mutating nested objects directly

```typescript
// WRONG: Direct mutation doesn't trigger updates
formData.value.name = 'New Name'; // ❌

// CORRECT: Create new object
formData.value = { ...formData.value, name: 'New Name' }; // ✅
```

### ❌ Mixing state management patterns

Don't mix different state management approaches (e.g., useState with signals) in the same component unless absolutely necessary.

## Testing

When testing components that use stores:

1. Reset stores before each test
2. Mock API calls at the store level
3. Use the store's reset() method if available

```typescript
beforeEach(() => {
  groupsStore.reset();
});

test('displays groups', async () => {
  // Mock the store state
  groupsStore.groups = mockGroups;

  // Test component behavior
  const { getByText } = render(<GroupsList />);
  expect(getByText('3 groups')).toBeInTheDocument();
});
```

## Migration Guide

When refactoring existing components:

1. Identify all state variables
2. Determine if state should be local (useSignal) or global (store)
3. For global state, add to existing store or create new store
4. Replace useState with useSignal for local state
5. Update event handlers to use signal.value assignment
6. Test thoroughly as signals update synchronously

## Summary

- Use **Preact Signals** for all state management
- Organize global state into **feature-based stores**
- Use **useComputed** for derived state
- Use **useSignal** for local component state
- Handle loading and errors consistently with the new UI components
- Choose a consistent pattern for accessing store state
- Avoid anti-patterns like creating signals in render or direct mutation
