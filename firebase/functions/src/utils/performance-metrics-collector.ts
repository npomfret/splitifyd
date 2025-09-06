import { logger } from '../logger';
import { metricsStorage } from './metrics-storage';
import { metricsSampler } from './metrics-sampler';

/**
 * Collects and stores performance metrics in Firestore
 * Uses sampling to reduce overhead
 */
export class PerformanceMetricsCollector {
    private static instance: PerformanceMetricsCollector;
    private readonly reportingInterval = 5 * 60 * 1000; // 5 minutes
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
     * Record a performance metric - stores to Firestore if sampled
     */
    async recordMetric(operationName: string, metric: OperationMetric): Promise<void> {
        // Check if we should sample this metric
        const samplingDecision = metricsSampler.shouldSample(
            metric.operationType,
            operationName,
            {
                duration: metric.duration,
                success: metric.success,
                ...metric.context
            }
        );

        if (samplingDecision.sample) {
            // Store to Firestore
            await metricsStorage.storeMetric({
                timestamp: metric.timestamp,
                operationType: metric.operationType,
                operationName,
                duration: metric.duration,
                success: metric.success,
                sampled: true,
                sampleRate: samplingDecision.rate,
                context: metric.context,
                error: metric.error,
                userId: metric.context?.userId as string | undefined,
                groupId: metric.context?.groupId as string | undefined,
                requestId: metric.context?.requestId as string | undefined
            });
        }

        // Always log slow operations
        if (metric.duration > 1000) {
            logger.warn(`Slow operation detected: ${operationName}`, {
                duration: metric.duration,
                success: metric.success,
                sampled: samplingDecision.sample
            });
        }
        
        // Check for immediate alerts
        this.checkForAlerts(operationName, metric);
    }

    /**
     * Record a service call completion
     */
    async recordServiceCall(
        serviceName: string,
        methodName: string,
        duration: number,
        success: boolean,
        context: Record<string, any> = {}
    ): Promise<void> {
        const operationName = `${serviceName}.${methodName}`;
        
        await this.recordMetric(operationName, {
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
    async recordDbOperation(
        operationType: 'read' | 'write' | 'query' | 'transaction',
        collection: string,
        duration: number,
        success: boolean,
        resultCount?: number,
        context: Record<string, any> = {}
    ): Promise<void> {
        const operationName = `db-${operationType}-${collection}`;
        
        await this.recordMetric(operationName, {
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
    async recordBatchOperation(
        operationName: string,
        duration: number,
        success: boolean,
        stepCount: number,
        batchSize?: number,
        context: Record<string, any> = {}
    ): Promise<void> {
        await this.recordMetric(`batch-${operationName}`, {
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
        
        // Alert on failures
        if (!metric.success) {
            logger.warn('Operation failed', {
                operationName,
                operationType: metric.operationType,
                context: metric.context
            });
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
     * Get aggregated statistics for an operation - no data available without caching
     */
    getOperationStats(operationName: string): OperationStats | null {
        // Without caching, we cannot provide historical statistics
        return null;
    }

    /**
     * Get all operations statistics - no data available without caching
     */
    getAllOperationStats(): OperationStats[] {
        // Without caching, we cannot provide historical statistics
        return [];
    }

    /**
     * Generate performance report from Firestore metrics
     */
    async generateReport(): Promise<void> {
        if (this.isTestEnvironment) {
            return;
        }
        
        try {
            // Query recent metrics from Firestore
            const recentMetrics = await metricsStorage.queryRecentMetrics(60); // Last hour
            
            if (recentMetrics.length === 0) {
                logger.info('No metrics to report');
                return;
            }
            
            // Group metrics by operation
            const groupedMetrics = new Map<string, any[]>();
            for (const metric of recentMetrics) {
                const key = `${metric.operationType}:${metric.operationName}`;
                if (!groupedMetrics.has(key)) {
                    groupedMetrics.set(key, []);
                }
                groupedMetrics.get(key)!.push(metric);
            }
            
            // Calculate stats for each operation
            const stats = [];
            for (const [operation, metrics] of groupedMetrics) {
                const durations = metrics.map(m => m.duration).sort((a, b) => a - b);
                const successCount = metrics.filter(m => m.success).length;
                
                stats.push({
                    operation,
                    count: metrics.length,
                    successRate: successCount / metrics.length,
                    avgDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
                    p50: durations[Math.floor(durations.length * 0.5)],
                    p95: durations[Math.floor(durations.length * 0.95)],
                    p99: durations[Math.floor(durations.length * 0.99)]
                });
            }
            
            // Log aggregated stats
            logger.info('Performance report generated', {
                period: 'hourly',
                totalMetrics: recentMetrics.length,
                operations: stats.length,
                topOperations: stats.slice(0, 10)
            });
            
            // Store aggregated stats
            if (stats.length > 0) {
                await metricsStorage.storeAggregatedStats({
                    period: 'hour',
                    periodStart: new Date(Date.now() - 3600000),
                    periodEnd: new Date(),
                    operationType: 'mixed',
                    operationName: 'all',
                    totalCount: recentMetrics.length,
                    successCount: recentMetrics.filter(m => m.success).length,
                    failureCount: recentMetrics.filter(m => !m.success).length,
                    sampledCount: recentMetrics.length,
                    avgDuration: stats.reduce((a, s) => a + s.avgDuration, 0) / stats.length,
                    minDuration: Math.min(...recentMetrics.map(m => m.duration)),
                    maxDuration: Math.max(...recentMetrics.map(m => m.duration)),
                    p50Duration: stats[0]?.p50 || 0,
                    p95Duration: stats[0]?.p95 || 0,
                    p99Duration: stats[0]?.p99 || 0,
                    successRate: recentMetrics.filter(m => m.success).length / recentMetrics.length,
                    errorRate: recentMetrics.filter(m => !m.success).length / recentMetrics.length,
                    throughput: recentMetrics.length / 3600
                });
            }
        } catch (error) {
            logger.error('Failed to generate performance report', error);
        }
    }

    /**
     * Start periodic reporting
     */
    private startPeriodicReporting(): void {
        if (this.reportingIntervalId) {
            clearInterval(this.reportingIntervalId);
        }

        this.reportingIntervalId = setInterval(() => {
            this.generateReport();
        }, this.reportingInterval);
    }

    /**
     * Stop periodic reporting
     */
    stopPeriodicReporting(): void {
        if (this.reportingIntervalId) {
            clearInterval(this.reportingIntervalId);
            this.reportingIntervalId = undefined;
        }
    }

    /**
     * Clear all metrics - no-op without caching
     */
    clearMetrics(): void {
        // No metrics to clear
    }

    /**
     * Get memory usage - returns 0 without caching
     */
    getMemoryUsage(): { totalMetrics: number; estimatedSize: number } {
        return {
            totalMetrics: 0,
            estimatedSize: 0
        };
    }
}

// Export convenience function for getting the collector instance
export const getPerformanceCollector = () => PerformanceMetricsCollector.getInstance();

// Export singleton instance for backward compatibility
export const performanceMetricsCollector = PerformanceMetricsCollector.getInstance();

// Type definitions
interface OperationMetric {
    timestamp: Date;
    duration: number;
    success: boolean;
    operationType: string;
    serviceName?: string;
    methodName?: string;
    collection?: string;
    dbOperationType?: string;
    resultCount?: number;
    batchOperationName?: string;
    stepCount?: number;
    batchSize?: number;
    context?: Record<string, any>;
    error?: string;
}

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
}