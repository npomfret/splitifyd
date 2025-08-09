import { createContext } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import type { AuthStore } from '@/types/auth.ts';
import { getAuthStore } from '../stores/auth-store';
import { LoadingSpinner } from '@/components/ui';
import { logError } from '@/utils/browser-logger.ts';

export const AuthContext = createContext<AuthStore | null>(null);

interface AuthProviderProps {
  children: ComponentChildren;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [authStore, setAuthStore] = useState<AuthStore | null>(null);
  const [initError, setInitError] = useState<string | null>(null);

  useEffect(() => {
    const initializeAuthStore = async () => {
      try {
        const store = await getAuthStore();
        setAuthStore(store);
      } catch (error) {
        logError('Failed to initialize auth store', error);
        setInitError(error instanceof Error ? error.message : 'Auth initialization failed');
      }
    };

    // Intentionally not awaited - useEffect cannot be async (React anti-pattern)
    initializeAuthStore();
  }, []);

  if (initError) {
    return (
      <div class="min-h-screen flex items-center justify-center">
        <div class="text-center">
          <h2 class="text-2xl font-bold text-red-600 mb-2">Authentication Error</h2>
          <p class="text-gray-600 mb-4">{initError}</p>
          <button 
            onClick={() => window.location.reload()} 
            class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Show loading until auth is initialized
  if (!authStore) {
    return (
      <div class="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <AuthContext.Provider value={authStore}>
      {children}
    </AuthContext.Provider>
  );
}