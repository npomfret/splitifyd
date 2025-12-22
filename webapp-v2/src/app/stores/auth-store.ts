import { USER_ID_KEY } from '@/constants.ts';
import i18n, { applyUserLanguagePreference } from '@/i18n';
import { logError } from '@/utils/browser-logger.ts';
import { translateFirebaseAuthError } from '@/utils/error-translation';
import { createUserScopedStorage } from '@/utils/userScopedStorage.ts';
import type { ClientUser, Email, Password, UserId } from '@billsplit-wl/shared';
import { AuthErrors, toPassword } from '@billsplit-wl/shared';
import { DisplayName } from '@billsplit-wl/shared';
import { ReadonlySignal, signal } from '@preact/signals';
import { apiClient } from '../apiClient';
import { type AuthGateway, getDefaultAuthGateway } from '../gateways/auth-gateway';
import { CurrencyService } from '../services/currencyService';
import { expenseFormStore } from './expense-form-store';
import { enhancedGroupDetailStore } from './group-detail-store-enhanced';
import { enhancedGroupsStore as groupsStore } from './groups-store-enhanced';
import { themeStore } from './theme-store';

// Auth types - moved from types/auth.ts
interface AuthState {
    user: ClientUser | null;
    loading: boolean;
    error: string | null;
    initialized: boolean;
    isUpdatingProfile?: boolean;
    isRefreshingToken: boolean;
}

interface AuthActions {
    login: (email: Email, password: Password, rememberMe?: boolean) => Promise<void>;
    register: (
        email: Email,
        password: Password,
        displayName: DisplayName,
        termsAccepted: boolean,
        cookiePolicyAccepted: boolean,
        privacyPolicyAccepted: boolean,
        adminEmailsAccepted: boolean,
        marketingEmailsAccepted: boolean,
    ) => Promise<void>;
    logout: () => Promise<void>;
    resetPassword: (email: Email) => Promise<void>;
    updateUserProfile: (updates: { displayName?: DisplayName; marketingEmailsAccepted?: boolean; }) => Promise<void>;
    changeEmail: (payload: { currentPassword: Password; newEmail: Email; }) => Promise<void>;
    clearError: () => void;
    refreshAuthToken: () => Promise<string>;
}

export interface AuthStore extends AuthState, AuthActions {
    loadingSignal: ReadonlySignal<boolean>;
    errorSignal: ReadonlySignal<string | null>;
    refreshingTokenSignal: ReadonlySignal<boolean>;
}

class PostRegistrationLoginError extends Error {
    constructor(
        public readonly originalError: unknown,
        public readonly userMessage: string,
    ) {
        super('PostRegistrationLoginError');
        this.name = 'PostRegistrationLoginError';
    }
}

class AuthStoreImpl implements AuthStore {
    // Private signals - encapsulated within the class
    readonly #userSignal = signal<ClientUser | null>(null);
    readonly #loadingSignal = signal<boolean>(true);
    readonly #errorSignal = signal<string | null>(null);
    readonly #initializedSignal = signal<boolean>(false);
    readonly #isUpdatingProfileSignal = signal<boolean>(false);
    readonly #isRefreshingTokenSignal = signal<boolean>(false);

    // Token refresh management
    private refreshPromise: Promise<string> | null = null;
    private refreshTimer: NodeJS.Timeout | null = null;
    private tokenExpiryTime: number | null = null;
    private visibilityListenersRegistered = false;
    private readonly handleVisibilityChange = () => {
        if (typeof document === 'undefined') {
            return;
        }
        if (document.visibilityState === 'visible') {
            void this.refreshAuthTokenIfNeeded();
        }
    };
    private readonly handleWindowFocus = () => {
        void this.refreshAuthTokenIfNeeded();
    };

