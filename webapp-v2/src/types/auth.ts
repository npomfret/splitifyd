import type {User as FirebaseUser} from 'firebase/auth';
import type {ClientUser} from '@splitifyd/shared';

export interface AuthState {
    user: ClientUser | null;
    loading: boolean;
    error: string | null;
    initialized: boolean;
    isUpdatingProfile?: boolean;
}

export interface AuthActions {
    login: (email: string, password: string) => Promise<void>;
    register: (email: string, password: string, displayName: string, termsAccepted: boolean, cookiePolicyAccepted: boolean) => Promise<void>;
    logout: () => Promise<void>;
    resetPassword: (email: string) => Promise<void>;
    updateUserProfile: (updates: { displayName?: string }) => Promise<void>;
    clearError: () => void;
    refreshAuthToken: () => Promise<string>;
}

export interface AuthStore extends AuthState, AuthActions {}

export function mapFirebaseUser(firebaseUser: FirebaseUser): ClientUser {
    return {
        uid: firebaseUser.uid!,
        email: firebaseUser.email!,
        displayName: firebaseUser.displayName!,
        emailVerified: firebaseUser.emailVerified,
        photoURL: firebaseUser.photoURL,
        // Note: themeColor and preferredLanguage will be populated from backend API
        // when user data is fetched from Firestore
    };
}
