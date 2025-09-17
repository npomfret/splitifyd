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

}

// Export singleton instance
export const streamingMetrics = new StreamingMetricsCollector();
