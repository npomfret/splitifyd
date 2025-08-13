/**
 * Debounce utility for Firebase Functions
 * Prevents rapid firing of change notifications by batching updates
 */

interface DebouncedFunction<T extends any[]> {
  (...args: T): void;
  cancel: () => void;
}

export class DebounceManager {
  private static timeouts = new Map<string, NodeJS.Timeout>();
  
  /**
   * Debounce a function call by key
   * @param key Unique identifier for this debounced operation
   * @param fn Function to debounce
   * @param delay Delay in milliseconds before executing
   * @returns Debounced function with cancel method
   */
  static debounce<T extends any[]>(
    key: string,
    fn: (...args: T) => Promise<void> | void,
    delay: number = 500
  ): DebouncedFunction<T> {
    const debouncedFn = (...args: T) => {
      // Clear existing timeout for this key
      if (this.timeouts.has(key)) {
        clearTimeout(this.timeouts.get(key)!);
      }
      
      // Set new timeout
      const timeout = setTimeout(async () => {
        try {
          await fn(...args);
        } catch (error) {
          console.error(`Debounced function failed for key ${key}:`, error);
        } finally {
          this.timeouts.delete(key);
        }
      }, delay);
      
      this.timeouts.set(key, timeout);
    };
    
    // Add cancel method
    debouncedFn.cancel = () => {
      this.cancel(key);
    };
    
    return debouncedFn;
  }
  
  /**
   * Cancel a pending debounced operation
   * @param key Key of the operation to cancel
   */
  static cancel(key: string): void {
    const timeout = this.timeouts.get(key);
    if (timeout) {
      clearTimeout(timeout);
      this.timeouts.delete(key);
    }
  }
  
  /**
   * Check if an operation is pending
   * @param key Key to check
   * @returns True if operation is pending
   */
  static isPending(key: string): boolean {
    return this.timeouts.has(key);
  }
  
  /**
   * Clear all pending operations
   */
  static clearAll(): void {
    for (const timeout of this.timeouts.values()) {
      clearTimeout(timeout);
    }
    this.timeouts.clear();
  }
  
  /**
   * Get count of pending operations
   * @returns Number of pending operations
   */
  static getPendingCount(): number {
    return this.timeouts.size;
  }
}

// Export a singleton instance for convenience
export const debounceManager = new DebounceManager();