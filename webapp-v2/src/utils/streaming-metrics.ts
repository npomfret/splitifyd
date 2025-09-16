/**
 * Simple metrics collection for monitoring streaming implementation performance
 */

export interface StreamingMetrics {
    notificationCount: number;
    restRefreshCount: number;
    subscriptionErrorCount: number;
    subscriptionRetryCount: number;
    averageRefreshLatency: number;
    lastRefreshTimestamp: number;
    connectionErrors: number;
    fallbackToPolling: number;
}

export interface MetricsSnapshot extends StreamingMetrics {
    timestamp: number;
    estimatedFirestoreReads: number;
    estimatedMonthlyCost: number;
}

class StreamingMetricsCollector {
    private metrics: StreamingMetrics = {
        notificationCount: 0,
        restRefreshCount: 0,
        subscriptionErrorCount: 0,
        subscriptionRetryCount: 0,
        averageRefreshLatency: 0,
        lastRefreshTimestamp: 0,
        connectionErrors: 0,
        fallbackToPolling: 0,
    };

    private refreshLatencies: number[] = [];
    private readonly MAX_LATENCY_SAMPLES = 100;

    /**
     * Track a notification received
     */
    trackNotification(): void {
        this.metrics.notificationCount++;
    }

    /**
     * Track a REST API refresh with latency
     */
    trackRestRefresh(latencyMs: number): void {
        this.metrics.restRefreshCount++;
        this.metrics.lastRefreshTimestamp = Date.now();

        // Update rolling average latency
        this.refreshLatencies.push(latencyMs);
        if (this.refreshLatencies.length > this.MAX_LATENCY_SAMPLES) {
            this.refreshLatencies.shift();
        }

        this.metrics.averageRefreshLatency = this.refreshLatencies.reduce((sum, lat) => sum + lat, 0) / this.refreshLatencies.length;
    }

    /**
     * Track subscription errors
     */
    trackSubscriptionError(): void {
        this.metrics.subscriptionErrorCount++;
    }

    /**
     * Track subscription retries
     */
    trackSubscriptionRetry(): void {
        this.metrics.subscriptionRetryCount++;
    }

    /**
     * Track connection errors
     */
    trackConnectionError(): void {
        this.metrics.connectionErrors++;
    }

    /**
     * Track fallback to polling
     */
    trackPollingFallback(): void {
        this.metrics.fallbackToPolling++;
    }

    /**
     * Get current metrics snapshot
     */
    getSnapshot(): MetricsSnapshot {
        const estimatedFirestoreReads = this.estimateFirestoreReads();
        const estimatedMonthlyCost = this.estimateMonthlyCost(estimatedFirestoreReads);

        return {
            ...this.metrics,
            timestamp: Date.now(),
            estimatedFirestoreReads,
            estimatedMonthlyCost,
        };
    }

    /**
     * Reset all metrics
     */
    reset(): void {
        this.metrics = {
            notificationCount: 0,
            restRefreshCount: 0,
            subscriptionErrorCount: 0,
            subscriptionRetryCount: 0,
            averageRefreshLatency: 0,
            lastRefreshTimestamp: 0,
            connectionErrors: 0,
            fallbackToPolling: 0,
        };
        this.refreshLatencies = [];
    }

    private estimateFirestoreReads(): number {
        // Rough estimate:
        // - Each notification: 1 read
        // - Each REST refresh: ~20 reads (groups + metadata)
        return this.metrics.notificationCount + this.metrics.restRefreshCount * 20;
    }

    private estimateMonthlyCost(totalReads: number): number {
        // Firestore pricing: ~$0.00006 per read (approximate)
        return totalReads * 0.00006;
    }

    private estimateReadsPerHour(): number {
        // const nowMs = Date.now();
        // const oneHourAgo = nowMs - (60 * 60 * 1000);

        // Simple estimation - could be made more accurate with time windows
        const estimatedReads = this.estimateFirestoreReads();
        return estimatedReads; // Simplified - real implementation would track time windows
    }

    private calculateRefreshRate(): string {
        if (this.metrics.restRefreshCount === 0) return '0 refreshes';

        const timeSinceFirst = Date.now() - this.metrics.lastRefreshTimestamp;
        const ratePerMinute = this.metrics.restRefreshCount / (timeSinceFirst / 60000);
        return `${ratePerMinute.toFixed(2)}/min`;
    }

    private calculateErrorRate(): string {
        const totalOperations = this.metrics.notificationCount + this.metrics.restRefreshCount;
        if (totalOperations === 0) return '0%';

        const totalErrors = this.metrics.subscriptionErrorCount + this.metrics.connectionErrors;
        const errorRate = (totalErrors / totalOperations) * 100;
        return `${errorRate.toFixed(2)}%`;
    }
}

// Export singleton instance
export const streamingMetrics = new StreamingMetricsCollector();
