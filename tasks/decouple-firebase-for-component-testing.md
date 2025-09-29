# Task: Enable Firebase-Free Component Testing via Complete Service Override

## Goal: Fast Playwright Tests Without Firebase Dependencies

**What we want to achieve**: Enable fast, isolated Playwright component tests that run in milliseconds without requiring Firebase emulator startup, network calls, or complex authentication flows.

**Current problem**: The application has a mix of dependency injection (AuthStore uses injected services) and direct Firebase usage (many components import `firebaseService` directly). This partial implementation prevents proper mocking in tests.

**Target outcome**: Component tests that:
- Mount and test UI components directly (no auth redirects)
- Run in under 100ms each (no emulator startup delay)
- Test UI behavior, validation, user interactions in isolation
- Don't require external services or network connectivity
- Can simulate any authentication state (logged in, logged out, different users)
- Can mock all Firebase services including Firestore real-time listeners

## 1. The Core Problem: Mixed Service Access Patterns

The application currently has THREE different patterns for accessing Firebase:

### 1.1. Direct Firebase Service Import (Most Common)
```typescript
// Many files do this:
import { firebaseService, getDb } from '@/app/firebase';

// Examples:
- user-notification-detector.ts: uses getDb() directly
- comments-store.ts: uses getDb() directly ⚠️ (Currently being refactored)
- groups-store-enhanced.ts: uses UserNotificationDetector which uses getDb()
```

### 1.2. Dependency Injection (Partially Implemented)
```typescript
// AuthStore does this correctly:
class AuthStoreImpl {
    constructor(firebaseService: IFirebaseService) { ... }
}

// ServiceFactory creates the right service:
ServiceFactory.createServices() // Returns test or prod services based on config
```

### 1.3. Direct Firebase SDK Usage
```typescript
// Some stores use Firebase SDK functions directly:
import { collection, onSnapshot } from 'firebase/firestore';
const db = getDb(); // Gets Firestore instance
onSnapshot(collection(db, 'groups'), ...);
```

## 2. Why Current Approach Fails

When we set `window.__TEST_CONFIG__` in tests:
1. ✅ ServiceFactory detects it and creates TestFirebaseService
2. ✅ AuthStore receives and uses TestFirebaseService
3. ✅ Authentication mocking works
4. ❌ BUT: `groups-store-enhanced` calls `UserNotificationDetector`
5. ❌ `UserNotificationDetector` calls `getDb()`
6. ❌ `getDb()` calls `firebaseService.getFirestore()`
7. ❌ `firebaseService` is the REAL singleton, not the test one
8. 💥 Error: "Firebase not initialized - call initialize() first"

## 3. The Complete Solution: Global Service Override

### 3.1. Strategy Overview

Instead of trying to inject services everywhere (which would require refactoring 50+ files), we make the singleton `firebaseService` itself swappable at runtime.

### 3.2. Implementation Plan

#### Phase 1: Make Firebase Service Swappable

**File: `webapp-v2/src/app/firebase.ts`**

Change from:
```typescript
export const firebaseService = new FirebaseService();
```

To:
```typescript
class FirebaseService {
    private static productionInstance: FirebaseService;

    static getInstance(): FirebaseService {
        // Check for test override first
        if (typeof window !== 'undefined' && (window as any).__FIREBASE_SERVICE_OVERRIDE__) {
            return (window as any).__FIREBASE_SERVICE_OVERRIDE__;
        }

        // Return production singleton
        if (!FirebaseService.productionInstance) {
            FirebaseService.productionInstance = new FirebaseService();
        }
        return FirebaseService.productionInstance;
    }

    // Add static method to reset for tests
    static resetInstance(): void {
        FirebaseService.productionInstance = null;
        if (typeof window !== 'undefined') {
            delete (window as any).__FIREBASE_SERVICE_OVERRIDE__;
        }
    }
}

// Export a dynamic reference that checks for overrides
export const firebaseService = {
    get current() {
        return FirebaseService.getInstance();
    },

    // Delegate all methods to current instance
    initialize: () => FirebaseService.getInstance().initialize(),
    getAuth: () => FirebaseService.getInstance().getAuth(),
    getFirestore: () => FirebaseService.getInstance().getFirestore(),
    onAuthStateChanged: (cb) => FirebaseService.getInstance().onAuthStateChanged(cb),
    signInWithEmailAndPassword: (e, p) => FirebaseService.getInstance().signInWithEmailAndPassword(e, p),
    signOut: () => FirebaseService.getInstance().signOut(),
    sendPasswordResetEmail: (e) => FirebaseService.getInstance().sendPasswordResetEmail(e)
};

// getDb also uses the dynamic instance
export const getDb = () => firebaseService.getFirestore();
```

