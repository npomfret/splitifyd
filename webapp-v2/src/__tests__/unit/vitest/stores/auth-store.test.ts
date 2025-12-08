import { getAuthStore } from '@/app/stores/auth-store';
import { toEmail, toPassword } from '@billsplit-wl/shared';
import { describe, expect, it, vi } from 'vitest';

// Use vi.hoisted() so these mocks are available when vi.mock factories run
const {
    setPersistenceMock,
    signInWithCustomTokenMock,
    signInWithEmailAndPasswordMock,
    onAuthStateChangedMock,
    loginMock,
    sendPasswordResetEmailMock,
    mockAuthGateway,
    currencyServiceInstance,
} = vi.hoisted(() => {
    const setPersistenceMock = vi.fn().mockResolvedValue(undefined);
    const signInWithCustomTokenMock = vi.fn().mockResolvedValue(undefined);
    const signInWithEmailAndPasswordMock = vi.fn().mockResolvedValue(undefined);
    const onAuthStateChangedMock = vi.fn().mockReturnValue(() => {});
    const loginMock = vi.fn().mockResolvedValue({ success: true, customToken: 'mock-custom-token' });
    const sendPasswordResetEmailMock = vi.fn().mockResolvedValue(undefined);

    return {
        setPersistenceMock,
        signInWithCustomTokenMock,
        signInWithEmailAndPasswordMock,
        onAuthStateChangedMock,
        loginMock,
        sendPasswordResetEmailMock,
        mockAuthGateway: {
            connect: vi.fn().mockResolvedValue(undefined),
            onAuthStateChanged: onAuthStateChangedMock,
            setPersistence: setPersistenceMock,
            signInWithEmailAndPassword: signInWithEmailAndPasswordMock,
            signInWithCustomToken: signInWithCustomTokenMock,
            signOut: vi.fn().mockResolvedValue(undefined),
            performTokenRefresh: vi.fn().mockResolvedValue('mock-token'),
            performUserRefresh: vi.fn().mockResolvedValue(undefined),
        },
        currencyServiceInstance: {
            setStorage: vi.fn(),
            clearStorage: vi.fn(),
        },
    };
});

vi.mock('@/app/gateways/auth-gateway', () => ({
    getDefaultAuthGateway: vi.fn(() => mockAuthGateway),
}));

vi.mock('@/app/apiClient', () => ({
    apiClient: {
        setAuthCallbacks: vi.fn(),
        setAuthToken: vi.fn(),
        register: vi.fn(),
        getUserProfile: vi.fn(),
        login: loginMock,
        sendPasswordResetEmail: sendPasswordResetEmailMock,
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
            signInWithCustomTokenMock,
            signInWithEmailAndPasswordMock,
            onAuthStateChangedMock,
            loginMock,
            sendPasswordResetEmailMock,
        },
    };
}

describe('AuthStore.login', () => {
    it('uses local persistence by default and calls API login', async () => {
        const { store, mocks } = await setupAuthStore();

        await store.login(toEmail('user@example.com'), 'password123');

        expect(mocks.setPersistenceMock).toHaveBeenCalledWith('local');
        expect(mocks.loginMock).toHaveBeenCalledWith({
            email: 'user@example.com',
            password: toPassword('password123'),
        });
        expect(mocks.signInWithCustomTokenMock).toHaveBeenCalledWith('mock-custom-token');
    });

    it('uses session persistence when rememberMe is false', async () => {
        const { store, mocks } = await setupAuthStore();

        await store.login(toEmail('user@example.com'), 'password123', false);

        expect(mocks.setPersistenceMock).toHaveBeenCalledWith('session');
        expect(mocks.loginMock).toHaveBeenCalled();
        expect(mocks.signInWithCustomTokenMock).toHaveBeenCalledWith('mock-custom-token');
    });
});
