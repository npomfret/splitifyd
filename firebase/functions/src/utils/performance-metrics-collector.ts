
import { logger } from '../logger';

/**
 * Circular buffer to store metrics for a single operation
 */
interface OperationMetricBuffer {
    metrics: OperationMetric[];
    cursor: number;
    size: number; // Current number of metrics (may be less than maxSize)
    maxSize: number;
    lastUpdated: number; // Timestamp of last metric added
}

/**
 * Collects and aggregates performance metrics over time
 */
export class PerformanceMetricsCollector {
    private static instance: PerformanceMetricsCollector;
    private metrics: Map<string, OperationMetricBuffer> = new Map();
    private readonly maxMetricsPerOperation = 1000; // Keep last 1000 executions per operation
    private readonly reportingInterval = 5 * 60 * 1000; // 5 minutes
    private readonly staleThreshold = 3; // Remove operations stale for 3x reporting intervals
    private lastReportTime = Date.now();
    private reportingIntervalId?: NodeJS.Timeout;
    private readonly isTestEnvironment: boolean;

    private constructor() {
        // Detect test environment
        this.isTestEnvironment = this.detectTestEnvironment();
        
        // Start periodic reporting only in non-test environments
        if (!this.isTestEnvironment) {
            this.startPeriodicReporting();
        }
    }

    private detectTestEnvironment(): boolean {
        return !!(
            process.env.NODE_ENV === 'test' ||
            process.env.VITEST === 'true' ||
            (global as any).__vitest__ ||
            process.argv.some(arg => arg.includes('vitest')) ||
            process.argv.some(arg => arg.includes('jest'))
        );
    }

    static getInstance(): PerformanceMetricsCollector {
        if (!PerformanceMetricsCollector.instance) {
            PerformanceMetricsCollector.instance = new PerformanceMetricsCollector();
        }
        return PerformanceMetricsCollector.instance;
    }

    /**
     * Record a performance metric
     */
    recordMetric(operationName: string, metric: OperationMetric): void {
        if (!this.metrics.has(operationName)) {
            this.metrics.set(operationName, {
                metrics: new Array(this.maxMetricsPerOperation),
                cursor: 0,
                size: 0,
                maxSize: this.maxMetricsPerOperation,
                lastUpdated: Date.now()
            });
        }

        const buffer = this.metrics.get(operationName)!;
        
        // Store metric at current cursor position
        buffer.metrics[buffer.cursor] = metric;
        buffer.lastUpdated = Date.now();
        
        // Advance cursor (wraps around)
        buffer.cursor = (buffer.cursor + 1) % buffer.maxSize;
        
        // Update size only if buffer isn't full yet
        if (buffer.size < buffer.maxSize) {
            buffer.size++;
        }

        // Check for immediate alerts
        this.checkForAlerts(operationName, metric);
    }

    /**
     * Get all metrics from a circular buffer in chronological order (oldest first)
     */
    private getMetricsFromBuffer(buffer: OperationMetricBuffer): OperationMetric[] {
        if (buffer.size === 0) {
            return [];
        }

        const metrics: OperationMetric[] = [];
        
        if (buffer.size < buffer.maxSize) {
            // Buffer not full yet, return metrics from start to cursor
            for (let i = 0; i < buffer.size; i++) {
                metrics.push(buffer.metrics[i]);
            }
        } else {
            // Buffer is full, need to handle wrap-around
            // Start from the oldest entry (at cursor position) and wrap around
            for (let i = 0; i < buffer.maxSize; i++) {
                const index = (buffer.cursor + i) % buffer.maxSize;
                metrics.push(buffer.metrics[index]);
            }
        }
        
        return metrics;
    }

    /**
     * Get the last N metrics from a buffer in chronological order
     */
    private getLastNMetricsFromBuffer(buffer: OperationMetricBuffer, n: number): OperationMetric[] {
        const allMetrics = this.getMetricsFromBuffer(buffer);
        return allMetrics.slice(-n);
    }

