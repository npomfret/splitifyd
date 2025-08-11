import { FirestoreError } from 'firebase/firestore';
import { ConnectionManager } from './connection-manager';

export interface ErrorContext {
  feature: string;
  isCritical: boolean;
  userId: string;
  groupId?: string;
  retry: () => Promise<void>;
  fallbackToREST: () => void;
  setOfflineMode: (offline: boolean) => void;
  increaseDebounceTime: (ms: number) => void;
}

export interface CircuitBreakerState {
  state: 'closed' | 'open' | 'half-open';
  failures: number;
  nextRetry: number;
  lastFailure?: number;
}

export interface ToastOptions {
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  duration: number;
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}

export class StreamingErrorHandler {
  private circuitBreaker = new Map<string, CircuitBreakerState>();
  private readonly errorThreshold = 5;
  private readonly resetTimeout = 60000; // 1 minute
  private readonly halfOpenRetryCount = 3;
  
  // Error tracking for analytics
  private errorStats = {
    permissionDenied: 0,
    unavailable: 0,
    resourceExhausted: 0,
    deadlineExceeded: 0,
    other: 0
  };
  
  private connectionManager: ConnectionManager;
  
  constructor() {
    this.connectionManager = ConnectionManager.getInstance();
    this.setupPeriodicCleanup();
  }

  /**
   * Main error handling entry point
   */
  handleError(error: FirestoreError, context: ErrorContext): void {
    console.error(`Streaming error in ${context.feature}:`, error);
    
    // Track errors for analytics
    this.trackError(error, context);
    
    // Get circuit breaker for this feature
    const breaker = this.getCircuitBreaker(context.feature);
    
    // Check if circuit breaker is open
    if (this.isCircuitBreakerOpen(breaker)) {
      this.handleOpenCircuitBreaker(context, breaker);
      return;
    }
    
    // Handle specific error types
    switch (error.code) {
      case 'permission-denied':
        this.handlePermissionError(context);
        break;
        
      case 'unavailable':
        this.handleUnavailableError(context, breaker);
        break;
        
      case 'resource-exhausted':
        this.handleRateLimitError(context, breaker);
        break;
        
      case 'deadline-exceeded':
        this.handleTimeoutError(context, breaker);
        break;
        
      case 'failed-precondition':
        this.handlePreconditionError(context, breaker);
        break;
        
      case 'not-found':
        this.handleNotFoundError(context, breaker);
        break;
        
      default:
        this.handleGenericError(error, context, breaker);
    }
  }

  /**
   * Handle permission denied errors
   */
  private handlePermissionError(context: ErrorContext): void {
    this.errorStats.permissionDenied++;
    
    // Silently fallback to REST for non-critical features
    if (!context.isCritical) {
      console.debug(`Permission denied for ${context.feature}, using REST fallback`);
      context.fallbackToREST();
      return;
    }
    
    // For critical features, notify user and fallback
    this.notifyUser({
      message: 'Access temporarily restricted. Using offline mode.',
      type: 'warning',
      duration: 5000,
      position: 'bottom-right'
    });
    
    context.fallbackToREST();
    context.setOfflineMode(true);
  }

  /**
   * Handle service unavailable errors
   */
  private handleUnavailableError(context: ErrorContext, breaker: CircuitBreakerState): void {
    this.errorStats.unavailable++;
    breaker.failures++;
    breaker.lastFailure = Date.now();
    
    if (breaker.failures >= this.errorThreshold) {
      // Open circuit breaker
      breaker.state = 'open';
      breaker.nextRetry = Date.now() + this.resetTimeout;
      
      this.notifyUser({
        message: 'Service temporarily unavailable. Working offline.',
        type: 'warning',
        duration: 8000,
        position: 'bottom-right'
      });
      
      context.setOfflineMode(true);
      context.fallbackToREST();
    } else {
      // Retry with exponential backoff
      const delay = Math.min(1000 * Math.pow(2, breaker.failures), 30000);
      
      setTimeout(() => {
        if (this.connectionManager.isOnline.value) {
          context.retry();
        }
      }, delay);
    }
  }

  /**
   * Handle rate limiting errors
   */
  private handleRateLimitError(context: ErrorContext, breaker: CircuitBreakerState): void {
    this.errorStats.resourceExhausted++;
    breaker.failures++;
    
    // Increase debounce time exponentially
    const additionalDelay = breaker.failures * 2000;
    context.increaseDebounceTime(additionalDelay);
    
    if (breaker.failures > 3) {
      this.notifyUser({
        message: 'High activity detected. Updates may be delayed.',
        type: 'info',
        duration: 6000,
        position: 'bottom-right'
      });
    }
    
    // Retry after rate limit period
    const retryDelay = Math.min(5000 * breaker.failures, 60000);
    setTimeout(() => context.retry(), retryDelay);
  }

  /**
   * Handle timeout errors
   */
  private handleTimeoutError(context: ErrorContext, breaker: CircuitBreakerState): void {
    this.errorStats.deadlineExceeded++;
    breaker.failures++;
    
    // Check connection quality
    if (this.connectionManager.connectionQuality.value === 'poor') {
      // Don't retry immediately on poor connections
      context.increaseDebounceTime(5000);
      
      this.notifyUser({
        message: 'Slow connection detected. Updates will be less frequent.',
        type: 'info',
        duration: 5000,
        position: 'bottom-right'
      });
    } else {
      // Retry with backoff
      const delay = Math.min(2000 * Math.pow(2, Math.min(breaker.failures, 5)), 30000);
      setTimeout(() => context.retry(), delay);
    }
  }

