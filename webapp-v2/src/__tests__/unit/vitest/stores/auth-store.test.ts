import { getAuthStore } from '@/app/stores/auth-store';
import { toEmail } from '@billsplit-wl/shared';
import { describe, expect, it, vi } from 'vitest';

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

vi.mock('@/app/gateways/auth-gateway', () => ({
    getDefaultAuthGateway: vi.fn(() => mockAuthGateway),
}));

vi.mock('@/app/apiClient', () => ({
    apiClient: {
        setAuthCallbacks: vi.fn(),
        setAuthToken: vi.fn(),
        register: vi.fn(),
        getUserProfile: vi.fn(),
    },
}));

vi.mock('@/app/stores/theme-store', () => ({
    themeStore: {
        updateCurrentUserTheme: vi.fn(),
        reset: vi.fn(),
    },
}));

vi.mock('@/app/stores/groups-store-enhanced', () => ({
    enhancedGroupsStore: {
        reset: vi.fn(),
    },
}));

vi.mock('@/app/stores/group-detail-store-enhanced', () => ({
    enhancedGroupDetailStore: {
        reset: vi.fn(),
    },
}));

vi.mock('@/app/stores/expense-form-store', () => ({
    expenseFormStore: {
        setStorage: vi.fn(),
        clearStorage: vi.fn(),
    },
}));

const currencyServiceInstance = {
    setStorage: vi.fn(),
    clearStorage: vi.fn(),
};

vi.mock('@/app/services/currencyService', () => ({
    CurrencyService: {
        getInstance: () => currencyServiceInstance,
    },
}));

async function setupAuthStore() {
    const store = await getAuthStore();

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

        await store.login(toEmail('user@example.com'), 'password123');

        expect(mocks.setPersistenceMock).toHaveBeenCalledWith('local');
        expect(mocks.signInWithEmailAndPasswordMock).toHaveBeenCalledWith('user@example.com', 'password123');
    });

    it('uses session persistence when rememberMe is false', async () => {
        const { store, mocks } = await setupAuthStore();

        await store.login(toEmail('user@example.com'), 'password123', false);

        expect(mocks.setPersistenceMock).toHaveBeenCalledWith('session');
        expect(mocks.signInWithEmailAndPasswordMock).toHaveBeenCalled();
    });
});
