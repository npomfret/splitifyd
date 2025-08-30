/**
 * Setup file for Playwright unit tests with mocked backend
 * This intercepts API calls and provides mock responses
 */

import { Page } from '@playwright/test';
import type { AppConfiguration } from '@splitifyd/shared';

export interface MockUser {
    uid: string;
    email: string;
    displayName: string;
    photoURL?: string;
}

export interface MockGroup {
    id: string;
    name: string;
    description?: string;
    members: { [userId: string]: any };
    balance?: any;
    createdAt: string;
    updatedAt: string;
    createdBy: string;
}

export const mockFirebaseConfig: AppConfiguration = {
    firebase: {
        apiKey: 'mock-api-key',
        authDomain: 'mock.firebaseapp.com',
        projectId: 'mock-project',
        storageBucket: 'mock.appspot.com',
        messagingSenderId: '123456789',
        appId: '1:123456789:web:mock',
    },
    firebaseAuthUrl: 'http://mock-firebase-auth',
    firebaseFirestoreUrl: 'http://mock-firebase-firestore',
    environment: {},
    formDefaults: {},
};

export async function setupMocks(page: Page) {
    // Mock the config API endpoint that the app fetches during initialization
    await page.route('**/api/config', route => route.fulfill({ 
        status: 200, 
        contentType: 'application/json',
        body: JSON.stringify(mockFirebaseConfig)
    }));
    
    // Mock Firebase network requests to prevent actual Firebase initialization
    await page.route('**/*firebaseapp.com/**', route => route.fulfill({ status: 200, body: '{}' }));
    await page.route('**/*firebase.googleapis.com/**', route => route.fulfill({ status: 200, body: '{}' }));
    await page.route('**/*identitytoolkit.googleapis.com/**', route => route.fulfill({ status: 200, body: '{}' }));
    await page.route('**/*firestore.googleapis.com/**', route => route.fulfill({ status: 200, body: '{}' }));
    
    // Simple but comprehensive Firebase mocking
    await page.addInitScript(() => {
        // Create mock objects that match the Firebase interface
        const mockUser = {
            uid: 'mock-user-id',
            email: 'mock@example.com',
            displayName: 'Mock User',
            emailVerified: true,
            isAnonymous: false,
            metadata: { creationTime: new Date().toISOString(), lastSignInTime: new Date().toISOString() },
            photoURL: null,
            providerData: [],
            refreshToken: 'mock-refresh-token',
            tenantId: null,
            delete: () => Promise.resolve(),
            getIdToken: (_forceRefresh?: boolean) => Promise.resolve('mock-id-token'),
            getIdTokenResult: (_forceRefresh?: boolean) => Promise.resolve({ token: 'mock-id-token', claims: {}, authTime: '', expirationTime: '', issuedAtTime: '', signInProvider: 'mock', signInSecondFactor: null }),
            reload: () => Promise.resolve(),
            toJSON: () => ({ uid: 'mock-user-id', email: 'mock@example.com' }),
        };

        const mockAuth = {
            app: { name: '[DEFAULT]', options: {} },
            currentUser: null,
            languageCode: null,
            settings: { appVerificationDisabledForTesting: false },
            tenantId: null,
            onAuthStateChanged: (callback: any) => {
                setTimeout(() => callback(null), 0); // Async callback
                return () => {}; // unsubscribe
            },
            onIdTokenChanged: (callback: any) => {
                setTimeout(() => callback(null), 0);
                return () => {};
            },
            signInWithEmailAndPassword: (_email: string, _password: string) => 
                Promise.resolve({ user: mockUser, operationType: 'signIn', providerId: null, additionalUserInfo: null }),
            signOut: () => Promise.resolve(),
            sendPasswordResetEmail: (_email: string) => Promise.resolve(),
        };

        const mockApp = {
            name: '[DEFAULT]',
            options: {
                apiKey: 'mock-api-key',
                authDomain: 'mock.firebaseapp.com',
                projectId: 'mock-project',
                storageBucket: 'mock.appspot.com',
                messagingSenderId: '123456789',
                appId: '1:123456789:web:mock'
            },
            automaticDataCollectionEnabled: false,
            delete: () => Promise.resolve(),
        };

        const mockFirestore = {
            app: mockApp,
            type: 'firestore-lite',
            collection: (path: string) => ({
                id: path,
                path: path,
                parent: null,
                firestore: mockFirestore,
                doc: (docPath?: string) => ({
                    id: docPath || 'mock-doc',
                    path: `${path}/${docPath || 'mock-doc'}`,
                    parent: null,
                    firestore: mockFirestore,
                    get: () => Promise.resolve({ 
                        id: docPath || 'mock-doc',
                        exists: false, 
                        data: () => undefined,
                        get: () => undefined,
                        ref: {},
                    }),
                    set: () => Promise.resolve(),
                    update: () => Promise.resolve(),
                    delete: () => Promise.resolve(),
                }),
                add: (_data: any) => Promise.resolve({ 
                    id: 'mock-doc-id', 
                    path: `${path}/mock-doc-id`,
                    parent: null,
                    firestore: mockFirestore 
                }),
                get: () => Promise.resolve({ 
                    docs: [], 
                    empty: true, 
                    size: 0,
                    forEach: () => {},
                    query: null,
                }),
            }),
        };

        // Set up global Firebase functions
        (window as any).initializeApp = (config: any) => {
            mockApp.options = { ...mockApp.options, ...config };
            return mockApp;
        };
        (window as any).getAuth = (_app?: any) => mockAuth;
        (window as any).getFirestore = (_app?: any) => mockFirestore;
        (window as any).connectAuthEmulator = (_auth: any, url: string, _options?: any) => {
            console.log('Mock: Connected to auth emulator at', url);
        };
        (window as any).connectFirestoreEmulator = (_firestore: any, host: string, port: number) => {
            console.log('Mock: Connected to firestore emulator at', host, port);
        };
        (window as any).signInWithEmailAndPassword = mockAuth.signInWithEmailAndPassword;
        (window as any).signOut = mockAuth.signOut;
        (window as any).sendPasswordResetEmail = mockAuth.sendPasswordResetEmail;
        (window as any).onAuthStateChanged = mockAuth.onAuthStateChanged;

        // Mock the Firebase namespace/modules
        (window as any).firebase = {
            apps: [mockApp],
            initializeApp: (window as any).initializeApp,
            app: (_name?: string) => mockApp,
            auth: () => mockAuth,
            firestore: () => mockFirestore,
        };

        // Mock common global access patterns
        (window as any).__FIREBASE_DEFAULTS__ = {
            config: mockApp.options
        };

        console.log('Firebase mocking initialized for tests');
    });

    // Mock ES6 module imports at the browser level
    await page.addInitScript(() => {
        // Intercept dynamic imports for Firebase modules
        
        // Override System.js if present (used by some bundlers)
        if ((window as any).System) {
            const originalImport = (window as any).System.import;
            (window as any).System.import = function(name: string) {
                if (name.includes('firebase/app')) {
                    return Promise.resolve({
                        initializeApp: (window as any).initializeApp,
                        FirebaseApp: function() {}
                    });
                }
                if (name.includes('firebase/auth')) {
                    return Promise.resolve({
                        getAuth: (window as any).getAuth,
                        connectAuthEmulator: (window as any).connectAuthEmulator,
                        signInWithEmailAndPassword: (window as any).signInWithEmailAndPassword,
                        signOut: (window as any).signOut,
                        sendPasswordResetEmail: (window as any).sendPasswordResetEmail,
                        onAuthStateChanged: (window as any).onAuthStateChanged,
                        Auth: function() {},
                        User: function() {}
                    });
                }
                if (name.includes('firebase/firestore')) {
                    return Promise.resolve({
                        getFirestore: (window as any).getFirestore,
                        connectFirestoreEmulator: (window as any).connectFirestoreEmulator,
                        Firestore: function() {}
                    });
                }
                return originalImport.call(this, name);
            };
        }

        // Mock CommonJS require if present
        if ((window as any).require) {
            const originalRequire = (window as any).require;
            (window as any).require = function(name: string) {
                if (name.includes('firebase')) {
                    return {
                        initializeApp: (window as any).initializeApp,
                        getAuth: (window as any).getAuth,
                        getFirestore: (window as any).getFirestore,
                        connectAuthEmulator: (window as any).connectAuthEmulator,
                        connectFirestoreEmulator: (window as any).connectFirestoreEmulator,
                        signInWithEmailAndPassword: (window as any).signInWithEmailAndPassword,
                        signOut: (window as any).signOut,
                        sendPasswordResetEmail: (window as any).sendPasswordResetEmail,
                        onAuthStateChanged: (window as any).onAuthStateChanged,
                    };
                }
                return originalRequire.call(this, name);
            };
        }

        // Mock Webpack's __webpack_require__ if present
        if ((window as any).__webpack_require__) {
            const originalWebpackRequire = (window as any).__webpack_require__;
            (window as any).__webpack_require__ = function(moduleId: any) {
                // Check if this is a Firebase module by inspecting the module id
                const result = originalWebpackRequire.call(this, moduleId);
                
                // If this looks like a Firebase module, replace its exports
                if (result && typeof result === 'object' && 
                    (result.initializeApp || result.getAuth || result.getFirestore)) {
                    return {
                        ...result,
                        initializeApp: (window as any).initializeApp,
                        getAuth: (window as any).getAuth,
                        getFirestore: (window as any).getFirestore,
                        connectAuthEmulator: (window as any).connectAuthEmulator,
                        connectFirestoreEmulator: (window as any).connectFirestoreEmulator,
                        signInWithEmailAndPassword: (window as any).signInWithEmailAndPassword,
                        signOut: (window as any).signOut,
                        sendPasswordResetEmail: (window as any).sendPasswordResetEmail,
                        onAuthStateChanged: (window as any).onAuthStateChanged,
                    };
                }
                return result;
            };
        }
    });

    // Mock API base URL function
    await page.addInitScript(() => {
        (window as any).getApiBaseUrl = () => 'http://localhost:5173/api';
    });
}