  /**
   * Handle failed precondition errors (usually data conflicts)
   */
  private handlePreconditionError(context: ErrorContext, breaker: CircuitBreakerState): void {
    breaker.failures++;
    
    if (context.isCritical) {
      this.notifyUser({
        message: 'Data conflict detected. Please refresh and try again.',
        type: 'warning',
        duration: 8000,
        position: 'bottom-right'
      });
    }
    
    // Force refresh to resolve conflicts
    context.fallbackToREST();
    
    // Short delay before retry
    setTimeout(() => context.retry(), 2000);
  }

  /**
   * Handle not found errors
   */
  private handleNotFoundError(context: ErrorContext, breaker: CircuitBreakerState): void {
    if (context.isCritical) {
      this.notifyUser({
        message: 'Content not found. Please refresh the page.',
        type: 'warning',
        duration: 10000,
        position: 'bottom-right'
      });
    }
    
    // Fallback to REST to verify data exists
    context.fallbackToREST();
  }

  /**
   * Handle generic/unknown errors
   */
  private handleGenericError(error: FirestoreError, context: ErrorContext, breaker: CircuitBreakerState): void {
    this.errorStats.other++;
    breaker.failures++;
    
    console.error('Unknown Firestore error:', error);
    
    if (context.isCritical) {
      this.notifyUser({
        message: 'Connection issue detected. Attempting to reconnect...',
        type: 'info',
        duration: 5000,
        position: 'bottom-right'
      });
    }
    
    // Generic retry with backoff
    const delay = Math.min(1000 * Math.pow(2, breaker.failures), 20000);
    setTimeout(() => context.retry(), delay);
  }

  /**
   * Handle open circuit breaker
   */
  private handleOpenCircuitBreaker(context: ErrorContext, breaker: CircuitBreakerState): void {
    const now = Date.now();
    
    if (now >= breaker.nextRetry) {
      // Try half-open state
      breaker.state = 'half-open';
      breaker.failures = 0;
      
      console.log(`Circuit breaker half-open for ${context.feature}`);
      
      // Attempt retry
      context.retry().catch((error) => {
        // Failed in half-open state, go back to open
        breaker.state = 'open';
        breaker.failures++;
        breaker.nextRetry = now + this.resetTimeout;
        console.log(`Circuit breaker reopened for ${context.feature}`);
      });
    } else {
      // Still in open state, use fallback
      console.debug(`Circuit breaker open for ${context.feature}, using fallback`);
      context.fallbackToREST();
    }
  }

  /**
   * Get or create circuit breaker for feature
   */
  private getCircuitBreaker(feature: string): CircuitBreakerState {
    if (!this.circuitBreaker.has(feature)) {
      this.circuitBreaker.set(feature, {
        state: 'closed',
        failures: 0,
        nextRetry: 0
      });
    }
    return this.circuitBreaker.get(feature)!;
  }

  /**
   * Check if circuit breaker is open
   */
  private isCircuitBreakerOpen(breaker: CircuitBreakerState): boolean {
    return breaker.state === 'open' && Date.now() < breaker.nextRetry;
  }

  /**
   * Reset circuit breaker (called on successful operations)
   */
  resetCircuitBreaker(feature: string): void {
    const breaker = this.getCircuitBreaker(feature);
    if (breaker.state !== 'closed') {
      breaker.state = 'closed';
      breaker.failures = 0;
      breaker.nextRetry = 0;
      console.log(`Circuit breaker reset for ${feature}`);
    }
  }

  /**
   * Track errors for analytics
   */
  private trackError(error: FirestoreError, context: ErrorContext): void {
    // Log to analytics service (if available)
    if (typeof window !== 'undefined' && (window as any).analytics) {
      (window as any).analytics.track('streaming_error', {
        errorCode: error.code,
        feature: context.feature,
        isCritical: context.isCritical,
        userId: context.userId,
        groupId: context.groupId,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Show user notification
   */
  private notifyUser(options: ToastOptions): void {
    // Dispatch custom event for toast system
    window.dispatchEvent(new CustomEvent('show-toast', {
      detail: options
    }));
  }

  /**
   * Get error statistics
   */
  getErrorStats() {
    return {
      ...this.errorStats,
      circuitBreakerStates: Object.fromEntries(
        Array.from(this.circuitBreaker.entries()).map(([feature, state]) => [
          feature,
          {
            state: state.state,
            failures: state.failures,
            nextRetry: state.nextRetry
          }
        ])
      )
    };
  }

  /**
   * Reset error statistics
   */
  resetStats(): void {
    this.errorStats = {
      permissionDenied: 0,
      unavailable: 0,
      resourceExhausted: 0,
      deadlineExceeded: 0,
      other: 0
    };
  }

  /**
   * Setup periodic cleanup of circuit breakers
   */
  private setupPeriodicCleanup(): void {
    setInterval(() => {
      const now = Date.now();
      const maxAge = 5 * 60 * 1000; // 5 minutes
      
      for (const [feature, breaker] of this.circuitBreaker.entries()) {
        // Clean up old circuit breakers that haven't failed recently
        if (
          breaker.state === 'closed' &&
          breaker.lastFailure &&
          (now - breaker.lastFailure) > maxAge
        ) {
          this.circuitBreaker.delete(feature);
          console.debug(`Cleaned up circuit breaker for ${feature}`);
        }
      }
    }, 60000); // Run cleanup every minute
  }

  /**
   * Force reset all circuit breakers (for testing/recovery)
   */
  resetAllCircuitBreakers(): void {
    this.circuitBreaker.clear();
    console.log('All circuit breakers reset');
  }
}

// Export singleton instance
export const streamingErrorHandler = new StreamingErrorHandler();