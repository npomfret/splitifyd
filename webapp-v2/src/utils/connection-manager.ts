/**
 * Connection state management for real-time features
 * Monitors network quality and handles reconnection logic
 */

import { signal, computed } from '@preact/signals';

export type ConnectionQuality = 'good' | 'poor' | 'offline';

export interface ConnectionState {
  isOnline: boolean;
  quality: ConnectionQuality;
  reconnectAttempts: number;
  lastConnected: number | null;
}

export class ConnectionManager {
  private static instance: ConnectionManager;
  
  // Reactive state using Preact signals
  public isOnline = signal(navigator.onLine);
  public connectionQuality = signal<ConnectionQuality>('good');
  public reconnectAttempts = signal(0);
  public lastConnected = signal<number | null>(Date.now());
  
  // Internal state
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private qualityCheckInterval: NodeJS.Timeout | null = null;
  private pingTimeout: NodeJS.Timeout | null = null;
  private listeners: Set<(state: ConnectionState) => void> = new Set();
  
  // Configuration
  private readonly QUALITY_CHECK_INTERVAL = 10000; // 10 seconds
  private readonly PING_TIMEOUT = 5000; // 5 seconds
  private readonly MAX_RECONNECT_ATTEMPTS = 5;
  
  constructor() {
    this.setupEventListeners();
    this.startQualityMonitoring();
  }
  
  /**
   * Get singleton instance
   */
  static getInstance(): ConnectionManager {
    if (!ConnectionManager.instance) {
      ConnectionManager.instance = new ConnectionManager();
    }
    return ConnectionManager.instance;
  }
  
  /**
   * Get current connection state
   */
  get state(): ConnectionState {
    return {
      isOnline: this.isOnline.value,
      quality: this.connectionQuality.value,
      reconnectAttempts: this.reconnectAttempts.value,
      lastConnected: this.lastConnected.value
    };
  }
  
  /**
   * Subscribe to connection state changes
   */
  subscribe(callback: (state: ConnectionState) => void): () => void {
    this.listeners.add(callback);
    // Return unsubscribe function
    return () => {
      this.listeners.delete(callback);
    };
  }
  
  /**
   * Notify all listeners of state change
   */
  private notifyListeners(): void {
    const state = this.state;
    this.listeners.forEach(callback => callback(state));
  }
  
