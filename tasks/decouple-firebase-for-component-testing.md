# Task: Enable Firebase-Free Component Testing via Store Enhancement

## Goal: Fast Playwright Unit Tests Without Firebase Complexity

**What we want to achieve**: Enable fast, isolated Playwright component tests that run in milliseconds without requiring Firebase emulator startup, network calls, or complex authentication flows.

**Current problem**: Every time we try to test a UI component (like `ExpenseForm`, `Dashboard`, `GroupSettings`), Firebase Auth immediately redirects us to `/login` because no user is authenticated, making the component impossible to test in isolation.

**Target outcome**: Component tests that:
- Mount and test UI components directly (no auth redirects)
- Run in under 100ms each (no emulator startup delay)
- Test UI behavior, validation, user interactions in isolation
- Don't require external services or network connectivity
- Can simulate any authentication state (logged in, logged out, different users)

## 1. The Problem: Untestable UI Components

A significant portion of the web application's UI components are currently untestable in isolation using Playwright component tests. This is due to the tight coupling between components and Firebase, particularly the authentication redirect behavior.

### 1.1. Key Issues

1. **Forced Authentication Flow**: Nearly every component assumes an authenticated user is present. If Firebase Auth state is not authenticated, the application's routing logic immediately redirects to the `/login` page, making it impossible to mount and test components like `Dashboard` or `ExpenseForm` in isolation.

2. **Slow Emulator Dependency**: Current integration tests require the Firebase emulator to be running, which adds 2-3 seconds startup overhead and complexity for what should be fast unit tests. We want component tests that run in milliseconds, not seconds.

3. **Network Dependencies**: Firebase interactions involve network calls (even to local emulator), making tests slower and potentially flaky compared to pure in-memory component testing.

4. **Low-Value Tests**: Existing Playwright component tests fall into two unhelpful categories:
   * **"Fake DOM" Tests**: Tests that inject artificial DOM, testing mock-ups rather than real components
   * **Redirect Tests**: Tests that simply assert redirection to login, leaving actual component functionality untested

The core issue is the inability to control Firebase state (auth, API calls, and real-time listeners) during component testing, preventing us from testing authenticated UI behavior in fast, isolated unit tests.

## 2. The Complete Firebase Dependencies

Components interact with Firebase through three main channels:

1. **Authentication** - Firebase Auth (`onAuthStateChanged` in AuthStore)
2. **API Calls** - HTTP requests to Firebase Functions backend (via `apiClient.ts`)
3. **Real-time Data** - Firestore `onSnapshot` listeners (GroupsStore, ExpensesStore, CommentsStore, etc.)

All three need to be mockable for truly isolated component testing.

## 3. The Solution: Comprehensive Store Enhancement

**SUPERSEDED APPROACH**: The original proposal suggested creating a separate `firebaseService.ts` abstraction layer with dependency injection via Vite aliases. This approach has been superseded because:
- It conflicts with the existing Preact Signals store architecture
- It violates the project principle of "no different code paths for dev/test vs production"
- It adds unnecessary complexity by duplicating the abstraction that stores already provide

**NEW APPROACH**: Enhance existing stores AND the API client with optional test mode configuration, working WITH the established Signals pattern rather than against it.

### 3.1. The Comprehensive Strategy

1. **Store Factory Pattern**: Convert existing store singletons to use factory functions that accept optional test configuration
2. **API Client Enhancement**: Add test mode to `apiClient.ts` for mock HTTP responses
3. **Real-time Simulation**: Enable stores to simulate `onSnapshot` events with mock data updates
4. **Signal Reactivity Preserved**: Components still react to state changes, but from mock data instead of Firebase
5. **Progressive Enhancement**: Implement store by store as needed, starting with AuthStore and ApiClient

## 4. Implementation Plan

### Phase 1: Core Infrastructure (AuthStore + ApiClient)

These are the primary blockers for component testing.

1. **Convert AuthStore to Factory Pattern**:
   ```typescript
   // authStore.ts
   interface StoreConfig {
     testMode?: boolean;
     mockUser?: User;
   }

   class AuthStoreImpl implements AuthStore {
     #auth: Auth | null;
     #userSignal = signal<User | null>(null);

     constructor(config?: StoreConfig) {
       if (config?.testMode) {
         this.#auth = null;
         if (config.mockUser) {
           this.#userSignal.value = config.mockUser;
         }
       } else {
         this.#auth = getAuth();
         this.#initializeAuthListener();
       }
     }
   }

   export function createAuthStore(config?: StoreConfig) {
     return new AuthStoreImpl(config);
   }

   export const authStore = createAuthStore();
   ```

