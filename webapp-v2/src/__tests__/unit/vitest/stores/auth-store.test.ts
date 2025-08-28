import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getAuthStore, createAuthStore } from '@/app/stores/auth-store.ts';
import type { AuthStore } from '@/types/auth.ts';

// Mock Firebase service with proper hoisting
vi.mock('../../../app/firebase', () => ({
    firebaseService: {
        initialize: vi.fn().mockResolvedValue(undefined),
        onAuthStateChanged: vi.fn().mockImplementation((callback) => {
            // Immediately call with null to simulate no user initially
            callback(null);
        }),
        signInWithEmailAndPassword: vi.fn().mockResolvedValue({
            user: {
                uid: 'test-user-id',
                email: 'test@example.com',
                displayName: 'Test User',
                getIdToken: vi.fn().mockResolvedValue('mock-token'),
            },
        }),
        signOut: vi.fn().mockResolvedValue(undefined),
        sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
    },
}));

// Mock API client
vi.mock('../../../app/apiClient', () => ({
    apiClient: {
        register: vi.fn().mockResolvedValue(undefined),
        setAuthToken: vi.fn(),
    },
}));

// Mock error logger
vi.mock('../../../utils/error-logger', () => ({
    logError: vi.fn(),
}));

// Mock mapFirebaseUser
vi.mock('../../../types/auth', async () => {
    const actual = await vi.importActual('../../../types/auth');
    return {
        ...actual,
        mapFirebaseUser: vi.fn().mockImplementation((user) => ({
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
        })),
    };
});

describe('AuthStore Factory Pattern', () => {
    let authStore: AuthStore;

    beforeEach(async () => {
        vi.clearAllMocks();
        // Create a fresh auth store for each test
        authStore = await createAuthStore();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('Factory Pattern', () => {
        it('should create auth store using factory method', async () => {
            const store = await createAuthStore();
            expect(store).toBeDefined();
            expect(store.user).toBe(null); // Initially no user
            expect(store.loading).toBe(false);
            expect(store.initialized).toBe(true); // Factory ensures initialization
        });

        it('should return same instance with getAuthStore singleton', async () => {
            const store1 = await getAuthStore();
            const store2 = await getAuthStore();
            expect(store1).toBe(store2);
        });
    });

    describe('Authentication State', () => {
        it('should start with no authenticated user', () => {
            expect(authStore.user).toBe(null);
            expect(authStore.loading).toBe(false);
            expect(authStore.error).toBe(null);
            expect(authStore.initialized).toBe(true);
        });

        it('should handle successful login', async () => {
            const email = 'test@example.com';
            const password = 'password';

            await authStore.login(email, password);

            expect(authStore.error).toBe(null);
            // User state will be updated by the auth state listener
        });


        it('should handle logout', async () => {
            await authStore.logout();
            expect(authStore.error).toBe(null);
        });

        it('should handle password reset', async () => {
            const email = 'test@example.com';
            await authStore.resetPassword(email);
            expect(authStore.error).toBe(null);
        });

        it('should clear errors', () => {
            // Simulate an error state
            authStore.login('invalid', 'invalid').catch(() => {});
            authStore.clearError();
            expect(authStore.error).toBe(null);
        });
    });


});