#### Phase 2: Create Complete Mock Firebase Service

**File: `webapp-v2/src/__tests__/utils/mock-firebase-service.ts`**

```typescript
export interface MockFirestoreDocument {
    id: string;
    data: () => any;
}

export interface MockFirestoreSnapshot {
    docs: MockFirestoreDocument[];
    empty: boolean;
    size: number;
}

export class MockFirebaseService {
    private mockUser: any;
    private mockCollections: Map<string, MockFirestoreDocument[]> = new Map();
    private listeners: Map<string, Set<(snapshot: MockFirestoreSnapshot) => void>> = new Map();

    constructor(config: {
        user?: any;
        collections?: Record<string, any[]>;
    }) {
        this.mockUser = config.user || null;

        // Initialize mock collections
        if (config.collections) {
            for (const [name, docs] of Object.entries(config.collections)) {
                this.mockCollections.set(name, docs.map(doc => ({
                    id: doc.id || `${name}-${Date.now()}`,
                    data: () => doc
                })));
            }
        }

        // Mark as initialized
        this.initialized = true;
    }

    initialized = false;
    app = { name: 'mock-app' };

    auth = {
        currentUser: null as any,
        onAuthStateChanged: (callback: (user: any) => void) => {
            // Call immediately with current user
            setTimeout(() => callback(this.mockUser), 0);
            // Return unsubscribe function
            return () => {};
        }
    };

    firestore = {
        collection: (name: string) => {
            return {
                where: () => ({
                    onSnapshot: (callback: (snapshot: MockFirestoreSnapshot) => void) => {
                        const docs = this.mockCollections.get(name) || [];
                        const snapshot = {
                            docs,
                            empty: docs.length === 0,
                            size: docs.length
                        };

                        // Call immediately
                        setTimeout(() => callback(snapshot), 0);

                        // Store listener for updates
                        if (!this.listeners.has(name)) {
                            this.listeners.set(name, new Set());
                        }
                        this.listeners.get(name)!.add(callback);

                        // Return unsubscribe
                        return () => {
                            this.listeners.get(name)?.delete(callback);
                        };
                    }
                }),

                onSnapshot: (callback: (snapshot: MockFirestoreSnapshot) => void) => {
                    // Same as where().onSnapshot for simplicity
                    const docs = this.mockCollections.get(name) || [];
                    const snapshot = {
                        docs,
                        empty: docs.length === 0,
                        size: docs.length
                    };

                    setTimeout(() => callback(snapshot), 0);

                    if (!this.listeners.has(name)) {
                        this.listeners.set(name, new Set());
                    }
                    this.listeners.get(name)!.add(callback);

                    return () => {
                        this.listeners.get(name)?.delete(callback);
                    };
                },

                doc: (id: string) => ({
                    get: async () => {
                        const docs = this.mockCollections.get(name) || [];
                        const doc = docs.find(d => d.id === id);
                        return {
                            exists: () => !!doc,
                            data: doc ? doc.data : () => undefined,
                            id: doc?.id
                        };
                    },
                    onSnapshot: (callback: (doc: any) => void) => {
                        const docs = this.mockCollections.get(name) || [];
                        const doc = docs.find(d => d.id === id);
                        setTimeout(() => callback({
                            exists: () => !!doc,
                            data: doc ? doc.data : () => undefined,
                            id: doc?.id
                        }), 0);
                        return () => {};
                    }
                })
            };
        }
    };

    // Main service methods
    async initialize(): Promise<void> {
        // Already initialized in constructor
    }

    getAuth() {
        this.auth.currentUser = this.mockUser;
        return this.auth;
    }

    getFirestore() {
        return this.firestore;
    }

    onAuthStateChanged(callback: (user: any) => void) {
        return this.auth.onAuthStateChanged(callback);
    }

    async signInWithEmailAndPassword(email: string, password: string) {
        return { user: this.mockUser, operationType: 'signIn' };
    }

    async signOut() {
        this.mockUser = null;
        this.auth.currentUser = null;
    }

    async sendPasswordResetEmail(email: string) {
        // Mock success
    }

    // Test utilities
    updateCollection(name: string, docs: any[]) {
        this.mockCollections.set(name, docs.map(doc => ({
            id: doc.id || `${name}-${Date.now()}`,
            data: () => doc
        })));

        // Notify listeners
        const listeners = this.listeners.get(name);
        if (listeners) {
            const snapshot = {
                docs: this.mockCollections.get(name)!,
                empty: this.mockCollections.get(name)!.length === 0,
                size: this.mockCollections.get(name)!.length
            };
            listeners.forEach(listener => listener(snapshot));
        }
    }
}
```

