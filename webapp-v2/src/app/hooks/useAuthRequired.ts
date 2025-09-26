import { useContext } from 'preact/hooks';
import { AuthContext } from '../providers/AuthProvider';
import type { AuthStore } from '../stores/auth-store';

/**
 * Use this hook in components that require authentication.
 * Unlike useAuth, this will throw if auth is not available.
 */
export function useAuthRequired(): AuthStore {
    const authStore = useContext(AuthContext);

    if (!authStore) {
        throw new Error('useAuthRequired must be used within an AuthProvider with initialized auth');
    }

    return authStore;
}