2. **Enhance ApiClient with Test Mode**:
   ```typescript
   // apiClient.ts
   interface ApiConfig {
     testMode?: boolean;
     mockResponses?: Record<string, any>;
   }

   class ApiClientImpl {
     #config: ApiConfig;

     constructor(config: ApiConfig = {}) {
       this.#config = config;
     }

     async post<T>(endpoint: string, data: any): Promise<T> {
       if (this.#config.testMode) {
         // Return mock response instantly
         const mockKey = `POST:${endpoint}`;
         if (this.#config.mockResponses?.[mockKey]) {
           return this.#config.mockResponses[mockKey];
         }
         // Default success response
         return { success: true, data } as T;
       }

       // Real implementation
       return this.realHttpCall(endpoint, data);
     }

     async get<T>(endpoint: string): Promise<T> {
       if (this.#config.testMode) {
         const mockKey = `GET:${endpoint}`;
         return this.#config.mockResponses?.[mockKey] || { data: [] };
       }

       return this.realHttpCall(endpoint);
     }
   }

   export function createApiClient(config?: ApiConfig) {
     return new ApiClientImpl(config);
   }

   export const apiClient = createApiClient();
   ```

### Phase 2: Real-time Data Stores

Convert stores that use `onSnapshot` to support test mode.

1. **GroupsStore with Real-time Simulation**:
   ```typescript
   class GroupsStoreImpl {
     #firestore: Firestore | null;
     #groupsSignal = signal<Group[]>([]);
     #unsubscribes: (() => void)[] = [];

     constructor(config?: StoreConfig) {
       if (config?.testMode) {
         this.#firestore = null;
         // Set mock data immediately
         if (config.mockData?.groups) {
           this.#groupsSignal.value = config.mockData.groups;
         }
       } else {
         this.#firestore = getFirestore();
       }
     }

     subscribeToUserGroups(userId: string) {
       if (!this.#firestore) {
         // Test mode: no subscription, data already set
         return;
       }

       // Real mode: set up Firestore listener
       const unsubscribe = onSnapshot(
         collection(this.#firestore, 'groups'),
         (snapshot) => {
           const groups = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
           this.#groupsSignal.value = groups;
         }
       );

       this.#unsubscribes.push(unsubscribe);
     }

     // Test utility: simulate real-time update
     addMockGroup(group: Group) {
       if (!this.#firestore) {
         this.#groupsSignal.value = [...this.#groupsSignal.value, group];
       }
     }
   }
   ```

2. **ExpensesStore Enhancement**: Similar pattern for expense data
3. **CommentsStore Enhancement**: For comment-related components

### Phase 3: Comprehensive Test Setup

1. **Complete Test Store Configuration**:
   ```typescript
   // test-utils/component-test-setup.ts
   export function setupTestStores() {
     const mockUser = {
       uid: 'test-user-123',
       email: 'test@example.com',
       displayName: 'Test User'
     };

     const mockGroups = [
       { id: 'group-1', name: 'Test Group', members: ['test-user-123'] },
       { id: 'group-2', name: 'Another Group', members: ['test-user-123'] }
     ];

     const mockExpenses = [
       { id: 'expense-1', groupId: 'group-1', amount: 25.00, description: 'Lunch' }
     ];

     // Create all test-mode stores
     const testAuthStore = createAuthStore({
       testMode: true,
       mockUser
     });

     const testGroupsStore = createGroupsStore({
       testMode: true,
       mockData: { groups: mockGroups }
     });

     const testExpensesStore = createExpensesStore({
       testMode: true,
       mockData: { expenses: mockExpenses }
     });

     const testApiClient = createApiClient({
       testMode: true,
       mockResponses: {
         'POST:/groups': { success: true, groupId: 'new-group-123' },
         'POST:/expenses': { success: true, expenseId: 'new-expense-456' },
         'GET:/groups/group-1': { group: mockGroups[0] },
         // Add other mock responses as needed
       }
     });

     // Make available globally
     window.__TEST_STORES__ = {
       authStore: testAuthStore,
       groupsStore: testGroupsStore,
       expensesStore: testExpensesStore,
       apiClient: testApiClient
     };
   }
   ```

2. **Update Store Access Pattern**:
   ```typescript
   // In components or store provider
   const authStore = window.__TEST_STORES__?.authStore ?? prodAuthStore;
   const apiClient = window.__TEST_STORES__?.apiClient ?? prodApiClient;
   ```

### Phase 4: Advanced Testing Features

1. **Real-time Update Testing**:
   ```typescript
   // Test utility: simulate onSnapshot event
   test('should update UI when new expense is added', async ({ mount }) => {
     const component = await mount(<ExpenseList groupId="group-1" />);

     // Initial state
     await expect(component.getByText('Lunch - $25.00')).toBeVisible();

     // Simulate real-time update (without actual Firestore)
     await component.evaluate(() => {
       const testExpensesStore = window.__TEST_STORES__.expensesStore;
       testExpensesStore.addMockExpense({
         id: 'expense-2',
         groupId: 'group-1',
         amount: 15.00,
         description: 'Coffee'
       });
     });

     // Assert UI updated reactively
     await expect(component.getByText('Coffee - $15.00')).toBeVisible();
   });
   ```

