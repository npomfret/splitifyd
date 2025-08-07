import { useContext } from 'preact/hooks';
import { AuthContext } from '../providers/AuthProvider';
import type { AuthStore } from '../../types/auth';

export function useAuth(): AuthStore | null {
  const authStore = useContext(AuthContext);
  
  // During SSG, return null instead of throwing
  if (typeof window === 'undefined') {
    return null;
  }
  
  if (!authStore) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  
  return authStore;
}