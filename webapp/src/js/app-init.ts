import type { FirebaseUser } from './types/global';
import { showWarning, hideWarning, showError } from './utils/ui-messages.js';
import { firebaseAuthInstance, isFirebaseInitialized, firebaseInitializer } from './firebase-init.js';
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

    this.setupApiBaseUrl();
    this.setupGlobalErrorHandlers();
    
    // Initialize Firebase if not already initialized
    if (!isFirebaseInitialized()) {
      await firebaseInitializer.initialize();
    }
    
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

  static setupApiBaseUrl(): void {
    const isEmulator = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const apiBaseUrl = isEmulator ? 'http://127.0.0.1:6001/splitifyd/us-central1' : '';
    (window as any).API_BASE_URL = apiBaseUrl;
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
}