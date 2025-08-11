# State Management Guide

This guide defines the patterns and conventions for managing state in the webapp-v2 application using Preact Signals.

## Overview

The application uses **Preact Signals** (`@preact/signals`) as its core reactivity and state management system. This provides:
- Fine-grained reactivity without unnecessary re-renders
- Automatic dependency tracking
- Synchronous updates
- TypeScript support

## Architecture

### 1. Store Pattern

Global state is organized into feature-based "stores" that encapsulate related signals, computed values, and actions.

```typescript
// Example Store Structure
interface SomeStore {
  // State properties (read-only)
  data: SomeData[];
  loading: boolean;
  error: string | null;
  
  // Actions
  fetchData(): Promise<void>;
  updateData(item: SomeData): Promise<void>;
  clearError(): void;
}
```

### 2. Signal Declaration

Signals are declared at the module level, outside the store class:

```typescript
// ✅ CORRECT: Module-level signals
const dataSignal = signal<SomeData[]>([]);
const loadingSignal = signal<boolean>(false);
const errorSignal = signal<string | null>(null);

class SomeStoreImpl implements SomeStore {
  get data() { return dataSignal.value; }
  get loading() { return loadingSignal.value; }
  get error() { return errorSignal.value; }
}
```

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

**Pattern 1: Direct Store Access (Simple Cases)**
```typescript
// For simple, direct access in components
import { groupsStore } from '../stores/groups-store';

function MyComponent() {
  return <div>{groupsStore.groups.length} groups</div>;
}
```

**Pattern 2: useComputed for Derived State (Recommended)**
```typescript
// For derived state or when combining multiple signals
import { useComputed } from '@preact/signals';
import { groupsStore } from '../stores/groups-store';

function MyComponent() {
  const activeGroups = useComputed(() => 
    groupsStore.groups.filter(g => g.active)
  );
  
  const hasError = useComputed(() => 
    groupsStore.error !== null
  );
  
  return <div>{activeGroups.value.length} active groups</div>;
}
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
await groupsStore.fetchGroups();   // Call actions

// Option B: Always use useComputed for reading
const groups = useComputed(() => groupsStore.groups);
await groupsStore.fetchGroups();
```

**Recommendation**: Use `useComputed` when you need derived state or are combining multiple signals. Use direct access for simple reads.

### 2. Error Handling

Always handle errors at the store level and expose them as signals:

```typescript
class StoreImpl {
  async fetchData() {
    loadingSignal.value = true;
    errorSignal.value = null;
    
    try {
      const data = await api.getData();
      dataSignal.value = data;
    } catch (error) {
      errorSignal.value = this.getErrorMessage(error);
      throw error; // Re-throw for component-level handling if needed
    } finally {
      loadingSignal.value = false;
    }
  }
}
```

### 3. Loading States

Use the new `LoadingState` component for consistent loading UI:

```typescript
import { LoadingState } from '../components/ui';

function MyComponent() {
  const loading = useComputed(() => groupsStore.loading);
  
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
  const error = useComputed(() => groupsStore.error);
  
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