export async function waitForApp(page: Page) {
    // Wait for the app to be ready (React/Preact rendered)
    // First ensure the app container exists
    await page.waitForSelector('#app', {
        timeout: 10000,
        state: 'attached',
    });
    
    // Wait for any content to appear in the app or for a reasonable timeout
    try {
        await page.waitForSelector('#app > *', {
            timeout: 5000,
            state: 'attached',
        });
    } catch (error) {
        // If app content doesn't load, continue - test might be checking error state
        console.warn('App content not loaded, continuing anyway');
    }
}

/**
 * Clear all authentication state for test cleanup
 */
export async function clearAuthState(page: Page) {
    try {
        // Clear localStorage and sessionStorage only if we're on a page that allows it
        await page.evaluate(() => {
            if (typeof Storage !== "undefined") {
                localStorage.clear();
                sessionStorage.clear();
            }
        });
    } catch (error: any) {
        // Only suppress localStorage access errors when on about:blank page
        const currentUrl = page.url();
        if (currentUrl !== 'about:blank') {
            throw error;
        }
        // Otherwise silently ignore - about:blank doesn't allow localStorage access
    }
    
    // Clear cookies
    await page.context().clearCookies();
}

/**
 * Setup test with proper cleanup for isolation
 */
export async function setupTestIsolation(page: Page) {
    // Clear any existing state first
    await clearAuthState(page);
    
    // Setup basic mocks
    await setupMocks(page);
}