    // User-scoped storage for preferences and auth data
    private userStorage = createUserScopedStorage(() => this.#userSignal.value?.uid || null);

    constructor(private readonly gateway: AuthGateway) {
        // Private constructor - use static create() method instead
    }

    // State getters - readonly values for external consumers
    get user() {
        return this.#userSignal.value;
    }
    get loading() {
        return this.#loadingSignal.value;
    }
    get error() {
        return this.#errorSignal.value;
    }
    get initialized() {
        return this.#initializedSignal.value;
    }
    get isUpdatingProfile() {
        return this.#isUpdatingProfileSignal.value;
    }
    get isRefreshingToken() {
        return this.#isRefreshingTokenSignal.value;
    }

    // Signal accessors for reactive components - return raw signals (components will wrap with useComputed)
    get loadingSignal(): ReadonlySignal<boolean> {
        return this.#loadingSignal;
    }
    get errorSignal(): ReadonlySignal<string | null> {
        return this.#errorSignal;
    }
    get refreshingTokenSignal(): ReadonlySignal<boolean> {
        return this.#isRefreshingTokenSignal;
    }

    static async create(gateway: AuthGateway = getDefaultAuthGateway()): Promise<AuthStoreImpl> {
        const store = new AuthStoreImpl(gateway);
        await store.initializeAuth();
        return store;
    }

    private async initializeAuth() {
        try {
            await this.gateway.connect();
            this.setupVisibilityListeners();

            // Set up API client auth callbacks to avoid circular dependencies
            apiClient.setAuthCallbacks(
                async () => {
                    await this.refreshAuthToken();
                },
                () => this.logout(),
            );

            // Set up auth state listener
            this.gateway.onAuthStateChanged(async (user, idToken) => {
                if (user) {
                    this.#userSignal.value = user;

                    // Apply user's theme colors
                    themeStore.updateCurrentUserTheme(user);

                    // Get and store ID token for API authentication
                    try {
                        apiClient.setAuthToken(idToken);
                        localStorage.setItem(USER_ID_KEY, user.uid);

                        // Set up user-scoped storage for other services
                        CurrencyService.getInstance().setStorage(this.userStorage);
                        expenseFormStore.setStorage(this.userStorage);

                        // Schedule token refresh
                        if (idToken) {
                            this.scheduleNextRefresh(idToken);
                        }
                    } catch (error) {
                        logError('Failed to get ID token', error);
                    }

                    void this.loadUserProfile(user.uid);
                } else {
                    this.#userSignal.value = null;
                    apiClient.setAuthToken(null);
                    localStorage.removeItem(USER_ID_KEY);

                    // Clear all stores when user becomes null (logout or session expired)
                    groupsStore.reset();
                    enhancedGroupDetailStore.reset();
                    themeStore.reset();

                    // Clear storage for other services
                    CurrencyService.getInstance().clearStorage();
                    expenseFormStore.clearStorage();

                    // Clean up token refresh
                    this.cleanup();
                }
                this.#loadingSignal.value = false;
                this.#initializedSignal.value = true;
            });
        } catch (error) {
            this.#errorSignal.value = error instanceof Error ? error.message : 'Auth initialization failed';
            this.#loadingSignal.value = false;
            this.#initializedSignal.value = true;
        }
    }

    private setupVisibilityListeners(): void {
        if (this.visibilityListenersRegistered) {
            return;
        }
        if (typeof window === 'undefined' || typeof document === 'undefined') {
            return;
        }

        window.addEventListener('focus', this.handleWindowFocus);
        document.addEventListener('visibilitychange', this.handleVisibilityChange);
        this.visibilityListenersRegistered = true;
    }

    private async refreshAuthTokenIfNeeded(): Promise<void> {
        if (!this.#userSignal.value) {
            return;
        }

        if (this.refreshPromise) {
            return;
        }

        if (this.tokenExpiryTime) {
            const now = Date.now();
            const refreshThreshold = 5 * 60 * 1000;
            if (now < this.tokenExpiryTime - refreshThreshold) {
                return;
            }
        }

        try {
            await this.refreshAuthToken();
        } catch (error) {
            logError('Visibility-based token refresh failed', error);
        }
    }

    private async loadUserProfile(userId: UserId): Promise<void> {
        try {
            const profile = await apiClient.getUserProfile();
            const currentUser = this.#userSignal.value;
            if (!currentUser || currentUser.uid !== userId) {
                return;
            }

            this.#userSignal.value = {
                ...currentUser,
                displayName: profile.displayName ?? currentUser.displayName,
                role: profile.role,
                adminEmailsAcceptedAt: profile.adminEmailsAcceptedAt,
                marketingEmailsAcceptedAt: profile.marketingEmailsAcceptedAt,
            };

            // Apply user's language preference if set in their profile
            if (profile.preferredLanguage) {
                await applyUserLanguagePreference(profile.preferredLanguage);
            }
        } catch (error) {
            logError('Failed to load user profile', error, { userId });
        }
    }

    async login(email: Email, password: string, rememberMe: boolean = true): Promise<void> {
        this.#loadingSignal.value = true;
        this.#errorSignal.value = null;

        try {
            await this.gateway.setPersistence(rememberMe ? 'local' : 'session');

            // Authenticate via API and get custom token
            const response = await apiClient.login({ email, password: toPassword(password) });

            // Use custom token to establish Firebase Auth session
            await this.gateway.signInWithCustomToken(response.customToken);
            // User state will be updated by onAuthStateChanged listener
        } catch (error: any) {
            this.#errorSignal.value = this.getAuthErrorMessage(error);
            throw error;
        } finally {
            this.#loadingSignal.value = false;
        }
    }

