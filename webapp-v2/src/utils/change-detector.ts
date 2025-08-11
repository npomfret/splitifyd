import { collection, query, where, orderBy, limit, onSnapshot, Unsubscribe } from 'firebase/firestore';
import { getDb } from '../app/firebase';
import { ConnectionManager } from './connection-manager';

export interface ChangeNotification {
  groupId?: string;
  expenseId?: string;
  timestamp: number;
  type: 'created' | 'modified' | 'deleted';
  userId: string;
  fields: string[];
  metadata: {
    priority: 'high' | 'medium' | 'low';
    affectedUsers: string[];
  };
}

export type ChangeCallback = (change: ChangeNotification) => void;

export class ChangeDetector {
  private static instance: ChangeDetector;
  private listeners = new Map<string, Unsubscribe>();
  private callbacks = new Map<string, Set<ChangeCallback>>();
  private connectionManager = ConnectionManager.getInstance();
  private lastChangeTimestamp = 0;
  private refreshTimeouts = new Map<string, NodeJS.Timeout>();
  
  private constructor() {}
  
  static getInstance(): ChangeDetector {
    if (!ChangeDetector.instance) {
      ChangeDetector.instance = new ChangeDetector();
    }
    return ChangeDetector.instance;
  }
  
  /**
   * Subscribe to group changes for a user
   */
  subscribeToGroupChanges(userId: string, callback: ChangeCallback): () => void {
    const key = `groups-${userId}`;
    
    // Add callback
    if (!this.callbacks.has(key)) {
      this.callbacks.set(key, new Set());
    }
    this.callbacks.get(key)!.add(callback);
    
    // Start listener if not already running
    if (!this.listeners.has(key)) {
      this.startGroupListener(userId, key);
    }
    
    // Return unsubscribe function
    return () => {
      const callbacks = this.callbacks.get(key);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          this.stopListener(key);
        }
      }
    };
  }
  
  /**
   * Subscribe to expense changes for a group
   */
  subscribeToExpenseChanges(groupId: string, userId: string, callback: ChangeCallback): () => void {
    const key = `expenses-${groupId}-${userId}`;
    
    // Add callback
    if (!this.callbacks.has(key)) {
      this.callbacks.set(key, new Set());
    }
    this.callbacks.get(key)!.add(callback);
    
    // Start listener if not already running
    if (!this.listeners.has(key)) {
      this.startExpenseListener(groupId, userId, key);
    }
    
    // Return unsubscribe function
    return () => {
      const callbacks = this.callbacks.get(key);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          this.stopListener(key);
        }
      }
    };
  }
  
  private startGroupListener(userId: string, key: string) {
    const changesQuery = query(
      collection(getDb(), 'group-changes'),
      where('timestamp', '>', Date.now() - 300000), // Last 5 minutes
      where('metadata.affectedUsers', 'array-contains', userId),
      orderBy('timestamp', 'desc'),
      limit(1)
    );
    
    const unsubscribe = onSnapshot(
      changesQuery,
      { includeMetadataChanges: false },
      (snapshot) => {
        if (!snapshot.empty && !snapshot.metadata.fromCache) {
          const change = snapshot.docs[0].data() as ChangeNotification;
          
          // Skip old changes
          if (change.timestamp <= this.lastChangeTimestamp) {
            return;
          }
          
          // Check if we should process this change
          if (this.shouldProcessChange(change, userId)) {
            this.scheduleCallback(key, change);
            this.lastChangeTimestamp = change.timestamp;
          }
        }
      },
      (error) => {
        console.warn('Group change listener error, falling back to polling:', error);
        this.handleListenerError(key, userId, 'group');
      }
    );
    
    this.listeners.set(key, unsubscribe);
  }
  
  private startExpenseListener(groupId: string, userId: string, key: string) {
    const changesQuery = query(
      collection(getDb(), 'expense-changes'),
      where('groupId', '==', groupId),
      where('timestamp', '>', Date.now() - 300000), // Last 5 minutes
      orderBy('timestamp', 'desc'),
      limit(1)
    );
    
    const unsubscribe = onSnapshot(
      changesQuery,
      { includeMetadataChanges: false },
      (snapshot) => {
        if (!snapshot.empty && !snapshot.metadata.fromCache) {
          const change = snapshot.docs[0].data() as ChangeNotification;
          
          // Skip old changes
          if (change.timestamp <= this.lastChangeTimestamp) {
            return;
          }
          
          // Check if we should process this change
          if (this.shouldProcessChange(change, userId)) {
            this.scheduleCallback(key, change);
            this.lastChangeTimestamp = change.timestamp;
          }
        }
      },
      (error) => {
        console.warn('Expense change listener error, falling back to polling:', error);
        this.handleListenerError(key, userId, 'expense');
      }
    );
    
    this.listeners.set(key, unsubscribe);
  }
  
  private shouldProcessChange(change: ChangeNotification, userId: string): boolean {
    // Skip non-critical fields for current user's changes
    if (change.userId === userId) {
      const nonCriticalFields = ['lastViewed', 'analytics', 'metadata'];
      if (change.fields?.every(f => nonCriticalFields.includes(f))) {
        return false;
      }
    }
    
    // Process based on priority and connection quality
    const quality = this.connectionManager.connectionQuality.value;
    
    switch (change.metadata?.priority) {
      case 'high':
        return true;
      case 'medium':
        // Skip medium priority on poor connection if from same user
        return quality !== 'poor' || change.userId !== userId;
      case 'low':
        // Only process low priority on good connection
        return quality === 'good';
      default:
        return true;
    }
  }
  
  private scheduleCallback(key: string, change: ChangeNotification) {
    // Cancel any pending callback for this key
    if (this.refreshTimeouts.has(key)) {
      clearTimeout(this.refreshTimeouts.get(key)!);
    }
    
    // Determine delay based on priority and connection
    const quality = this.connectionManager.connectionQuality.value;
    let delay = 100; // Default for high priority
    
    if (change.metadata?.priority === 'medium') {
      delay = quality === 'poor' ? 2000 : 500;
    } else if (change.metadata?.priority === 'low') {
      delay = quality === 'poor' ? 5000 : 1000;
    }
    
    // Schedule callback
    const timeout = setTimeout(() => {
      const callbacks = this.callbacks.get(key);
      if (callbacks) {
        callbacks.forEach(callback => {
          try {
            callback(change);
          } catch (error) {
            console.error('Change callback error:', error);
          }
        });
      }
      this.refreshTimeouts.delete(key);
    }, delay);
    
    this.refreshTimeouts.set(key, timeout);
  }
  
  private handleListenerError(key: string, userId: string, type: 'group' | 'expense') {
    // Stop the failed listener
    this.stopListener(key);
    
    // Implement exponential backoff retry
    let retryCount = 0;
    const maxRetries = 3;
    
    const retry = () => {
      if (retryCount >= maxRetries) {
        console.error(`Failed to restart ${type} listener after ${maxRetries} attempts`);
        // Notify callbacks that streaming is unavailable
        const callbacks = this.callbacks.get(key);
        if (callbacks) {
          callbacks.forEach(callback => {
            callback({
              timestamp: Date.now(),
              type: 'modified',
              userId: 'system',
              fields: ['*'],
              metadata: {
                priority: 'low',
                affectedUsers: [userId]
              }
            } as ChangeNotification);
          });
        }
        return;
      }
      
      retryCount++;
      const delay = Math.min(1000 * Math.pow(2, retryCount), 30000);
      
      setTimeout(() => {
        if (this.callbacks.has(key) && this.callbacks.get(key)!.size > 0) {
          if (type === 'group') {
            this.startGroupListener(userId, key);
          } else {
            // Extract groupId from key
            const parts = key.split('-');
            const groupId = parts[1];
            this.startExpenseListener(groupId, userId, key);
          }
        }
      }, delay);
    };
    
    retry();
  }
  
  private stopListener(key: string) {
    const unsubscribe = this.listeners.get(key);
    if (unsubscribe) {
      unsubscribe();
      this.listeners.delete(key);
    }
    
    const timeout = this.refreshTimeouts.get(key);
    if (timeout) {
      clearTimeout(timeout);
      this.refreshTimeouts.delete(key);
    }
    
    this.callbacks.delete(key);
  }
  
  /**
   * Clean up all listeners
   */
  dispose() {
    this.listeners.forEach(unsubscribe => unsubscribe());
    this.listeners.clear();
    
    this.refreshTimeouts.forEach(timeout => clearTimeout(timeout));
    this.refreshTimeouts.clear();
    
    this.callbacks.clear();
  }
}