2. **API Error Testing**:
   ```typescript
   // Test error scenarios
   export function setupTestStoresWithErrors() {
     const testApiClient = createApiClient({
       testMode: true,
       mockResponses: {
         'POST:/expenses': { error: 'Validation failed', status: 400 }
       }
     });
     // Component can test error handling without network calls
   }
   ```

## 5. Implementation Examples

### 5.1. Comprehensive Component Test Example

```typescript
// ExpenseForm.component.test.ts
import { test, expect } from '@playwright/experimental-ct-react';
import { ExpenseForm } from './ExpenseForm';
import { setupTestStores } from '../test-utils/component-test-setup';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    setupTestStores();
  });
});

test('should submit expense form with API call', async ({ mount }) => {
  const component = await mount(
    <ExpenseForm groupId="group-1" />
  );

  // Component loads without auth redirect
  await expect(component.getByLabel('Amount')).toBeVisible();
  await expect(component.getByLabel('Description')).toBeVisible();

  // Fill and submit form
  await component.getByLabel('Amount').fill('25.00');
  await component.getByLabel('Description').fill('Team lunch');
  await component.getByRole('button', { name: 'Save Expense' }).click();

  // Assert API call succeeded (mocked)
  await expect(component.getByText('Expense saved successfully')).toBeVisible();
});

test('should handle API validation errors', async ({ mount }) => {
  // Set up test with API error response
  await mount.evaluate(() => {
    window.__TEST_STORES__.apiClient = createApiClient({
      testMode: true,
      mockResponses: {
        'POST:/expenses': { error: 'Amount must be positive', status: 400 }
      }
    });
  });

  const component = await mount(<ExpenseForm groupId="group-1" />);

  await component.getByLabel('Amount').fill('-10');
  await component.getByRole('button', { name: 'Save Expense' }).click();

  // Assert error message displayed
  await expect(component.getByText('Amount must be positive')).toBeVisible();
});

test('should react to real-time group member changes', async ({ mount }) => {
  const component = await mount(<ExpenseForm groupId="group-1" />);

  // Initial member list
  await expect(component.getByText('Test User')).toBeVisible();

  // Simulate new member added via real-time update
  await component.evaluate(() => {
    const testGroupsStore = window.__TEST_STORES__.groupsStore;
    testGroupsStore.updateMockGroup('group-1', {
      members: ['test-user-123', 'new-user-456']
    });
  });

  // Assert UI updated with new member
  await expect(component.getByText('New User')).toBeVisible();
});
```

## 6. Benefits of This Comprehensive Approach

- **Complete Firebase Isolation**: Covers auth, API calls, AND real-time listeners
- **Architectural Consistency**: Works WITH existing Preact Signals stores, not against them
- **Production Safety**: No different code paths - test mode is simply configuration
- **Signal Reactivity Preserved**: Components still react to state changes, but from mock data
- **Real-time Testing**: Can simulate `onSnapshot` events without actual Firestore
- **API Testing**: Can test success and error responses without network calls
- **Progressive Implementation**: Can enhance stores incrementally as testing needs arise
- **Fast Tests**: No Firebase emulator startup, no network calls, millisecond execution
- **Minimal Complexity**: Simple configuration pattern, not elaborate mocking frameworks

## 7. Key Principles

1. **Test Mode is Configuration, Not Code Paths**: Stores behave identically in test mode, they just don't call Firebase
2. **Preserve Store Interface**: Test mode stores must have exactly the same API as production stores
3. **Mock All Firebase Interactions**: Auth, API calls, and real-time listeners all need test mode support
4. **Keep Test Mode Simple**: Don't create elaborate mock behaviors - just enough to unblock component testing
5. **Enable Real-time Simulation**: Provide utilities to trigger signal updates, simulating `onSnapshot` events
6. **Document Clearly**: Make it obvious when and why test mode is active

## 8. Implementation Priority

1. **Phase 1**: AuthStore + ApiClient enhancement (unblocks most component testing)
2. **Phase 2**: Real-time stores (GroupsStore, ExpensesStore) for data-driven components
3. **Phase 3**: Complete test infrastructure and examples
4. **Phase 4**: Advanced scenarios (error testing, multi-user simulation, edge cases)

## 9. Success Metrics

After implementation, we should achieve:

- **Component tests run in under 100ms each** (no emulator startup)
- **Zero network dependencies** for component testing
- **Full auth state control** (logged in, logged out, different users)
- **API response simulation** (success, validation errors, server errors)
- **Real-time update testing** without actual Firestore listeners
- **Isolated UI behavior testing** (forms, validation, user interactions)

This comprehensive approach enables fast, isolated component testing of all Firebase-dependent UI while maintaining the project's architectural integrity and testing philosophy.