#### Phase 3: Update ServiceFactory to Detect Override

**File: `webapp-v2/src/app/services/ServiceFactory.ts`**

```typescript
static createServices(config?: ServiceFactoryConfig): Services {
    // Check for test override or test config
    const hasFirebaseOverride = typeof window !== 'undefined' &&
        ((window as any).__FIREBASE_SERVICE_OVERRIDE__ || (window as any).__TEST_CONFIG__);

    const browserTestConfig = typeof window !== 'undefined' ? (window as any).__TEST_CONFIG__ : null;
    const testConfig = config?.testConfig || browserTestConfig;

    if (testConfig || hasFirebaseOverride) {
        // Test mode - create test services
        return {
            firebaseService: new TestFirebaseService(testConfig?.auth || {}),
            httpTransport: new TestHttpTransport(testConfig?.api || {}),
        };
    }

    // Production mode
    if (!this.productionServices) {
        this.productionServices = {
            firebaseService: new ProductionFirebaseService(),
            httpTransport: new ProductionHttpTransport(),
        };
    }

    return this.productionServices;
}
```

#### Phase 4: Create Test Helper for Playwright

**File: `webapp-v2/src/__tests__/utils/playwright-firebase-mock.ts`**

```typescript
export function setupFirebaseMock(config: {
    user?: any;
    groups?: any[];
    expenses?: any[];
    comments?: any[];
}) {
    return `
        // Create complete mock Firebase service
        const MockFirebaseService = ${MockFirebaseService.toString()};

        const mockUser = ${JSON.stringify(config.user || {
            uid: 'test-user-123',
            email: 'test@example.com',
            displayName: 'Test User',
            emailVerified: true,
            photoURL: null
        })};

        // Add functions that can't be serialized
        mockUser.getIdToken = async () => 'mock-id-token';
        mockUser.getIdTokenResult = async () => ({
            token: 'mock-id-token',
            authTime: new Date().toISOString(),
            issuedAtTime: new Date().toISOString(),
            expirationTime: new Date(Date.now() + 3600000).toISOString(),
            signInProvider: 'password',
            claims: {},
            signInSecondFactor: null
        });
        mockUser.reload = async () => {};
        mockUser.delete = async () => {};
        mockUser.toJSON = () => ({});

        const collections = {
            groups: ${JSON.stringify(config.groups || [])},
            expenses: ${JSON.stringify(config.expenses || [])},
            comments: ${JSON.stringify(config.comments || [])}
        };

        // Create and set the mock service
        const mockService = new MockFirebaseService({
            user: mockUser,
            collections
        });

        // Override the global service
        window.__FIREBASE_SERVICE_OVERRIDE__ = mockService;

        // Also set test config for ServiceFactory
        window.__TEST_CONFIG__ = {
            auth: { mockUser },
            api: { baseURL: window.location.origin }
        };

        // Store reference for test manipulation
        window.__MOCK_FIREBASE__ = mockService;
    `;
}
```

