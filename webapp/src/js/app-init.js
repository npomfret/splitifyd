// Functions are available globally from warning-banner.js

export class AppInit {
  static async initialize(config = {}) {
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

  static async waitForFirebase() {
    const maxAttempts = 50;
    const intervalMs = 100;
    let attempts = 0;
    
    // Wait for firebaseAuth to be available
    while (!window.firebaseAuth && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, intervalMs));
      attempts++;
    }
    
    if (!window.firebaseAuth) {
      throw new Error(`Firebase failed to load after ${maxAttempts * intervalMs}ms`);
    }
  }

  static setupAuthListener(customHandler) {
    window.firebaseAuth.onAuthStateChanged((user) => {
      if (customHandler) {
        customHandler(user);
      } else if (!user) {
        window.location.href = '/';
      }
    });
  }

  static setupWarningBanner() {
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

  static showError(message, duration = 5000) {
    showWarning(message);
    if (duration > 0) {
      setTimeout(() => hideWarning(), duration);
    }
  }

  static hideError() {
    hideWarning();
  }

  static async getCurrentUser() {
    const user = window.firebaseAuth.getCurrentUser();
    if (!user) {
      await new Promise((resolve) => {
        const unsubscribe = window.firebaseAuth.onAuthStateChanged((user) => {
          unsubscribe();
          resolve(user);
        });
      });
    }
    return window.firebaseAuth.getCurrentUser();
  }

  static async requireUser() {
    const user = await this.getCurrentUser();
    if (!user) {
      window.location.href = '/';
      throw new Error('User not authenticated');
    }
    return user;
  }

  static handleError(error, userMessage = null) {
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