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

## 3. The Solution: Enhanced Store Architecture with Dependency Injection

**SUPERSEDED APPROACH**: The original proposal suggested creating a separate `firebaseService.ts` abstraction layer with dependency injection via Vite aliases. This approach has been superseded because:
- It conflicts with the existing Preact Signals store architecture
- It violates the project principle of "no different code paths for dev/test vs production"
- It adds unnecessary complexity by duplicating the abstraction that stores already provide

**REFINED APPROACH**: Use a Provider-based dependency injection system that enhances existing stores AND the API client with test mode capabilities, working WITH the established Signals pattern and preserving the existing async initialization architecture.

### 3.0. Key Architectural Principles

1. **Preserve Existing Patterns**: Maintain current async store initialization and singleton patterns
2. **Type-Safe Dependency Injection**: Use React/Preact Context for clean DI without global pollution
3. **Configuration-Based Testing**: Test mode through configuration, not code paths
4. **Signal Reactivity Preserved**: Components still react to state changes, from mock or real data
5. **Comprehensive Error Simulation**: Enable testing of all error states and edge cases

### 3.1. The Refined Strategy

1. **Store Context Provider**: Create a `StoreProvider` that can inject either production or test store instances
2. **Async Store Initialization Preservation**: Maintain existing async `create()` patterns with optional test configuration
3. **API Client Enhancement**: Add test mode to `apiClient.ts` for mock HTTP responses with comprehensive error simulation
4. **Real-time Simulation**: Enable stores to simulate `onSnapshot` events with mock data updates, including errors
5. **Type-Safe DI**: Use proper TypeScript interfaces to ensure test stores match production stores exactly
6. **Performance Monitoring**: Include measurement tools to ensure sub-100ms test execution
7. **Progressive Enhancement**: Implement store by store as needed, starting with AuthStore and ApiClient

## 4. Implementation Plan

### Phase 1: Core Infrastructure (Store Provider + AuthStore)

These are the primary blockers for component testing.

1. **Create Store Context Provider**:
   ```typescript
   // store-provider.tsx
   interface StoreContextValue {
     authStore: AuthStore;
     apiClient: ApiClient;
     groupsStore: GroupsStore;
     // Add other stores as needed
   }

   const StoreContext = createContext<StoreContextValue | null>(null);

   export const StoreProvider = ({ children, testConfig }: {
     children: ReactNode;
     testConfig?: TestConfig;
   }) => {
     const stores = useMemo(async () => {
       if (testConfig) {
         // Create test stores with mock configuration
         const authStore = await TestAuthStore.create(testConfig.auth);
         const apiClient = new TestApiClient(testConfig.api);
         const groupsStore = await TestGroupsStore.create(testConfig.groups);
         return { authStore, apiClient, groupsStore };
       } else {
         // Use production stores
         const authStore = await getAuthStore();
         const apiClient = prodApiClient;
         const groupsStore = await getGroupsStore();
         return { authStore, apiClient, groupsStore };
       }
     }, [testConfig]);

     return (
       <StoreContext.Provider value={stores}>
         {children}
       </StoreContext.Provider>
     );
   };

   export const useStores = () => {
     const context = useContext(StoreContext);
     if (!context) throw new Error('useStores must be used within StoreProvider');
     return context;
   };
   ```

2. **Create Abstract FirebaseService Interface**:
   ```typescript
   // firebase-service.interface.ts
   interface IFirebaseService {
     initialize(): Promise<void>;
     onAuthStateChanged(callback: (user: User | null) => void): () => void;
     signInWithEmailAndPassword(email: string, password: string): Promise<UserCredential>;
     signOut(): Promise<void>;
     sendPasswordResetEmail(email: string): Promise<void>;
     getAuth(): Auth | null;
   }

   // firebase-service.prod.ts - Production implementation
   export class ProductionFirebaseService implements IFirebaseService {
     async initialize() { /* existing Firebase initialization */ }
     onAuthStateChanged(callback) { /* existing Firebase auth listener */ }
     // ... other Firebase methods
   }

   // firebase-service.test.ts - Test implementation
   export class TestFirebaseService implements IFirebaseService {
     private mockUser: User | null = null;
     private authCallbacks: ((user: User | null) => void)[] = [];

     constructor(private config: AuthTestConfig) {
       this.mockUser = config.mockUser || null;
     }

     async initialize() {
       // Immediate mock initialization
       setTimeout(() => {
         this.authCallbacks.forEach(cb => cb(this.mockUser));
       }, 0);
     }

     onAuthStateChanged(callback: (user: User | null) => void) {
       this.authCallbacks.push(callback);
       // Immediately call with current mock user
       setTimeout(() => callback(this.mockUser), 0);
       return () => {
         const index = this.authCallbacks.indexOf(callback);
         if (index > -1) this.authCallbacks.splice(index, 1);
       };
     }

     async signInWithEmailAndPassword(email: string, password: string) {
       if (this.config.loginError) {
         throw new Error(this.config.loginError);
       }
       // Return mock user credential
       return { user: this.mockUser } as UserCredential;
     }

     // Test utilities
     setMockUser(user: User | null) {
       this.mockUser = user;
       this.authCallbacks.forEach(cb => cb(user));
     }
   }
   ```