  /**
   * Setup browser event listeners
   */
  private setupEventListeners(): void {
    // Online/offline events
    window.addEventListener('online', () => {
      console.log('[ConnectionManager] Network online');
      this.handleOnline();
    });
    
    window.addEventListener('offline', () => {
      console.log('[ConnectionManager] Network offline');
      this.handleOffline();
    });
    
    // Page visibility change
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && this.isOnline.value) {
        // Check connection quality when page becomes visible
        this.checkConnectionQuality();
      }
    });
    
    // Network information API (if available)
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      if (connection) {
        connection.addEventListener('change', () => {
          this.updateConnectionQuality();
        });
      }
    }
  }
  
  /**
   * Handle coming online
   */
  private handleOnline(): void {
    this.isOnline.value = true;
    this.reconnectAttempts.value = 0;
    this.lastConnected.value = Date.now();
    this.connectionQuality.value = 'good';
    this.notifyListeners();
    
    // Clear any pending reconnect
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    // Restart quality monitoring
    this.startQualityMonitoring();
  }
  
  /**
   * Handle going offline
   */
  private handleOffline(): void {
    this.isOnline.value = false;
    this.connectionQuality.value = 'offline';
    this.notifyListeners();
    
    // Stop quality monitoring
    this.stopQualityMonitoring();
  }
  
  /**
   * Start monitoring connection quality
   */
  private startQualityMonitoring(): void {
    // Clear existing interval if any
    this.stopQualityMonitoring();
    
    // Initial quality check
    this.checkConnectionQuality();
    
    // Setup periodic checks
    this.qualityCheckInterval = setInterval(() => {
      if (this.isOnline.value) {
        this.checkConnectionQuality();
      }
    }, this.QUALITY_CHECK_INTERVAL);
  }
  
  /**
   * Stop monitoring connection quality
   */
  private stopQualityMonitoring(): void {
    if (this.qualityCheckInterval) {
      clearInterval(this.qualityCheckInterval);
      this.qualityCheckInterval = null;
    }
    
    if (this.pingTimeout) {
      clearTimeout(this.pingTimeout);
      this.pingTimeout = null;
    }
  }
  
  /**
   * Check connection quality by attempting a lightweight request
   */
  private async checkConnectionQuality(): Promise<void> {
    if (!this.isOnline.value) return;
    
    try {
      // Attempt a lightweight request to check connectivity
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.PING_TIMEOUT);
      
      const startTime = Date.now();
      const response = await fetch('/api/health', {
        method: 'HEAD',
        signal: controller.signal,
        cache: 'no-cache'
      }).catch(() => null);
      
      clearTimeout(timeoutId);
      const responseTime = Date.now() - startTime;
      
      if (response && response.ok) {
        // Update quality based on response time
        if (responseTime < 1000) {
          this.connectionQuality.value = 'good';
        } else if (responseTime < 3000) {
          this.connectionQuality.value = 'poor';
        } else {
          this.connectionQuality.value = 'poor';
        }
      } else {
        // Request failed but we're online - poor connection
        this.connectionQuality.value = 'poor';
      }
    } catch (error) {
      // Error checking quality - assume poor
      this.connectionQuality.value = 'poor';
    }
    
    this.notifyListeners();
  }
  
  /**
   * Update connection quality based on Network Information API
   */
  private updateConnectionQuality(): void {
    if (!('connection' in navigator)) return;
    
    const connection = (navigator as any).connection;
    if (!connection) return;
    
    const { rtt, downlink, effectiveType } = connection;
    
    // Determine quality based on network metrics
    if (effectiveType === '4g' && rtt < 100) {
      this.connectionQuality.value = 'good';
    } else if (effectiveType === '3g' || (effectiveType === '4g' && rtt < 300)) {
      this.connectionQuality.value = 'poor';
    } else if (effectiveType === 'slow-2g' || effectiveType === '2g') {
      this.connectionQuality.value = 'poor';
    } else if (rtt && rtt < 150) {
      this.connectionQuality.value = 'good';
    } else if (rtt && rtt < 400) {
      this.connectionQuality.value = 'poor';
    } else {
      // Keep current quality if we can't determine
    }
    
    this.notifyListeners();
  }
  
  /**
   * Attempt to reconnect with exponential backoff
   */
  async reconnectWithBackoff(callback: () => Promise<void>): Promise<void> {
    if (this.reconnectAttempts.value >= this.MAX_RECONNECT_ATTEMPTS) {
      console.warn('[ConnectionManager] Max reconnect attempts reached');
      return;
    }
    
    // Exponential backoff delays
    const delays = [1000, 2000, 4000, 8000, 16000];
    const delay = delays[Math.min(this.reconnectAttempts.value, delays.length - 1)];
    
    // Clear any existing reconnect timeout
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    
    console.log(`[ConnectionManager] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts.value + 1})`);
    
    this.reconnectTimeout = setTimeout(async () => {
      try {
        await callback();
        // Success - reset attempts
        this.reconnectAttempts.value = 0;
        console.log('[ConnectionManager] Reconnection successful');
      } catch (error) {
        // Failed - increment attempts and retry
        this.reconnectAttempts.value++;
        console.error('[ConnectionManager] Reconnection failed:', error);
        
        if (this.reconnectAttempts.value < this.MAX_RECONNECT_ATTEMPTS) {
          this.reconnectWithBackoff(callback);
        }
      }
    }, delay);
  }
  
  /**
   * Cancel pending reconnection attempt
   */
  cancelReconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    this.reconnectAttempts.value = 0;
  }
  
  /**
   * Force a connection quality check
   */
  async forceQualityCheck(): Promise<ConnectionQuality> {
    await this.checkConnectionQuality();
    return this.connectionQuality.value;
  }
  
  /**
   * Clean up resources
   */
  dispose(): void {
    this.stopQualityMonitoring();
    this.cancelReconnect();
    this.listeners.clear();
  }
}

// Export singleton instance
export const connectionManager = ConnectionManager.getInstance();