    /**
     * Record a service call completion
     */
    recordServiceCall(
        serviceName: string,
        methodName: string,
        duration: number,
        success: boolean,
        context: Record<string, any> = {}
    ): void {
        const operationName = `${serviceName}.${methodName}`;
        
        this.recordMetric(operationName, {
            timestamp: new Date(),
            duration,
            success,
            operationType: 'service-call',
            serviceName,
            methodName,
            context
        });
    }

    /**
     * Record a database operation completion
     */
    recordDbOperation(
        operationType: 'read' | 'write' | 'query' | 'transaction',
        collection: string,
        duration: number,
        success: boolean,
        resultCount?: number,
        context: Record<string, any> = {}
    ): void {
        const operationName = `db-${operationType}-${collection}`;
        
        this.recordMetric(operationName, {
            timestamp: new Date(),
            duration,
            success,
            operationType: 'database',
            collection,
            dbOperationType: operationType,
            resultCount,
            context
        });
    }

    /**
     * Record a batch operation completion
     */
    recordBatchOperation(
        operationName: string,
        duration: number,
        success: boolean,
        stepCount: number,
        batchSize?: number,
        context: Record<string, any> = {}
    ): void {
        this.recordMetric(`batch-${operationName}`, {
            timestamp: new Date(),
            duration,
            success,
            operationType: 'batch',
            batchOperationName: operationName,
            stepCount,
            batchSize,
            context
        });
    }

    /**
     * Check for performance alerts
     */
    private checkForAlerts(operationName: string, metric: OperationMetric): void {
        const buffer = this.metrics.get(operationName)!;
        
        // Alert on slow operations
        const slowThreshold = this.getSlowThreshold(metric.operationType);
        if (metric.duration > slowThreshold) {
            logger.warn('Slow operation detected', {
                operationName,
                duration_ms: metric.duration,
                threshold_ms: slowThreshold,
                operationType: metric.operationType,
                success: metric.success,
                context: metric.context
            });
        }

        // Alert on high failure rates (if we have enough data)
        if (buffer.size >= 10) {
            const recentMetrics = this.getLastNMetricsFromBuffer(buffer, 10);
            const failures = recentMetrics.filter(m => !m.success).length;
            const failureRate = failures / recentMetrics.length;
            
            if (failureRate > 0.2) { // 20% failure rate
                logger.warn('High failure rate detected', {
                    operationName,
                    failureRate: Math.round(failureRate * 100),
                    recentFailures: failures,
                    totalRecent: recentMetrics.length,
                    operationType: metric.operationType
                });
            }
        }

        // Alert on performance degradation
        if (buffer.size >= 20) {
            const allMetrics = this.getMetricsFromBuffer(buffer);
            const recentMetrics = allMetrics.slice(-10);
            const olderMetrics = allMetrics.slice(-20, -10);
            
            const recentAvg = recentMetrics
                .filter(m => m.success)
                .reduce((sum, m) => sum + m.duration, 0) / recentMetrics.filter(m => m.success).length;
            
            const olderAvg = olderMetrics
                .filter(m => m.success)
                .reduce((sum, m) => sum + m.duration, 0) / olderMetrics.filter(m => m.success).length;
            
            if (recentAvg > olderAvg * 1.5 && recentAvg > 200) { // 50% slower and > 200ms
                logger.warn('Performance degradation detected', {
                    operationName,
                    recentAverage_ms: Math.round(recentAvg),
                    previousAverage_ms: Math.round(olderAvg),
                    degradationFactor: Math.round(recentAvg / olderAvg * 100) / 100,
                    operationType: metric.operationType
                });
            }
        }
    }

    /**
     * Get slow threshold for operation type
     */
    private getSlowThreshold(operationType: string): number {
        switch (operationType) {
            case 'service-call': return 1000;
            case 'database': return 500;
            case 'batch': return 2000;
            case 'validation': return 100;
            default: return 1000;
        }
    }

