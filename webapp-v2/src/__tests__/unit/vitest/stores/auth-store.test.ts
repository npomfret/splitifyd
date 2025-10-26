import { describe, expect, it, vi } from 'vitest';

async function setupAuthStore() {
    vi.resetModules();

    const setPersistenceMock = vi.fn().mockResolvedValue(undefined);
    const signInWithEmailAndPasswordMock = vi.fn().mockResolvedValue(undefined);
    const onAuthStateChangedMock = vi.fn().mockReturnValue(() => {});

    const mockAuthGateway = {
        connect: vi.fn().mockResolvedValue(undefined),
        onAuthStateChanged: onAuthStateChangedMock,
        setPersistence: setPersistenceMock,
        signInWithEmailAndPassword: signInWithEmailAndPasswordMock,
        sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
        signOut: vi.fn().mockResolvedValue(undefined),
        performTokenRefresh: vi.fn().mockResolvedValue('mock-token'),
        performUserRefresh: vi.fn().mockResolvedValue(undefined),
    };

    vi.doMock('@/app/gateways/auth-gateway', () => ({
        getDefaultAuthGateway: vi.fn(() => mockAuthGateway),
    }));

    vi.doMock('@/app/apiClient', () => ({
        apiClient: {
            setAuthCallbacks: vi.fn(),
            setAuthToken: vi.fn(),
            register: vi.fn(),
            getUserProfile: vi.fn(),
        },
    }));

    vi.doMock('@/app/stores/theme-store', () => ({
        themeStore: {
            updateCurrentUserTheme: vi.fn(),
            reset: vi.fn(),
        },
    }));

    vi.doMock('@/app/stores/groups-store-enhanced', () => ({
        enhancedGroupsStore: {
            reset: vi.fn(),
        },
    }));

    vi.doMock('@/app/stores/group-detail-store-enhanced', () => ({
        enhancedGroupDetailStore: {
            reset: vi.fn(),
        },
    }));

    vi.doMock('@/app/stores/expense-form-store', () => ({
        expenseFormStore: {
            setStorage: vi.fn(),
            clearStorage: vi.fn(),
        },
    }));

    const currencyServiceInstance = {
        setStorage: vi.fn(),
        clearStorage: vi.fn(),
    };

    vi.doMock('@/app/services/currencyService', () => ({
        CurrencyService: {
            getInstance: () => currencyServiceInstance,
        },
    }));

    const authStoreModule = await import('@/app/stores/auth-store');
    const store = await authStoreModule.getAuthStore();

    return {
        store,
        mocks: {
            setPersistenceMock,
            signInWithEmailAndPasswordMock,
            onAuthStateChangedMock,
        },
    };
}

describe('AuthStore.login', () => {
    it('uses local persistence by default', async () => {
        const { store, mocks } = await setupAuthStore();

        await store.login('user@example.com', 'password123');

        expect(mocks.setPersistenceMock).toHaveBeenCalledWith('local');
        expect(mocks.signInWithEmailAndPasswordMock).toHaveBeenCalledWith('user@example.com', 'password123');
    });

    it('uses session persistence when rememberMe is false', async () => {
        const { store, mocks } = await setupAuthStore();

        await store.login('user@example.com', 'password123', false);

        expect(mocks.setPersistenceMock).toHaveBeenCalledWith('session');
        expect(mocks.signInWithEmailAndPasswordMock).toHaveBeenCalled();
    });
});
