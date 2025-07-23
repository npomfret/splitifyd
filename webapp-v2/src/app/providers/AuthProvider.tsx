import { createContext } from 'preact';
import type { ComponentChildren } from 'preact';
import type { AuthStore } from '../../types/auth';
import { authStore } from '../stores/auth-store';

const AuthContext = createContext<AuthStore | null>(null);

interface AuthProviderProps {
  children: ComponentChildren;
}

export function AuthProvider({ children }: AuthProviderProps) {
  return (
    <AuthContext.Provider value={authStore}>
      {children}
    </AuthContext.Provider>
  );
}