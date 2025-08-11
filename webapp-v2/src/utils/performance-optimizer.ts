import { batch } from '@preact/signals';
import { DocumentSnapshot, QuerySnapshot, Query, onSnapshot } from 'firebase/firestore';

export interface Update {
  id: string;
  type: 'balance' | 'expense' | 'group' | 'presence';
  data: any;
  priority: 'high' | 'medium' | 'low';
  timestamp: number;
}

export interface UpdateGroup {
  type: string;
  updates: Update[];
  priority: 'high' | 'medium' | 'low';
}

export interface ManagedListener {
  unsubscribe: () => void;
  resubscribe: () => void;
}

export interface CircuitBreakerState {
  state: 'closed' | 'open' | 'half-open';
  failures: number;
  nextRetry: number;
}

export class PerformanceOptimizer {
  private updateQueue: Update[] = [];
  private batchTimeout: NodeJS.Timeout | null = null;
  private renderFrame: number | null = null;
  private processingBatch = false;
  
  // Performance metrics
  private updateCount = 0;
  private averageProcessingTime = 0;
  private lastPerformanceLog = 0;
  
  // Memory leak prevention
  private listeners = new Set<() => void>();
  
  constructor() {
    // Log performance metrics periodically
    this.schedulePerformanceLogging();
  }

  /**
   * Queue an update for batched processing
   */
  queueUpdate(update: Update) {
    this.updateQueue.push(update);
    
    if (!this.batchTimeout && !this.processingBatch) {
      // Schedule batch processing with priority-based timing
      const delay = update.priority === 'high' ? 0 : 16; // High priority immediate, others at 60fps
      
      this.batchTimeout = setTimeout(() => {
        this.processBatch();
      }, delay);
    }
  }

  /**
   * Process a batch of updates efficiently
   */
  private processBatch() {
    if (this.renderFrame) {
      cancelAnimationFrame(this.renderFrame);
    }
    
    this.processingBatch = true;
    
    // Process updates in next animation frame
    this.renderFrame = requestAnimationFrame(() => {
      const startTime = performance.now();
      
      const updates = this.updateQueue.splice(0);
      
      if (updates.length === 0) {
        this.processingBatch = false;
        this.batchTimeout = null;
        this.renderFrame = null;
        return;
      }
      
      // Group updates by type and priority
      const grouped = this.groupUpdates(updates);
      
      // Apply updates efficiently using Preact batch
      batch(() => {
        grouped.forEach(group => {
          this.applyUpdateGroup(group);
        });
      });
      
      // Update performance metrics
      const processingTime = performance.now() - startTime;
      this.updatePerformanceMetrics(updates.length, processingTime);
      
      this.processingBatch = false;
      this.batchTimeout = null;
      this.renderFrame = null;
    });
  }

  /**
   * Group updates by type and priority for efficient processing
   */
  private groupUpdates(updates: Update[]): UpdateGroup[] {
    const groups = new Map<string, UpdateGroup>();
    
    updates.forEach(update => {
      const key = `${update.type}-${update.priority}`;
      
      if (!groups.has(key)) {
        groups.set(key, {
          type: update.type,
          updates: [],
          priority: update.priority
        });
      }
      
      groups.get(key)!.updates.push(update);
    });
    
    // Sort by priority: high, medium, low
    const sortedGroups = Array.from(groups.values()).sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
    
    return sortedGroups;
  }

  /**
   * Apply a group of updates efficiently
   */
  private applyUpdateGroup(group: UpdateGroup) {
    switch (group.type) {
      case 'balance':
        this.applyBalanceUpdates(group.updates);
        break;
      case 'expense':
        this.applyExpenseUpdates(group.updates);
        break;
      case 'group':
        this.applyGroupUpdates(group.updates);
        break;
      case 'presence':
        this.applyPresenceUpdates(group.updates);
        break;
      default:
        console.warn('Unknown update type:', group.type);
    }
  }

  /**
   * Apply balance updates with deduplication
   */
  private applyBalanceUpdates(updates: Update[]) {
    // Deduplicate by id, keeping latest
    const latest = new Map<string, Update>();
    
    updates.forEach(update => {
      const existing = latest.get(update.id);
      if (!existing || update.timestamp > existing.timestamp) {
        latest.set(update.id, update);
      }
    });
    
    // Apply deduplicated updates
    latest.forEach(update => {
      // Emit custom event for balance update
      window.dispatchEvent(new CustomEvent('balance-update', {
        detail: { id: update.id, data: update.data }
      }));
    });
  }

  /**
   * Apply expense updates with smart merging
   */
  private applyExpenseUpdates(updates: Update[]) {
    const grouped = new Map<string, Update[]>();
    
    // Group by expense ID
    updates.forEach(update => {
      if (!grouped.has(update.id)) {
        grouped.set(update.id, []);
      }
      grouped.get(update.id)!.push(update);
    });
    
    // Apply most recent update for each expense
    grouped.forEach((expenseUpdates, expenseId) => {
      const latest = expenseUpdates.reduce((latest, current) => 
        current.timestamp > latest.timestamp ? current : latest
      );
      
      window.dispatchEvent(new CustomEvent('expense-update', {
        detail: { id: expenseId, data: latest.data }
      }));
    });
  }

  /**
   * Apply group updates
   */
  private applyGroupUpdates(updates: Update[]) {
    updates.forEach(update => {
      window.dispatchEvent(new CustomEvent('group-update', {
        detail: { id: update.id, data: update.data }
      }));
    });
  }