3. **AuthStore Uses Dependency Injection**:
   ```typescript
   // auth-store.ts - Clean production code, no test conditionals
   class AuthStoreImpl implements AuthStore {
     #firebaseService: IFirebaseService;
     #userSignal = signal<User | null>(null);

     private constructor(firebaseService: IFirebaseService) {
       this.#firebaseService = firebaseService;
     }

     static async create(firebaseService: IFirebaseService): Promise<AuthStoreImpl> {
       const store = new AuthStoreImpl(firebaseService);
       await store.initialize();
       return store;
     }

     private async initialize() {
       // Same code path for both prod and test - no conditionals!
       await this.#firebaseService.initialize();

       this.#firebaseService.onAuthStateChanged((firebaseUser) => {
         if (firebaseUser) {
           const user = mapFirebaseUser(firebaseUser);
           this.#userSignal.value = user;
           // ... existing auth logic
         } else {
           this.#userSignal.value = null;
           // ... existing cleanup logic
         }
       });
     }

     async login(email: string, password: string) {
       // Same implementation - the service abstraction handles test vs prod
       const credential = await this.#firebaseService.signInWithEmailAndPassword(email, password);
       // ... rest of login logic
     }

     // No test-specific methods in production class!
   }

   // Separate test wrapper that extends functionality
   export class TestAuthStore extends AuthStoreImpl {
     private testService: TestFirebaseService;

     constructor(testService: TestFirebaseService) {
       super(testService);
       this.testService = testService;
     }

     // Test utilities only exist on test class
     simulateUser(user: User | null) {
       this.testService.setMockUser(user);
     }

     simulateLoginError(error: string) {
       this.testService.config.loginError = error;
     }
   }
   ```

