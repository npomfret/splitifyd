import { signal } from '@preact/signals';
import { logError, logInfo, logWarning } from './browser-logger';

// Health check configuration
const HEALTH_CHECK_INTERVAL = 30000; // 30 seconds
const SERVER_CHECK_TIMEOUT = 5000; // 5 seconds

interface NetworkInformation extends EventTarget {
    effectiveType?: '2g' | '3g' | '4g' | 'slow-2g';
    rtt?: number;
    downlink?: number;
    saveData?: boolean;
}

interface NavigatorWithConnection extends Navigator {
    connection?: NetworkInformation;
}

export type ConnectionQuality = 'good' | 'poor' | 'offline' | 'server-unavailable';

export interface ConnectionState {
    isOnline: boolean;
    quality: ConnectionQuality;
    reconnectAttempts: number;
    lastServerCheck?: number;
}

interface ReconnectOptions {
    maxAttempts?: number;
    baseDelay?: number;
    maxDelay?: number;
}

export class ConnectionManager {
    private static instance: ConnectionManager;

    public readonly isOnline = signal<boolean>(navigator.onLine);
    public readonly connectionQuality = signal<ConnectionQuality>('good');
    public readonly reconnectAttempts = signal<number>(0);

    private reconnectTimeouts = new Map<string, ReturnType<typeof setTimeout>>();
    private listeners = new Set<() => void>();
    private connectionChangeHandler: (() => void) | null = null;
    private healthCheckInterval: ReturnType<typeof setInterval> | null = null;
    private lastServerCheck = 0;

    private constructor() {
        this.setupEventListeners();
        this.monitorConnectionQuality();
        this.startServerHealthChecks();
    }

    static getInstance(): ConnectionManager {
        if (!ConnectionManager.instance) {
            ConnectionManager.instance = new ConnectionManager();
        }
        return ConnectionManager.instance;
    }

    private setupEventListeners(): void {
        const handleOnline = () => {
            this.isOnline.value = true;
            this.reconnectAttempts.value = 0;
            this.connectionQuality.value = 'good';
            this.clearAllReconnectTimeouts();
            this.notifyListeners();
        };

        const handleOffline = () => {
            this.isOnline.value = false;
            this.connectionQuality.value = 'offline';
            this.notifyListeners();
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        // Store for cleanup
        this.listeners.add(() => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        });
    }

    private monitorConnectionQuality(): void {
        const nav = navigator as NavigatorWithConnection;

        if (!nav.connection) {
            return; // Network Information API not supported
        }

        const updateQuality = () => {
            if (!this.isOnline.value) {
                this.connectionQuality.value = 'offline';
                return;
            }

            const connection = nav.connection!;
            const rtt = connection.rtt || 0;
            const effectiveType = connection.effectiveType || '4g';

            // Determine quality based on RTT and connection type
            if (rtt < 150 && (effectiveType === '4g' || effectiveType === '3g')) {
                this.connectionQuality.value = 'good';
            } else if (rtt < 300 || effectiveType === '3g') {
                this.connectionQuality.value = 'poor';
            } else {
                this.connectionQuality.value = 'poor';
            }
        };

        this.connectionChangeHandler = updateQuality;
        nav.connection.addEventListener('change', updateQuality);

        // Initial quality check
        updateQuality();

        // Store for cleanup
        this.listeners.add(() => {
            if (nav.connection && this.connectionChangeHandler) {
                nav.connection.removeEventListener('change', this.connectionChangeHandler);
            }
        });
    }

    private startServerHealthChecks(): void {
        // Initial check
        this.checkServerHealth();

        // Set up periodic checks
        this.healthCheckInterval = setInterval(() => {
            this.checkServerHealth();
        }, HEALTH_CHECK_INTERVAL);

        // Store for cleanup
        this.listeners.add(() => {
            if (this.healthCheckInterval) {
                clearInterval(this.healthCheckInterval);
                this.healthCheckInterval = null;
            }
        });
    }

    private async checkServerHealth(): Promise<void> {
        if (!this.isOnline.value) {
            return; // Don't check server if we're offline
        }

        if (typeof window === 'undefined') {
            return; // Skip health checks during SSR
        }

        this.lastServerCheck = Date.now();

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), SERVER_CHECK_TIMEOUT);

            const response = await fetch(`/api/health`, {
                method: 'GET',
                signal: controller.signal,
                cache: 'no-cache',
            });

            clearTimeout(timeoutId);

            if (response.ok) {
                // Server is responding, determine quality based on network conditions
                if (this.connectionQuality.value === 'server-unavailable') {
                    // Server came back online, reset to good quality
                    this.connectionQuality.value = 'good';
                    logInfo('API server connection restored');
                }
            } else {
                // Server responded but with error status
                this.connectionQuality.value = 'server-unavailable';
                logWarning('API server returned error status', { status: response.status });
            }
        } catch (error) {
            // Server is not reachable
            if (this.connectionQuality.value !== 'server-unavailable') {
                this.connectionQuality.value = 'server-unavailable';
                logWarning('API server not reachable', { error: error instanceof Error ? error.message : String(error) });
            }
        }
    }

    async reconnectWithBackoff(key: string, callback: () => Promise<void>, options: ReconnectOptions = {}): Promise<void> {
        const { maxAttempts = 5, baseDelay = 1000, maxDelay = 30000 } = options;

        // Clear any existing timeout for this key
        this.clearReconnectTimeout(key);

        if (this.reconnectAttempts.value >= maxAttempts) {
            logWarning(`Max reconnect attempts reached for ${key}`, { maxAttempts });
            return;
        }

        // Calculate delay with exponential backoff
        const attempt = this.reconnectAttempts.value;
        const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);

        const timeoutId = setTimeout(async () => {
            try {
                await callback();
                // Success - reset attempts
                this.reconnectAttempts.value = 0;
                this.reconnectTimeouts.delete(key);
            } catch (error) {
                // Failure - increment attempts and retry
                this.reconnectAttempts.value++;
                logInfo('Reconnect attempt failed', {
                    key,
                    attempt: this.reconnectAttempts.value,
                    error: error instanceof Error ? error.message : String(error),
                });

                // Retry if we haven't hit the limit
                if (this.reconnectAttempts.value < maxAttempts) {
                    await this.reconnectWithBackoff(key, callback, options);
                }
            }
        }, delay);

        this.reconnectTimeouts.set(key, timeoutId);
    }

    private clearReconnectTimeout(key: string): void {
        const timeout = this.reconnectTimeouts.get(key);
        if (timeout) {
            clearTimeout(timeout);
            this.reconnectTimeouts.delete(key);
        }
    }

    private clearAllReconnectTimeouts(): void {
        this.reconnectTimeouts.forEach((timeout) => clearTimeout(timeout));
        this.reconnectTimeouts.clear();
    }

    private notifyListeners(): void {
        // Notify any registered state change listeners
        this.listeners.forEach((listener) => {
            try {
                listener();
            } catch (error) {
                logError('Error in connection state listener', { error });
            }
        });
    }

    getState(): ConnectionState {
        return {
            isOnline: this.isOnline.value,
            quality: this.connectionQuality.value,
            reconnectAttempts: this.reconnectAttempts.value,
            lastServerCheck: this.lastServerCheck,
        };
    }

    dispose(): void {
        this.clearAllReconnectTimeouts();
        this.listeners.forEach((cleanup) => cleanup());
        this.listeners.clear();
    }
}