  /**
   * Apply presence updates with throttling
   */
  private applyPresenceUpdates(updates: Update[]) {
    // Throttle presence updates to avoid UI spam
    const throttled = this.throttlePresenceUpdates(updates);
    
    throttled.forEach(update => {
      window.dispatchEvent(new CustomEvent('presence-update', {
        detail: { id: update.id, data: update.data }
      }));
    });
  }

  /**
   * Throttle presence updates to avoid overwhelming UI
   */
  private throttlePresenceUpdates(updates: Update[]): Update[] {
    const userLastUpdate = new Map<string, number>();
    const minInterval = 1000; // 1 second minimum between presence updates per user
    
    return updates.filter(update => {
      const userId = update.data.userId;
      const lastUpdate = userLastUpdate.get(userId) || 0;
      
      if (update.timestamp - lastUpdate >= minInterval) {
        userLastUpdate.set(userId, update.timestamp);
        return true;
      }
      
      return false;
    });
  }

  /**
   * Create a selective listener that only listens for specific fields
   */
  static createSelectiveListener(fields: string[]) {
    return (snapshot: DocumentSnapshot) => {
      const data = snapshot.data();
      const updates: Partial<any> = {};
      let hasChanges = false;
      
      fields.forEach(field => {
        if (data?.[field] !== undefined) {
          updates[field] = data[field];
          hasChanges = true;
        }
      });
      
      return hasChanges ? updates : null;
    };
  }

  /**
   * Create a managed listener with automatic retry and cleanup
   */
  static createManagedListener(
    query: Query,
    callback: (snapshot: QuerySnapshot) => void,
    options?: {
      maxRetries?: number;
      retryDelay?: number;
      includeMetadataChanges?: boolean;
    }
  ): ManagedListener {
    const maxRetries = options?.maxRetries || 3;
    const retryDelay = options?.retryDelay || 1000;
    const includeMetadataChanges = options?.includeMetadataChanges || false;
    
    let unsubscribe: (() => void) | null = null;
    let retryCount = 0;
    let isDestroyed = false;
    
    const subscribe = () => {
      if (isDestroyed) return;
      
      unsubscribe = onSnapshot(
        query,
        { includeMetadataChanges },
        (snapshot) => {
          if (isDestroyed) return;
          
          retryCount = 0; // Reset on success
          
          // Only process non-metadata changes unless specifically requested
          if (!snapshot.metadata.fromCache || includeMetadataChanges) {
            callback(snapshot);
          }
        },
        (error) => {
          if (isDestroyed) return;
          
          console.error('Managed listener error:', error);
          
          if (retryCount < maxRetries) {
            retryCount++;
            const delay = retryDelay * Math.pow(2, retryCount - 1); // Exponential backoff
            
            console.log(`Retrying listener in ${delay}ms (attempt ${retryCount}/${maxRetries})`);
            
            setTimeout(subscribe, delay);
          } else {
            console.error('Max retries exceeded for managed listener');
          }
        }
      );
    };
    
    subscribe();
    
    return {
      unsubscribe: () => {
        isDestroyed = true;
        if (unsubscribe) {
          unsubscribe();
          unsubscribe = null;
        }
      },
      resubscribe: () => {
        if (!isDestroyed) {
          retryCount = 0;
          if (unsubscribe) {
            unsubscribe();
          }
          subscribe();
        }
      }
    };
  }

  /**
   * Update performance metrics
   */
  private updatePerformanceMetrics(updateCount: number, processingTime: number) {
    this.updateCount += updateCount;
    
    // Calculate rolling average
    const alpha = 0.1; // Smoothing factor
    this.averageProcessingTime = this.averageProcessingTime * (1 - alpha) + processingTime * alpha;
  }

  /**
   * Schedule periodic performance logging
   */
  private schedulePerformanceLogging() {
    const logInterval = 60000; // 1 minute
    
    setInterval(() => {
      const now = Date.now();
      
      if (this.updateCount > 0) {
        console.log('Performance Optimizer Metrics:', {
          updatesProcessed: this.updateCount,
          averageProcessingTime: this.averageProcessingTime.toFixed(2) + 'ms',
          queueSize: this.updateQueue.length,
          timestamp: now
        });
        
        // Reset counters
        this.updateCount = 0;
      }
      
      this.lastPerformanceLog = now;
    }, logInterval);
  }

  /**
   * Get current performance metrics
   */
  getPerformanceMetrics() {
    return {
      updatesProcessed: this.updateCount,
      averageProcessingTime: this.averageProcessingTime,
      queueSize: this.updateQueue.length,
      isProcessingBatch: this.processingBatch
    };
  }

  /**
   * Clear all queued updates and reset state
   */
  reset() {
    this.updateQueue = [];
    
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }
    
    if (this.renderFrame) {
      cancelAnimationFrame(this.renderFrame);
      this.renderFrame = null;
    }
    
    this.processingBatch = false;
    this.updateCount = 0;
    this.averageProcessingTime = 0;
  }

  /**
   * Cleanup resources
   */
  dispose() {
    this.reset();
    
    // Unsubscribe all listeners
    this.listeners.forEach(unsubscribe => unsubscribe());
    this.listeners.clear();
  }
}

// Export singleton instance
export const performanceOptimizer = new PerformanceOptimizer();