    /**
     * Get aggregated statistics for an operation
     */
    getOperationStats(operationName: string): OperationStats | null {
        const buffer = this.metrics.get(operationName);
        if (!buffer || buffer.size === 0) {
            return null;
        }

        const metrics = this.getMetricsFromBuffer(buffer);
        const successfulMetrics = metrics.filter(m => m.success);
        const failedMetrics = metrics.filter(m => !m.success);
        
        if (successfulMetrics.length === 0) {
            return null;
        }

        const durations = successfulMetrics.map(m => m.duration).sort((a, b) => a - b);
        const now = Date.now();
        const oneHourAgo = now - (60 * 60 * 1000);
        const recentMetrics = metrics.filter(m => m.timestamp.getTime() > oneHourAgo);

        return {
            operationName,
            operationType: metrics[0].operationType,
            totalExecutions: metrics.length,
            successfulExecutions: successfulMetrics.length,
            failedExecutions: failedMetrics.length,
            successRate: successfulMetrics.length / metrics.length,
            averageDuration: durations.reduce((sum, d) => sum + d, 0) / durations.length,
            medianDuration: durations[Math.floor(durations.length / 2)],
            p95Duration: durations[Math.floor(durations.length * 0.95)],
            p99Duration: durations[Math.floor(durations.length * 0.99)],
            minDuration: durations[0],
            maxDuration: durations[durations.length - 1],
            recentExecutions: recentMetrics.length,
            recentSuccessRate: recentMetrics.length > 0 ? 
                recentMetrics.filter(m => m.success).length / recentMetrics.length : 0,
            lastExecuted: metrics[metrics.length - 1].timestamp,
            firstExecuted: metrics[0].timestamp
        };
    }

    /**
     * Get performance summary for all operations
     */
    getPerformanceSummary(): PerformanceSummary {
        const allStats: OperationStats[] = [];
        
        for (const operationName of this.metrics.keys()) {
            const stats = this.getOperationStats(operationName);
            if (stats) {
                allStats.push(stats);
            }
        }

        // Sort by average duration (slowest first)
        const sortedStats = allStats.sort((a, b) => b.averageDuration - a.averageDuration);

        const totalExecutions = allStats.reduce((sum, s) => sum + s.totalExecutions, 0);
        const totalFailures = allStats.reduce((sum, s) => sum + s.failedExecutions, 0);
        const overallSuccessRate = totalExecutions > 0 ? 1 - (totalFailures / totalExecutions) : 1;

        return {
            generatedAt: new Date(),
            totalOperations: allStats.length,
            totalExecutions,
            overallSuccessRate,
            slowestOperations: sortedStats.slice(0, 10),
            failingOperations: allStats
                .filter(s => s.successRate < 0.9)
                .sort((a, b) => a.successRate - b.successRate)
                .slice(0, 10),
            recentlyDegraded: allStats
                .filter(s => s.recentSuccessRate < s.successRate - 0.1)
                .slice(0, 10),
            highVolumeOperations: allStats
                .filter(s => s.recentExecutions > 100)
                .sort((a, b) => b.recentExecutions - a.recentExecutions)
                .slice(0, 10)
        };
    }

    /**
     * Start periodic performance reporting
     */
    private startPeriodicReporting(): void {
        this.reportingIntervalId = setInterval(() => {
            this.generatePeriodicReport();
        }, this.reportingInterval);
    }

    /**
     * Stop periodic reporting (useful for testing)
     */
    stopPeriodicReporting(): void {
        if (this.reportingIntervalId) {
            clearInterval(this.reportingIntervalId);
            this.reportingIntervalId = undefined;
        }
    }

    /**
     * Generate periodic performance report
     */
    private generatePeriodicReport(): void {
        const now = Date.now();
        const timeSinceLastReport = now - this.lastReportTime;
        
        if (timeSinceLastReport < this.reportingInterval) {
            return; // Too soon
        }

        // Prune stale operations before generating report
        this.pruneStaleOperations(now);

        const summary = this.getPerformanceSummary();
        
        logger.info('Performance Summary', {
            reportPeriod: `${timeSinceLastReport / 1000}s`,
            totalOperations: summary.totalOperations,
            totalExecutions: summary.totalExecutions,
            overallSuccessRate: Math.round(summary.overallSuccessRate * 100),
            slowestOperations: summary.slowestOperations.slice(0, 5).map(op => ({
                name: op.operationName,
                avgDuration: Math.round(op.averageDuration),
                executions: op.totalExecutions
            })),
            failingOperations: summary.failingOperations.slice(0, 3).map(op => ({
                name: op.operationName,
                successRate: Math.round(op.successRate * 100),
                failures: op.failedExecutions
            }))
        });

        this.lastReportTime = now;
    }