    async register(
        email: Email,
        password: Password,
        displayName: DisplayName,
        termsAccepted: boolean = true,
        cookiePolicyAccepted: boolean = true,
        privacyPolicyAccepted: boolean = true,
        adminEmailsAccepted: boolean = true,
        marketingEmailsAccepted: boolean = false,
    ): Promise<void> {
        this.#loadingSignal.value = true;
        this.#errorSignal.value = null;

        try {
            // Use server-side registration which creates both Firebase Auth user and Firestore document
            const registrationResult = await apiClient.register({
                email,
                password,
                displayName,
                termsAccepted,
                cookiePolicyAccepted,
                privacyPolicyAccepted,
                adminEmailsAccepted,
                marketingEmailsAccepted,
            });

            if (!registrationResult?.success) {
                const message = registrationResult?.message ?? 'Registration failed. Please try again.';
                this.#errorSignal.value = message;
                throw new Error(message);
            }

            // Now sign in the user to get the Firebase Auth state
            await this.signInAfterRegistration(email, password);

            // User state will be updated by onAuthStateChanged listener
        } catch (error: any) {
            if (error instanceof PostRegistrationLoginError) {
                this.#errorSignal.value = error.userMessage;
                throw new Error(error.userMessage);
            }

            this.#errorSignal.value = this.getAuthErrorMessage(error);
            throw error;
        } finally {
            this.#loadingSignal.value = false;
        }
    }

    async logout(): Promise<void> {
        this.#loadingSignal.value = true;
        this.#errorSignal.value = null;

        try {
            // Clear user-scoped storage before signing out
            this.userStorage.clear();

            await this.gateway.signOut();
            apiClient.setAuthToken(null);
            localStorage.removeItem(USER_ID_KEY);

            // Clear all store data on logout
            groupsStore.reset();
            enhancedGroupDetailStore.reset();
            themeStore.reset();

            // Clean up token refresh
            this.cleanup();

            // User state will be updated by onAuthStateChanged listener
        } catch (error: any) {
            this.#errorSignal.value = this.getAuthErrorMessage(error);
            throw error;
        } finally {
            this.#loadingSignal.value = false;
        }
    }

    async resetPassword(email: Email): Promise<void> {
        this.#errorSignal.value = null;

        try {
            await apiClient.sendPasswordResetEmail({ email });
        } catch (error: any) {
            this.#errorSignal.value = this.getAuthErrorMessage(error);
            throw error;
        }
    }