4. **Abstract HTTP Transport Interface**:
   ```typescript
   // http-transport.interface.ts
   interface IHttpTransport {
     request<T>(config: RequestConfig): Promise<T>;
   }

   // http-transport.prod.ts - Production HTTP transport
   export class ProductionHttpTransport implements IHttpTransport {
     async request<T>(config: RequestConfig): Promise<T> {
       // Existing fetch-based implementation
       const response = await fetch(config.url, {
         method: config.method,
         headers: config.headers,
         body: config.body
       });
       return response.json();
     }
   }

   // http-transport.test.ts - Test HTTP transport
   export class TestHttpTransport implements IHttpTransport {
     constructor(private config: ApiTestConfig) {}

     async request<T>(config: RequestConfig): Promise<T> {
       // Simulate network delay
       if (this.config.networkDelay) {
         await new Promise(resolve =>
           setTimeout(resolve, this.config.networkDelay)
         );
       }

       // Simulate random errors
       if (this.config.errorRate && Math.random() < this.config.errorRate) {
         throw new ApiError('Simulated network error', 'NETWORK_ERROR');
       }

       // Check for custom errors
       const mockKey = `${config.method}:${config.endpoint}`;
       if (this.config.customErrors?.[mockKey]) {
         throw this.config.customErrors[mockKey];
       }

       // Return mock response
       if (this.config.mockResponses?.[mockKey]) {
         return this.config.mockResponses[mockKey];
       }

       // Default success
       return { success: true, data: config.body } as T;
     }
   }

   // ApiClient uses dependency injection - clean production code
   class ApiClientImpl {
     #transport: IHttpTransport;

     constructor(transport: IHttpTransport) {
       this.#transport = transport;
     }

     async post<T>(endpoint: string, data: any): Promise<T> {
       // Same code for prod and test - no conditionals!
       return this.#transport.request<T>({
         endpoint,
         method: 'POST',
         body: data,
         headers: this.buildHeaders()
       });
     }

     async get<T>(endpoint: string): Promise<T> {
       return this.#transport.request<T>({
         endpoint,
         method: 'GET',
         headers: this.buildHeaders()
       });
     }

     private buildHeaders() {
       const headers: Record<string, string> = {
         'Content-Type': 'application/json'
       };
       if (this.authToken) {
         headers['Authorization'] = `Bearer ${this.authToken}`;
       }
       return headers;
     }
   }

   // Test-specific wrapper (only used in tests)
   export class TestApiClient extends ApiClientImpl {
     private testTransport: TestHttpTransport;

     constructor(testTransport: TestHttpTransport) {
       super(testTransport);
       this.testTransport = testTransport;
     }

     // Test utilities only exist on test class
     setMockResponse(method: string, endpoint: string, response: any) {
       this.testTransport.config.mockResponses = {
         ...this.testTransport.config.mockResponses,
         [`${method}:${endpoint}`]: response
       };
     }
   }
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

### Phase 3: Test Configuration System

1. **Test Configuration Types**:
   ```typescript
   // test-config.types.ts
   interface TestConfig {
     auth: AuthTestConfig;
     api: ApiTestConfig;
     groups: GroupsTestConfig;
     performance: PerformanceTestConfig;
   }

   interface AuthTestConfig {
     mockUser?: User;
     simulateLoginDelay?: number;
     loginError?: string;
   }

   interface GroupsTestConfig {
     mockGroups?: Group[];
     realtimeDelay?: number;
     firestoreError?: string;
   }

   interface PerformanceTestConfig {
     measureRenders?: boolean;
     maxTestDuration?: number; // fail test if exceeds this
     logPerformance?: boolean;
   }
   ```

2. **Test Setup Utilities**:
   ```typescript
   // test-utils/component-test-helpers.ts
   import { TestConfig } from './test-config.types';

   // Predefined test scenarios
   export const testScenarios = {
     authenticatedUser: (): TestConfig => ({
       auth: {
         mockUser: {
           uid: 'test-user-123',
           email: 'test@example.com',
           displayName: 'Test User'
         }
       },
       api: {
         mockResponses: {
           'GET:/groups': { groups: mockGroups },
           'POST:/groups': { success: true, groupId: 'new-group-123' }
         }
       },
       groups: {
         mockGroups: [
           { id: 'group-1', name: 'Test Group', members: ['test-user-123'] }
         ]
       },
       performance: {
         measureRenders: true,
         maxTestDuration: 100 // 100ms max
       }
     }),

     unauthenticatedUser: (): TestConfig => ({
       auth: {}, // No mock user - should show login
       api: { mockResponses: {} },
       groups: { mockGroups: [] },
       performance: { maxTestDuration: 50 }
     }),

     networkErrors: (): TestConfig => ({
       auth: { mockUser: testUsers.authenticated },
       api: {
         errorRate: 0.5, // 50% of requests fail
         networkDelay: 2000 // 2s delay
       },
       groups: { firestoreError: 'Permission denied' },
       performance: { logPerformance: true }
     })
   };

   // Performance monitoring
   export class TestPerformanceMonitor {
     private startTime: number;
     private config: PerformanceTestConfig;

     constructor(config: PerformanceTestConfig) {
       this.config = config;
       this.startTime = performance.now();
     }

     finish() {
       const duration = performance.now() - this.startTime;

       if (this.config.logPerformance) {
         console.log(`Test completed in ${duration}ms`);
       }

       if (this.config.maxTestDuration && duration > this.config.maxTestDuration) {
         throw new Error(
           `Test exceeded maximum duration: ${duration}ms > ${this.config.maxTestDuration}ms`
         );
       }

       return duration;
     }
   }
   ```

3. **Component Test Wrapper**:
   ```typescript
   // test-utils/test-component-wrapper.tsx
   export const TestComponentWrapper = ({
     children,
     scenario,
     customConfig
   }: {
     children: ReactNode;
     scenario: keyof typeof testScenarios;
     customConfig?: Partial<TestConfig>;
   }) => {
     const testConfig = useMemo(() => ({
       ...testScenarios[scenario](),
       ...customConfig
     }), [scenario, customConfig]);

     const performanceMonitor = useMemo(
       () => new TestPerformanceMonitor(testConfig.performance),
       [testConfig.performance]
     );

     useEffect(() => {
       return () => {
         try {
           performanceMonitor.finish();
         } catch (error) {
           console.error('Performance test failed:', error);
           throw error;
         }
       };
     }, [performanceMonitor]);

     return (
       <StoreProvider testConfig={testConfig}>
         {children}
       </StoreProvider>
     );
   };
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