export async function mockAuthenticatedUser(page: Page) {
    // Mock an authenticated user for tests that need auth
    await page.route('**/identitytoolkit.googleapis.com/**', async (route) => {
        const url = route.request().url();

        if (url.includes('accounts:lookup')) {
            // Mock user lookup (for auth state check)
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    users: [{
                        localId: 'auth-user-id',
                        email: 'authuser@example.com',
                        displayName: 'Auth User',
                        emailVerified: true,
                    }]
                }),
            });
        } else if (url.includes('accounts:signInWithPassword')) {
            // Mock successful sign in
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    idToken: 'mock-auth-token',
                    email: 'authuser@example.com',
                    displayName: 'Auth User',
                    refreshToken: 'mock-refresh-token',
                    expiresIn: '3600',
                    localId: 'auth-user-id',
                }),
            });
        } else {
            // Default successful response
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({}),
            });
        }
    });

    // Mock authenticated API calls to our backend
    await page.route('**/api/**', async (route) => {
        const url = route.request().url();
        
        if (url.includes('/api/groups')) {
            // Mock groups API
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    groups: [],
                    count: 0,
                    hasMore: false,
                }),
            });
        } else {
            // Default success response
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ success: true }),
            });
        }
    });

    // Set up authenticated state in localStorage
    await page.addInitScript(() => {
        localStorage.setItem('firebase:authUser:test-api-key:[DEFAULT]', JSON.stringify({
            uid: 'auth-user-id',
            email: 'authuser@example.com',
            displayName: 'Auth User',
            stsTokenManager: {
                accessToken: 'mock-auth-token',
                refreshToken: 'mock-refresh-token',
                expirationTime: Date.now() + 3600000,
            }
        }));
    });
}