    async updateUserProfile(updates: { displayName?: string; marketingEmailsAccepted?: boolean; }): Promise<void> {
        this.#errorSignal.value = null;
        this.#isUpdatingProfileSignal.value = true;

        try {
            // Call API to update user profile
            await apiClient.updateUserProfile(updates);

            // Re-fetch the user profile to get the updated data
            const updatedUser = await apiClient.getUserProfile();

            // Update the user signal with the new data from server
            if (this.#userSignal.value) {
                this.#userSignal.value = {
                    ...this.#userSignal.value,
                    displayName: updatedUser.displayName,
                    role: updatedUser.role,
                    email: updatedUser.email,
                    emailVerified: updatedUser.emailVerified,
                    adminEmailsAcceptedAt: updatedUser.adminEmailsAcceptedAt,
                    marketingEmailsAcceptedAt: updatedUser.marketingEmailsAcceptedAt,
                };
            }

            // Also update the Firebase Auth user object to keep it in sync
            void this.gateway.performUserRefresh();
        } catch (error: any) {
            this.#errorSignal.value = this.getAuthErrorMessage(error);
            throw error;
        } finally {
            this.#isUpdatingProfileSignal.value = false;
        }
    }

    async changeEmail(payload: { currentPassword: Password; newEmail: Email; }): Promise<void> {
        this.#errorSignal.value = null;
        this.#isUpdatingProfileSignal.value = true;

        try {
            await apiClient.changeEmail(payload);

            // Re-fetch the user profile to get the updated data
            const updatedProfile = await apiClient.getUserProfile();

            if (this.#userSignal.value) {
                this.#userSignal.value = {
                    ...this.#userSignal.value,
                    email: updatedProfile.email,
                    emailVerified: updatedProfile.emailVerified,
                    displayName: updatedProfile.displayName,
                    role: updatedProfile.role,
                };
            }

            void this.gateway.performUserRefresh();
        } catch (error: any) {
            this.#errorSignal.value = this.getAuthErrorMessage(error);
            throw error;
        } finally {
            this.#isUpdatingProfileSignal.value = false;
        }
    }

    clearError(): void {
        this.#errorSignal.value = null;
    }

    async refreshAuthToken(): Promise<string> {
        // Deduplicate concurrent refresh requests
        if (this.refreshPromise) {
            return this.refreshPromise;
        }

        this.refreshPromise = this.performTokenRefresh();

        try {
            const token = await this.refreshPromise;
            return token;
        } finally {
            this.refreshPromise = null;
        }
    }

    private async performTokenRefresh(): Promise<string> {
        this.#isRefreshingTokenSignal.value = true;
        try {
            const freshToken = await this.gateway.performTokenRefresh();
            apiClient.setAuthToken(freshToken);
            this.scheduleNextRefresh(freshToken);
            return freshToken;
        } catch (error) {
            logError('Token refresh failed', error);
            throw error;
        } finally {
            this.#isRefreshingTokenSignal.value = false;
        }
    }

    private scheduleNextRefresh(token: string): void {
        // Clear existing timer
        if (this.refreshTimer) {
            clearTimeout(this.refreshTimer);
        }

        const expiresAt = this.decodeTokenExpiry(token);
        let refreshDelay = 50 * 60 * 1000; // Fallback: refresh after 50 minutes

        if (expiresAt) {
            this.tokenExpiryTime = expiresAt;
            const now = Date.now();
            const timeUntilExpiry = expiresAt - now;
            refreshDelay = Math.max(0, timeUntilExpiry - 5 * 60 * 1000);
        } else {
            // Approximate expiry when decode fails (token lifetime ~60 minutes)
            this.tokenExpiryTime = Date.now() + 60 * 60 * 1000;
        }

        this.refreshTimer = setTimeout(() => {
            this.refreshAuthToken().catch((error) => {
                logError('Scheduled token refresh failed', error);
            });
        }, refreshDelay);
    }

    private decodeTokenExpiry(token: string | null | undefined): number | null {
        if (!token) {
            return null;
        }

        try {
            const [, payload] = token.split('.');
            if (!payload) {
                return null;
            }

            const padded = payload.padEnd(payload.length + (4 - (payload.length % 4)) % 4, '=');

            const decoded = atob(padded);
            const parsed = JSON.parse(decoded);

            if (typeof parsed?.exp === 'number') {
                return parsed.exp * 1000;
            }
        } catch (error) {
            logError('Failed to decode token expiry', error);
        }

        return null;
    }

    private cleanup(): void {
        if (this.refreshTimer) {
            clearTimeout(this.refreshTimer);
            this.refreshTimer = null;
        }
        this.refreshPromise = null;
        this.tokenExpiryTime = null;
        this.#isRefreshingTokenSignal.value = false;
    }

    private async signInAfterRegistration(email: Email, password: string): Promise<void> {
        try {
            // Use API login instead of direct Firebase SDK call
            const response = await apiClient.login({ email, password: toPassword(password) });
            await this.gateway.signInWithCustomToken(response.customToken);
        } catch (error) {
            throw new PostRegistrationLoginError(error, this.buildPostRegistrationLoginErrorMessage(error));
        }
    }

    private buildPostRegistrationLoginErrorMessage(error: unknown): string {
        const t = i18n.t.bind(i18n);
        const baseMessage = t('authErrors.postRegistrationBase');
        const detailedMessage = this.getAuthErrorMessage(error);
        const genericMessage = t('authErrors.generic');

        if (!detailedMessage || detailedMessage === genericMessage) {
            return t('authErrors.postRegistrationFallback');
        }

        return `${baseMessage} ${detailedMessage}`;
    }

    private getAuthErrorMessage(error: unknown): string {
        const t = i18n.t.bind(i18n);

        // Handle API errors from our backend (e.g., EMAIL_EXISTS)
        if (error && typeof error === 'object' && 'code' in error) {
            const errorWithCode = error as { code: string; message?: string; };

            if (errorWithCode.code === AuthErrors.EMAIL_EXISTS_CODE || errorWithCode.code === AuthErrors.EMAIL_EXISTS) {
                return t('authErrors.emailInUse');
            }

            // Handle Firebase Auth errors using the translation helper
            if (errorWithCode.code.startsWith('auth/')) {
                return translateFirebaseAuthError(error, t);
            }
        }

        // Fallback for generic errors
        if (error instanceof Error && error.message) {
            return error.message;
        }

        return t('authErrors.generic');
    }

    // State getters - defined after methods for clarity but before export
}

// Singleton instance promise
let authStoreInstance: Promise<AuthStoreImpl> | null = null;

export const getAuthStore = (): Promise<AuthStoreImpl> => {
    if (!authStoreInstance) {
        authStoreInstance = AuthStoreImpl.create();
    }
    return authStoreInstance;
};
