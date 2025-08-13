import type { User as FirebaseUser } from 'firebase/auth';
import type { UserThemeColor } from '@shared/shared-types';

export interface User {
  uid: string;
  email: string;
  displayName: string;
  emailVerified: boolean;
  photoURL: string | null;
  themeColor?: UserThemeColor;
}

export interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
  initialized: boolean;
}

export interface AuthActions {
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string, termsAccepted: boolean, cookiePolicyAccepted: boolean) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  clearError: () => void;
}

export interface AuthStore extends AuthState, AuthActions {}

export function mapFirebaseUser(firebaseUser: FirebaseUser): User {
  return {
    uid: firebaseUser.uid,
    email: firebaseUser.email || '',
    displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
    emailVerified: firebaseUser.emailVerified,
    photoURL: firebaseUser.photoURL,
  };
}