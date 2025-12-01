import { LoadingSpinner } from '@/components/ui';
import { Clickable } from '@/components/ui/Clickable';
import { logError } from '@/utils/browser-logger.ts';
import { createContext } from 'preact';
import type { ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { useTranslation } from 'react-i18next';
import type { AuthStore } from '../stores/auth-store';
import { getAuthStore } from '../stores/auth-store';

export const AuthContext = createContext<AuthStore | null>(null);

interface AuthProviderProps {
    children: ComponentChildren;
}

export function AuthProvider({ children }: AuthProviderProps) {
    const { t } = useTranslation();
    const [authStore, setAuthStore] = useState<AuthStore | null>(null);
    const [initError, setInitError] = useState<string | null>(null);

    useEffect(() => {
        let mounted = true;

        const initializeAuthStore = async () => {
            try {
                const store = await getAuthStore();

                if (!mounted) return;

                // Start token refresh if user is authenticated
                if (store.user) {
                    try {
                        await store.refreshAuthToken();
                    } catch (refreshError) {
                        // Don't fail initialization if token refresh fails
                        logError('Initial token refresh failed', refreshError);
                    }
                }

                setAuthStore(store);
            } catch (error) {
                if (!mounted) return;
                logError('Failed to initialize auth store', error);
                setInitError(error instanceof Error ? error.message : t('auth.initializationFailed'));
            }
        };

        // Intentionally not awaited - useEffect cannot be async (React anti-pattern)
        initializeAuthStore();

        // Cleanup on unmount
        return () => {
            mounted = false;
        };
    }, []);

    if (initError) {
        return (
            <div class='min-h-screen flex items-center justify-center'>
                <div class='text-center'>
                    <h2 class='text-2xl font-bold text-semantic-error mb-2' role='alert' data-testid='auth-error-heading'>
                        {t('authProvider.authenticationError')}
                    </h2>
                    <p class='text-text-muted mb-4'>{initError}</p>
                    <Clickable
                        as='button'
                        type='button'
                        onClick={() => window.location.reload()}
                        className='px-4 py-2 bg-interactive-primary text-text-inverted rounded hover:bg-interactive-primary'
                        aria-label='Retry authentication'
                        eventName='auth_error_retry'
                        eventProps={{ error: initError }}
                    >
                        {t('authProvider.retry')}
                    </Clickable>
                </div>
            </div>
        );
    }

    // Show loading until auth is initialized
    if (!authStore) {
        return (
            <div class='min-h-screen flex items-center justify-center'>
                <LoadingSpinner size='lg' />
            </div>
        );
    }

    return <AuthContext.Provider value={authStore}>{children}</AuthContext.Provider>;
}