#### Phase 5: Write the Correct Test

**File: `webapp-v2/src/__tests__/unit/playwright/dashboard-secured-page.test.tsx`**

```typescript
import { test, expect } from '@playwright/test';
import { setupFirebaseMock } from '../../utils/playwright-firebase-mock';
import { generateShortId } from '@splitifyd/test-support';
import { USER_ID_KEY } from '@/constants';

test('dashboard shows real-time group updates', async ({ page }) => {
  // Create test data
  const initialGroup = {
    id: `group-${generateShortId()}`,
    name: 'Weekend Trip',
    description: 'Trip to the mountains',
    securityPreset: 'open',
    permissions: {
      expenseEditing: 'anyone',
      expenseDeletion: 'owner-and-admin',
      memberInvitation: 'anyone',
      memberApproval: 'automatic',
      settingsManagement: 'admin-only',
    },
    createdBy: 'test-user-123',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    balance: { balancesByCurrency: {} },
    lastActivity: 'just now',
    lastActivityRaw: new Date().toISOString(),
  };

  const updatedGroup = {
    ...initialGroup,
    name: 'Epic Mountain Adventure',
    description: 'Amazing trip to the mountains'
  };

  // Set up Firebase mock BEFORE page loads
  await page.addInitScript(setupFirebaseMock({
    user: {
      uid: 'test-user-123',
      email: 'test@example.com',
      displayName: 'Test User'
    },
    groups: [initialGroup]
  }));

  // Set localStorage for user ID
  await page.addInitScript((userIdKey) => {
    localStorage.setItem(userIdKey, 'test-user-123');
  }, USER_ID_KEY);

  // Set up API mocks for any HTTP calls
  await page.route('/api/**', route => {
    const url = new URL(route.request().url());

    // Mock responses based on endpoint
    const responses = {
      '/api/auth': { user: { uid: 'test-user-123', email: 'test@example.com' }},
      '/api/config': { config: 'test' },
      '/api/groups': { groups: [initialGroup] },
      '/api/user/policies/status': { policies: [], requiresAcceptance: false }
    };

    const response = responses[url.pathname];
    if (response) {
      route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(response)
      });
    } else {
      // Fail unmocked requests
      route.abort('failed');
    }
  });

  // Navigate to dashboard
  await page.goto('/dashboard');

  // Verify initial group is visible
  await expect(page.getByText('Weekend Trip')).toBeVisible();

  // Update the group data via mock Firebase
  await page.evaluate((updatedGroup) => {
    // Access the mock service we stored
    const mockService = (window as any).__MOCK_FIREBASE__;
    mockService.updateCollection('groups', [updatedGroup]);
  }, updatedGroup);

  // Verify the update is reflected in the UI
  await expect(page.getByText('Epic Mountain Adventure')).toBeVisible();
  await expect(page.getByText('Weekend Trip')).not.toBeVisible();
});
```

## 4. Why This Is the Best Approach

### 4.1. Minimal Code Changes
- Only need to modify `firebase.ts` to make the service swappable
- All existing imports continue to work
- No need to refactor 50+ files

### 4.2. Complete Mocking Capability
- Can mock Auth, Firestore, and all Firebase services
- Can simulate real-time updates via `onSnapshot`
- Can test error conditions and edge cases

### 4.3. Test Isolation
- Each test gets its own mock instance
- No shared state between tests
- Fast execution (no network calls)

### 4.4. Type Safety
- Mock implements same interface as real service
- TypeScript ensures compatibility

## 5. Implementation Checklist

