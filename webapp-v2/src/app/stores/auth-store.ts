import { signal } from '@preact/signals';
import type { AuthStore, User } from '../../types/auth';
import { mapFirebaseUser } from '../../types/auth';
import { firebaseService } from '../firebase';
import { apiClient } from '../apiClient';
import { USER_ID_KEY } from '../../constants';

// Signals for auth state
const userSignal = signal<User | null>(null);
const loadingSignal = signal<boolean>(true);
const errorSignal = signal<string | null>(null);
const initializedSignal = signal<boolean>(false);

class AuthStoreImpl implements AuthStore {
  // State getters
  get user() { return userSignal.value; }
  get loading() { return loadingSignal.value; }
  get error() { return errorSignal.value; }
  get initialized() { return initializedSignal.value; }

  constructor() {
    this.initializeAuth();
  }

  private async initializeAuth() {
    try {
      await firebaseService.initialize();
      
      // Set up auth state listener
      firebaseService.onAuthStateChanged(async (firebaseUser) => {
        if (firebaseUser) {
          userSignal.value = mapFirebaseUser(firebaseUser);
          
          // Get and store ID token for API authentication
          try {
            const idToken = await firebaseUser.getIdToken();
            apiClient.setAuthToken(idToken);
            localStorage.setItem(USER_ID_KEY, firebaseUser.uid);
          } catch (error) {
            console.error('Failed to get ID token:', error);
          }
        } else {
          userSignal.value = null;
          apiClient.setAuthToken(null);
          localStorage.removeItem(USER_ID_KEY);
        }
        loadingSignal.value = false;
        initializedSignal.value = true;
      });
      
    } catch (error) {
      errorSignal.value = error instanceof Error ? error.message : 'Auth initialization failed';
      loadingSignal.value = false;
      initializedSignal.value = true;
    }
  }

  async login(email: string, password: string): Promise<void> {
    loadingSignal.value = true;
    errorSignal.value = null;

    try {
      const userCredential = await firebaseService.signInWithEmailAndPassword(email, password);
      
      // Get ID token for API authentication
      const idToken = await userCredential.user.getIdToken();
      apiClient.setAuthToken(idToken);
      localStorage.setItem(USER_ID_KEY, userCredential.user.uid);
      
      // User state will be updated by onAuthStateChanged listener
    } catch (error: any) {
      errorSignal.value = this.getAuthErrorMessage(error);
      throw error;
    } finally {
      loadingSignal.value = false;
    }
  }

  async register(email: string, password: string, displayName: string): Promise<void> {
    loadingSignal.value = true;
    errorSignal.value = null;

    try {
      const result = await firebaseService.createUserWithEmailAndPassword(email, password);
      
      // Update display name
      if (result.user && displayName) {
        await firebaseService.updateProfile(result.user, { displayName });
      }
      
      // Get ID token for API authentication
      const idToken = await result.user.getIdToken();
      apiClient.setAuthToken(idToken);
      localStorage.setItem(USER_ID_KEY, result.user.uid);
      
      // User state will be updated by onAuthStateChanged listener
    } catch (error: any) {
      errorSignal.value = this.getAuthErrorMessage(error);
      throw error;
    } finally {
      loadingSignal.value = false;
    }
  }

  async logout(): Promise<void> {
    loadingSignal.value = true;
    errorSignal.value = null;

    try {
      await firebaseService.signOut();
      apiClient.setAuthToken(null);
      localStorage.removeItem(USER_ID_KEY);
      // User state will be updated by onAuthStateChanged listener
    } catch (error: any) {
      errorSignal.value = this.getAuthErrorMessage(error);
      throw error;
    } finally {
      loadingSignal.value = false;
    }
  }

  async resetPassword(email: string): Promise<void> {
    errorSignal.value = null;

    try {
      await firebaseService.sendPasswordResetEmail(email);
    } catch (error: any) {
      errorSignal.value = this.getAuthErrorMessage(error);
      throw error;
    }
  }

  clearError(): void {
    errorSignal.value = null;
  }

  private getAuthErrorMessage(error: any): string {
    if (error?.code) {
      switch (error.code) {
        case 'auth/user-not-found':
        case 'auth/wrong-password':
          return 'Invalid email or password.';
        case 'auth/email-already-in-use':
          return 'This email is already registered.';
        case 'auth/weak-password':
          return 'Password is too weak. Please use at least 6 characters.';
        case 'auth/invalid-email':
          return 'Please enter a valid email address.';
        case 'auth/too-many-requests':
          return 'Too many failed attempts. Please try again later.';
        case 'auth/network-request-failed':
          return 'Network error. Please check your connection.';
        default:
          return error.message || 'An authentication error occurred.';
      }
    }
    return error?.message || 'An unexpected error occurred.';
  }
}

export const authStore = new AuthStoreImpl();