### 5.1. Refined Component Test Examples

```typescript
// ExpenseForm.component.test.ts
import { test, expect } from '@playwright/experimental-ct-react';
import { ExpenseForm } from './ExpenseForm';
import { TestComponentWrapper, testScenarios } from '../test-utils/test-component-wrapper';

test('should submit expense form with authenticated user', async ({ mount }) => {
  const component = await mount(
    <TestComponentWrapper scenario="authenticatedUser">
      <ExpenseForm groupId="group-1" />
    </TestComponentWrapper>
  );

  // Component loads without auth redirect - clean test
  await expect(component.getByLabel('Amount')).toBeVisible();
  await expect(component.getByLabel('Description')).toBeVisible();

  // Fill and submit form
  await component.getByLabel('Amount').fill('25.00');
  await component.getByLabel('Description').fill('Team lunch');
  await component.getByRole('button', { name: 'Save Expense' }).click();

  // Assert API call succeeded (mocked, under 100ms)
  await expect(component.getByText('Expense saved successfully')).toBeVisible();
});

test('should handle validation errors gracefully', async ({ mount }) => {
  const component = await mount(
    <TestComponentWrapper
      scenario="authenticatedUser"
      customConfig={{
        api: {
          customErrors: {
            'POST:/expenses': new ApiError('Amount must be positive', 'VALIDATION_ERROR')
          }
        }
      }}
    >
      <ExpenseForm groupId="group-1" />
    </TestComponentWrapper>
  );

  await component.getByLabel('Amount').fill('-10');
  await component.getByRole('button', { name: 'Save Expense' }).click();

  // Error is displayed immediately - no network delay
  await expect(component.getByText('Amount must be positive')).toBeVisible();
});

test('should handle network failures with retry behavior', async ({ mount }) => {
  const component = await mount(
    <TestComponentWrapper
      scenario="networkErrors"
      customConfig={{
        performance: { maxTestDuration: 500 } // Allow more time for retries
      }}
    >
      <ExpenseForm groupId="group-1" />
    </TestComponentWrapper>
  );

  await component.getByLabel('Amount').fill('25.00');
  await component.getByLabel('Description').fill('Lunch');
  await component.getByRole('button', { name: 'Save Expense' }).click();

  // Should show loading state during retry
  await expect(component.getByText('Saving...')).toBeVisible();

  // Eventually should show network error
  await expect(component.getByText('Network error occurred')).toBeVisible();
});

test('should redirect unauthenticated users', async ({ mount }) => {
  const component = await mount(
    <TestComponentWrapper scenario="unauthenticatedUser">
      <ExpenseForm groupId="group-1" />
    </TestComponentWrapper>
  );

  // Should redirect to login immediately - very fast test
  await expect(component.getByText('Please log in')).toBeVisible();
});

test('should react to real-time group member changes', async ({ mount }) => {
  const component = await mount(
    <TestComponentWrapper scenario="authenticatedUser">
      <ExpenseForm groupId="group-1" />
    </TestComponentWrapper>
  );

  // Initial member list
  await expect(component.getByText('Test User')).toBeVisible();

  // Simulate real-time update through store context
  await component.evaluate(() => {
    const { groupsStore } = window.__STORE_CONTEXT__;
    (groupsStore as TestGroupsStore).__test_addMember('group-1', {
      id: 'new-user-456',
      displayName: 'New User',
      themeColor: '#blue'
    });
  });

  // UI updates reactively via signals
  await expect(component.getByText('New User')).toBeVisible();
});

test('should handle form validation edge cases', async ({ mount }) => {
  const component = await mount(
    <TestComponentWrapper
      scenario="authenticatedUser"
      customConfig={{
        performance: {
          measureRenders: true,
          maxTestDuration: 75 // Tight performance constraint
        }
      }}
    >
      <ExpenseForm groupId="group-1" />
    </TestComponentWrapper>
  );

  // Test multiple validation states quickly
  await component.getByLabel('Amount').fill('0');
  await expect(component.getByText('Amount must be greater than 0')).toBeVisible();

  await component.getByLabel('Amount').fill('999999');
  await expect(component.getByText('Amount too large')).toBeVisible();

  await component.getByLabel('Amount').fill('25.50');
  await expect(component.getByText('Amount too large')).not.toBeVisible();

  // Performance monitor automatically fails if this takes >75ms
});
```