### Phase 1: Core Changes
- [ ] Modify `firebase.ts` to make service swappable via `getInstance()`
- [ ] Create `MockFirebaseService` class with complete Firestore mocking
- [ ] Update `ServiceFactory` to detect overrides

### Phase 2: Test Infrastructure
- [ ] Create `setupFirebaseMock()` helper function
- [ ] Write example test showing real-time updates
- [ ] Add utilities for common test scenarios

### Phase 3: Validation
- [ ] Verify all existing tests still pass
- [ ] Ensure production build works unchanged
- [ ] Test that mocking works for all Firebase operations

## 6. Known Limitations and Solutions

### 6.1. Firestore Query Complexity
The mock doesn't support complex Firestore queries (compound where clauses, orderBy, etc).
**Solution**: Extend mock as needed for specific test cases.

### 6.2. Firebase Functions
The mock doesn't include Firebase Functions (callable functions).
**Solution**: Mock at the HTTP level for Functions calls.

### 6.3. Firebase Storage
Not included in initial mock.
**Solution**: Add mock storage methods if needed for file upload tests.

## 7. Alternative Approaches (Not Recommended)

### 7.1. Full Dependency Injection (Architecturally Pure but Impractical)
- Pass services through React Context everywhere
- Update ALL components and stores to accept injected services
- Never import Firebase directly
- **Problem**: Requires refactoring 50+ files

### 7.2. Mock at Firebase SDK Level (Complex)
- Mock the actual Firebase SDK modules
- Use module mocking or webpack aliases
- **Problem**: Complex setup, brittle, version-dependent

### 7.3. Use Firebase Emulator (Current Approach)
- Run real Firebase emulator for tests
- **Problem**: Slow (2-3 second startup), requires external process

## 8. Success Criteria

Tests using this approach should:
- ✅ Run in under 100ms
- ✅ Not require Firebase emulator
- ✅ Support all Firebase operations (auth, firestore, real-time)
- ✅ Allow testing of real-time updates
- ✅ Provide complete control over data and state
- ✅ Work with existing codebase without major refactoring

## 9. Migration Path

1. **Start Fresh**: Revert all current changes
2. **Implement Core**: Modify only `firebase.ts` first
3. **Add Mock**: Create `MockFirebaseService`
4. **Test One Component**: Get dashboard test working
5. **Expand**: Add more mock capabilities as needed
6. **Document**: Create examples for common scenarios

This approach provides the best balance of:
- Minimal code changes
- Maximum testing capability
- Fast test execution
- Maintainability

---

## 10. Related Progress: Comments Store Refactoring

**Status: In Progress** - Working on removing Firebase dependencies from `comments-store.ts`

### 10.1. Current Work: Comment Notification System
**Goal**: Replace direct Firebase access in `comments-store.ts` with API-based data fetching and notification-driven updates.

**Phase 1 Complete**: Backend comment notification infrastructure ✅
- Extended user notification schema with comment tracking fields
- Added comment change triggers for group and expense comments
- Comprehensive test coverage for comment notifications
- Backend ready for real-time comment change notifications

**Next Phases**:
- Add GET comment API endpoints
- Update frontend notification detector for comment events
- Refactor comments store to use API + notifications instead of direct Firebase
- Remove all Firebase imports from comments store

### 10.2. Architecture Impact
This refactoring directly supports the Firebase decoupling goal:

**Before**: `comments-store.ts` → `getDb()` → Direct Firebase access
**After**: `comments-store.ts` → `apiClient` + `UserNotificationDetector` → No direct Firebase

Once complete, comments-store will follow the same patterns as other stores and be fully mockable for component testing.

### 10.3. Remaining Firebase Dependencies
After comments store refactoring, the remaining direct Firebase usage will be:
- `user-notification-detector.ts` (core notification system)
- `groups-store-enhanced.ts` (uses UserNotificationDetector)
- Various utility functions

The notification system refactoring reduces Firebase dependencies from **3 major stores** to **1 core service**, making the overall Firebase decoupling task more focused and manageable.