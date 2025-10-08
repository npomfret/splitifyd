/**
 * Lightweight In-Memory Metrics System
 *
 * Simple metrics collection with:
 * - 5% sampling rate
 * - Bounded circular buffers (max 100 per type)
 * - No Firestore storage
 * - Same behavior in all environments
 */

export interface Metric {
    timestamp: number;
    operation: string;
    duration: number;
    success: boolean;
}

export type MetricType = 'api' | 'db' | 'trigger';

/**
 * Circular buffer implementation for bounded collections
 */
class CircularBuffer<T extends { timestamp: number; }> {
    private buffer: T[] = [];
    private pointer = 0;

    constructor(private maxSize: number) {}

    add(item: T): void {
        if (this.buffer.length < this.maxSize) {
            this.buffer.push(item);
        } else {
            this.buffer[this.pointer] = item;
            this.pointer = (this.pointer + 1) % this.maxSize;
        }
    }

    toArray(): T[] {
        return [...this.buffer];
    }

    clear(): void {
        this.buffer = [];
        this.pointer = 0;
    }

    clearOlderThan(timestamp: number): void {
        this.buffer = this.buffer.filter((item) => item.timestamp >= timestamp);
        this.pointer = 0;
    }

    size(): number {
        return this.buffer.length;
    }
}

/**
 * Main metrics collector
 */
export class LightweightMetrics {
    private static instance: LightweightMetrics;

    // Circular buffers - max 100 entries each
    private apiMetrics: CircularBuffer<Metric> = new CircularBuffer(100);
    private dbMetrics: CircularBuffer<Metric> = new CircularBuffer(100);
    private triggerMetrics: CircularBuffer<Metric> = new CircularBuffer(100);

    // 5% sampling rate
    private readonly SAMPLE_RATE = 0.05;

    private constructor() {}

    static getInstance(): LightweightMetrics {
        if (!LightweightMetrics.instance) {
            LightweightMetrics.instance = new LightweightMetrics();
        }
        return LightweightMetrics.instance;
    }

    /**
     * Record a metric with 5% sampling
     */
    record(type: MetricType, operation: string, duration: number, success: boolean): void {
        // Simple random sampling
        if (Math.random() > this.SAMPLE_RATE) return;

        const metric: Metric = {
            timestamp: Date.now(),
            operation,
            duration,
            success,
        };

        // Add to appropriate buffer (overwrites oldest when full)
        switch (type) {
            case 'api':
                this.apiMetrics.add(metric);
                break;
            case 'db':
                this.dbMetrics.add(metric);
                break;
            case 'trigger':
                this.triggerMetrics.add(metric);
                break;
        }
    }

    /**
     * Get snapshot of all metrics
     */
    getSnapshot(): { api: Metric[]; db: Metric[]; trigger: Metric[]; } {
        return {
            api: this.apiMetrics.toArray(),
            db: this.dbMetrics.toArray(),
            trigger: this.triggerMetrics.toArray(),
        };
    }

    /**
     * Clear metrics older than specified timestamp
     */
    clearOlderThan(timestamp: number): void {
        this.apiMetrics.clearOlderThan(timestamp);
        this.dbMetrics.clearOlderThan(timestamp);
        this.triggerMetrics.clearOlderThan(timestamp);
    }

    /**
     * Clear all metrics
     */
    clear(): void {
        this.apiMetrics.clear();
        this.dbMetrics.clear();
        this.triggerMetrics.clear();
    }

    /**
     * Get memory usage stats
     */
    getStats(): {
        totalMetrics: number;
        apiCount: number;
        dbCount: number;
        triggerCount: number;
    } {
        return {
            totalMetrics: this.apiMetrics.size() + this.dbMetrics.size() + this.triggerMetrics.size(),
            apiCount: this.apiMetrics.size(),
            dbCount: this.dbMetrics.size(),
            triggerCount: this.triggerMetrics.size(),
        };
    }
}

// Export singleton instance
export const metrics = LightweightMetrics.getInstance();
