import { useContext } from 'preact/hooks';
import { AuthContext } from '../providers/AuthProvider';
import type { AuthStore } from '../../types/auth';

export function useAuth(): AuthStore {
  const authStore = useContext(AuthContext);
  
  if (!authStore) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  
  return authStore;
}