    /**
     * Remove operations that haven't recorded metrics recently
     */
    private pruneStaleOperations(now: number): void {
        const staleThresholdTime = now - (this.staleThreshold * this.reportingInterval);
        const operationsToRemove: string[] = [];

        for (const [operationName, buffer] of this.metrics.entries()) {
            if (buffer.lastUpdated < staleThresholdTime) {
                operationsToRemove.push(operationName);
            }
        }

        if (operationsToRemove.length > 0) {
            logger.info('Pruning stale operations', {
                removedOperations: operationsToRemove.length,
                operations: operationsToRemove,
                staleThresholdMinutes: (this.staleThreshold * this.reportingInterval) / (1000 * 60)
            });

            for (const operationName of operationsToRemove) {
                this.metrics.delete(operationName);
            }
        }
    }

    /**
     * Clear all metrics
     */
    clearMetrics(): void {
        this.metrics.clear();
        this.lastReportTime = Date.now();
    }

    /**
     * Get metrics count for monitoring
     */
    getMetricsCount(): number {
        return Array.from(this.metrics.values()).reduce((total, buffer) => total + buffer.size, 0);
    }

    /**
     * Get debug information about the collector state
     */
    getDebugInfo(): {
        operationCount: number;
        totalMetrics: number;
        memoryFootprint: number;
        oldestOperation?: { name: string; lastUpdated: number };
        reportingActive: boolean;
    } {
        const buffers = Array.from(this.metrics.values());
        const totalMetrics = buffers.reduce((sum, buffer) => sum + buffer.size, 0);
        
        // Estimate memory footprint (rough calculation)
        const memoryFootprint = this.metrics.size * (
            this.maxMetricsPerOperation * 200 + // Rough estimate per metric
            100 // Buffer overhead
        );

        let oldestOperation;
        if (this.metrics.size > 0) {
            let oldestTime = Number.MAX_SAFE_INTEGER;
            let oldestName = '';
            
            for (const [name, buffer] of this.metrics.entries()) {
                if (buffer.lastUpdated < oldestTime) {
                    oldestTime = buffer.lastUpdated;
                    oldestName = name;
                }
            }
            
            if (oldestName) {
                oldestOperation = { name: oldestName, lastUpdated: oldestTime };
            }
        }

        return {
            operationCount: this.metrics.size,
            totalMetrics,
            memoryFootprint,
            oldestOperation,
            reportingActive: !!this.reportingIntervalId
        };
    }
}

/**
 * Individual operation metric
 */
interface OperationMetric {
    timestamp: Date;
    duration: number;
    success: boolean;
    operationType: string;
    serviceName?: string;
    methodName?: string;
    collection?: string;
    dbOperationType?: string;
    batchOperationName?: string;
    resultCount?: number;
    stepCount?: number;
    batchSize?: number;
    context: Record<string, any>;
}

/**
 * Aggregated statistics for an operation
 */
interface OperationStats {
    operationName: string;
    operationType: string;
    totalExecutions: number;
    successfulExecutions: number;
    failedExecutions: number;
    successRate: number;
    averageDuration: number;
    medianDuration: number;
    p95Duration: number;
    p99Duration: number;
    minDuration: number;
    maxDuration: number;
    recentExecutions: number;
    recentSuccessRate: number;
    lastExecuted: Date;
    firstExecuted: Date;
}

/**
 * Performance summary report
 */
interface PerformanceSummary {
    generatedAt: Date;
    totalOperations: number;
    totalExecutions: number;
    overallSuccessRate: number;
    slowestOperations: OperationStats[];
    failingOperations: OperationStats[];
    recentlyDegraded: OperationStats[];
    highVolumeOperations: OperationStats[];
}

// Export singleton instance
export const performanceMetricsCollector = PerformanceMetricsCollector.getInstance();