### 5.2. Advanced Error Simulation Examples

```typescript
// Error simulation scenarios
test('should handle Firebase permission errors', async ({ mount }) => {
  const component = await mount(
    <TestComponentWrapper
      scenario="authenticatedUser"
      customConfig={{
        groups: {
          firestoreError: 'PERMISSION_DENIED: User lacks permission'
        }
      }}
    >
      <GroupsList />
    </TestComponentWrapper>
  );

  await expect(component.getByText('Permission denied')).toBeVisible();
});

test('should handle auth token expiration', async ({ mount }) => {
  const component = await mount(
    <TestComponentWrapper
      scenario="authenticatedUser"
      customConfig={{
        auth: {
          simulateTokenExpiry: true // Custom test scenario
        }
      }}
    >
      <ExpenseForm groupId="group-1" />
    </TestComponentWrapper>
  );

  await component.getByRole('button', { name: 'Save Expense' }).click();

  // Should automatically refresh token and retry
  await expect(component.getByText('Token refreshed, retrying...')).toBeVisible();
  await expect(component.getByText('Expense saved successfully')).toBeVisible();
});

test('should handle concurrent modifications', async ({ mount }) => {
  const component = await mount(
    <TestComponentWrapper
      scenario="authenticatedUser"
      customConfig={{
        api: {
          customErrors: {
            'PUT:/expenses/123': new ApiError('Document was modified', 'CONFLICT')
          }
        }
      }}
    >
      <ExpenseEditForm expenseId="123" />
    </TestComponentWrapper>
  );

  await component.getByLabel('Description').fill('Updated description');
  await component.getByRole('button', { name: 'Save' }).click();

  await expect(component.getByText('Document was modified by another user')).toBeVisible();
  await expect(component.getByRole('button', { name: 'Reload' })).toBeVisible();
});
```

## 6. Benefits of This Refined Approach

- **Complete Firebase Isolation**: Covers auth, API calls, AND real-time listeners through abstraction
- **Architectural Consistency**: Works WITH existing Preact Signals stores, preserves async patterns
- **Production Code Purity**: ZERO test conditionals in production code - pure dependency injection
- **Interface-Based Abstractions**: Clean separation between production and test implementations
- **Signal Reactivity Preserved**: Components still react to state changes, but from mock services
- **Real-time Testing**: Can simulate `onSnapshot` events without actual Firestore through service layer
- **API Testing**: Can test success and error responses without network calls via transport abstraction
- **Type Safety**: Test services implement same interfaces as production services
- **Performance Monitoring**: Built-in measurement and failure detection for slow tests
- **Progressive Implementation**: Can enhance stores incrementally through service interfaces
- **Fast Tests**: No Firebase emulator startup, no network calls, millisecond execution
- **Clean Architecture**: Proper separation of concerns with testable abstractions

## 7. Key Architectural Principles

1. **Dependency Injection Over Conditionals**: Use proper DI with interface abstractions instead of test mode flags
2. **Service Layer Abstractions**: Abstract Firebase services behind interfaces that can be swapped
3. **Production Code Isolation**: Production classes have ZERO knowledge of test scenarios
4. **Interface Compliance**: Test services must implement exact same interfaces as production services
5. **Mock All External Dependencies**: Auth, API calls, and real-time listeners abstracted through service layer
6. **Clean Test Extensions**: Test utilities extend base classes without polluting production code
7. **Performance Constraints**: Built-in performance monitoring ensures tests stay fast
8. **Type Safety**: All abstractions are fully typed and compile-time verified

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