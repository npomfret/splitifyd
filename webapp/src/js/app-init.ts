import type { FirebaseUser } from './types/global';
import { showWarning, hideWarning, showError } from './utils/ui-messages.js';
import { firebaseAuthInstance, isFirebaseInitialized } from './firebase-init.js';
import { MAX_AUTH_ATTEMPTS, AUTH_ATTEMPT_INTERVAL_MS } from './constants.js';
import { logger } from './utils/logger.js';

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

    this.setupGlobalErrorHandlers();
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
    let attempts = 0;
    
    // Wait for firebaseAuth to be available
    while (!isFirebaseInitialized() && attempts < MAX_AUTH_ATTEMPTS) {
      await new Promise(resolve => setTimeout(resolve, AUTH_ATTEMPT_INTERVAL_MS));
      attempts++;
    }
    
    if (!isFirebaseInitialized()) {
      throw new Error(`Firebase failed to load after ${MAX_AUTH_ATTEMPTS * AUTH_ATTEMPT_INTERVAL_MS}ms`);
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

  static setupGlobalErrorHandlers(): void {
    window.addEventListener('error', (event: ErrorEvent) => {
      logger.error('Unhandled JavaScript Error:', event.error);
      showError('An unexpected error occurred. Please refresh the page.');
      event.preventDefault();
    });

    window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
      logger.error('Unhandled Promise Rejection:', event.reason);
      showError('An operation failed unexpectedly. Please try again.');
      event.preventDefault();
    });
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