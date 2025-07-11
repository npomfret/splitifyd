import type { FirebaseUser } from './types/global';
import { showWarning, hideWarning } from './utils/ui-messages.js';
import { firebaseAuthInstance } from './firebase-config.js';

interface AppInitConfig {
  requireAuth?: boolean;
  onAuthStateChanged?: ((user: FirebaseUser | null) => void) | null;
  onReady?: (() => void) | null;
}

export class AppInit {
  static async initialize(config: AppInitConfig = {}): Promise<void> {
    const {
      requireAuth = true,
      onAuthStateChanged = null,
      onReady = null
    } = config;

    await this.waitForFirebase();
    
    if (requireAuth) {
      this.setupAuthListener(onAuthStateChanged);
    }

    this.setupWarningBanner();
    
    if (onReady) {
      onReady();
    }
  }

  static async waitForFirebase(): Promise<void> {
    const maxAttempts = 50;
    const intervalMs = 100;
    let attempts = 0;
    
    // Wait for firebaseAuth to be available
    while (!firebaseAuthInstance && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, intervalMs));
      attempts++;
    }
    
    if (!firebaseAuthInstance) {
      throw new Error(`Firebase failed to load after ${maxAttempts * intervalMs}ms`);
    }
  }

  static setupAuthListener(customHandler: ((user: FirebaseUser | null) => void) | null): void {
    firebaseAuthInstance!.onAuthStateChanged((user: FirebaseUser | null) => {
      if (customHandler) {
        customHandler(user);
      } else if (!user) {
        window.location.href = '/';
      }
    });
  }

  static setupWarningBanner(): void {
    window.addEventListener('online', () => {
      hideWarning();
    });

    window.addEventListener('offline', () => {
      showWarning('You are currently offline. Some features may not work properly.');
    });

    if (!navigator.onLine) {
      showWarning('You are currently offline. Some features may not work properly.');
    }
  }

  static showError(message: string, duration: number = 5000): void {
    showWarning(message);
    if (duration > 0) {
      setTimeout(() => hideWarning(), duration);
    }
  }

  static hideError(): void {
    hideWarning();
  }

  static async getCurrentUser(): Promise<FirebaseUser | null> {
    const user = firebaseAuthInstance!.getCurrentUser();
    if (!user) {
      return await new Promise((resolve) => {
        const unsubscribe = firebaseAuthInstance!.onAuthStateChanged((user: FirebaseUser | null) => {
          unsubscribe();
          resolve(user);
        });
      });
    }
    return firebaseAuthInstance!.getCurrentUser();
  }

  static async requireUser(): Promise<FirebaseUser> {
    const user = await this.getCurrentUser();
    if (!user) {
      window.location.href = '/';
      throw new Error('User not authenticated');
    }
    return user;
  }

  static handleError(error: any, userMessage: string | null = null): void {
    let message = userMessage || 'An error occurred. Please try again.';
    
    if (error.code) {
      switch (error.code) {
        case 'auth/network-request-failed':
          message = 'Network error. Please check your connection.';
          break;
        case 'permission-denied':
          message = 'You do not have permission to perform this action.';
          break;
        case 'not-found':
          message = 'The requested resource was not found.';
          break;
      }
    }
    
    this.showError(message);
  }
}