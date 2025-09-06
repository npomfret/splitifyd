/**
 * Scheduled job for aggregating performance metrics
 * 
 * Runs every 15 minutes to:
 * - Query recent metrics from Firestore
 * - Calculate statistical aggregates
 * - Detect anomalies and performance degradation
 * - Store aggregated stats for dashboards
 */

import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from '../logger';
import { createMetricsStorage } from '../utils/metrics-storage-factory';
import { metricsSampler } from '../utils/metrics-sampler';
import type { PerformanceMetric, AggregatedStats } from '../utils/metrics-storage';

/**
 * Core aggregation logic that can be called by both scheduled function and tests
 */
export async function performMetricsAggregation(
    lookbackMinutes: number = 15,
    logResults: boolean = true
): Promise<AggregatedStats[]> {
    const startTime = Date.now();
    const aggregatedStats: AggregatedStats[] = [];
    const metricsStorage = createMetricsStorage();

    try {
        // Query recent metrics
        const recentMetrics = await metricsStorage.queryRecentMetrics(lookbackMinutes);

        if (recentMetrics.length === 0) {
            if (logResults) {
                logger.info('No metrics to aggregate', { lookbackMinutes });
            }
            return [];
        }

        // Group metrics by operation type and name
        const groupedMetrics = groupMetricsByOperation(recentMetrics);

        // Calculate stats for each operation
        for (const [key, metrics] of groupedMetrics) {
            const [operationType, operationName] = key.split(':');
            const stats = calculateStats(
                metrics,
                operationType,
                operationName,
                lookbackMinutes
            );
            
            aggregatedStats.push(stats);

            // Store aggregated stats
            await metricsStorage.storeAggregatedStats(stats);

            // Check for anomalies
            checkForAnomalies(stats, logResults);
        }

        // Generate summary stats across all operations
        const summaryStats = calculateSummaryStats(
            recentMetrics,
            lookbackMinutes
        );
        
        aggregatedStats.push(summaryStats);
        await metricsStorage.storeAggregatedStats(summaryStats);

        const duration = Date.now() - startTime;

        if (logResults) {
            logger.info('Metrics aggregation completed', {
                duration_ms: duration,
                totalMetrics: recentMetrics.length,
                operations: groupedMetrics.size,
                aggregatedStats: aggregatedStats.length,
                period: `${lookbackMinutes} minutes`
            });
        }

        return aggregatedStats;
    } catch (error) {
        logger.error('Failed to aggregate metrics', error, {
            lookbackMinutes
        });
        return [];
    }
}

/**
 * Group metrics by operation type and name
 */
function groupMetricsByOperation(
    metrics: PerformanceMetric[]
): Map<string, PerformanceMetric[]> {
    const grouped = new Map<string, PerformanceMetric[]>();

    for (const metric of metrics) {
        const key = `${metric.operationType}:${metric.operationName}`;
        if (!grouped.has(key)) {
            grouped.set(key, []);
        }
        grouped.get(key)!.push(metric);
    }

    return grouped;
}

/**
 * Calculate statistics for a group of metrics
 */
function calculateStats(
    metrics: PerformanceMetric[],
    operationType: string,
    operationName: string,
    periodMinutes: number
): AggregatedStats {
    const now = new Date();
    const periodStart = new Date(now.getTime() - periodMinutes * 60000);

    // Sort durations for percentile calculations
    const durations = metrics
        .filter(m => m.duration !== undefined)
        .map(m => m.duration)
        .sort((a, b) => a - b);

    const successCount = metrics.filter(m => m.success).length;
    const failureCount = metrics.filter(m => !m.success).length;
    const sampledCount = metrics.filter(m => m.sampled).length;

    // Calculate percentiles
    const p50 = durations[Math.floor(durations.length * 0.5)] || 0;
    const p95 = durations[Math.floor(durations.length * 0.95)] || 0;
    const p99 = durations[Math.floor(durations.length * 0.99)] || 0;

    // Calculate average
    const avgDuration = durations.length > 0
        ? durations.reduce((a, b) => a + b, 0) / durations.length
        : 0;

    // Find top errors
    const errorMap = new Map<string, number>();
    metrics
        .filter(m => !m.success && m.error)
        .forEach(m => {
            const count = errorMap.get(m.error!) || 0;
            errorMap.set(m.error!, count + 1);
        });

    const topErrors = Array.from(errorMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([error, count]) => ({ error, count }));

    return {
        period: periodMinutes <= 60 ? 'hour' : periodMinutes <= 1440 ? 'day' : 'week',
        periodStart,
        periodEnd: now,
        operationType,
        operationName,
        totalCount: metrics.length,
        successCount,
        failureCount,
        sampledCount,
        avgDuration,
        minDuration: durations[0] || 0,
        maxDuration: durations[durations.length - 1] || 0,
        p50Duration: p50,
        p95Duration: p95,
        p99Duration: p99,
        successRate: metrics.length > 0 ? successCount / metrics.length : 0,
        errorRate: metrics.length > 0 ? failureCount / metrics.length : 0,
        throughput: metrics.length / (periodMinutes * 60), // ops per second
        topErrors: topErrors.length > 0 ? topErrors : undefined
    };
}

/**
 * Calculate summary statistics across all operations
 */
function calculateSummaryStats(
    metrics: PerformanceMetric[],
    periodMinutes: number
): AggregatedStats {
    return calculateStats(
        metrics,
        'summary',
        'all_operations',
        periodMinutes
    );
}

/**
 * Check for anomalies in aggregated stats
 */
function checkForAnomalies(stats: AggregatedStats, logAlerts: boolean): void {
    const anomalies: string[] = [];

    // Check for high error rate
    if (stats.errorRate > 0.1 && stats.totalCount > 10) {
        anomalies.push(`High error rate: ${(stats.errorRate * 100).toFixed(1)}%`);
    }

    // Check for slow operations
    if (stats.p95Duration > 5000) {
        anomalies.push(`Slow p95 duration: ${stats.p95Duration}ms`);
    }

    // Check for very slow operations
    if (stats.p99Duration > 10000) {
        anomalies.push(`Very slow p99 duration: ${stats.p99Duration}ms`);
    }

    // Check for low throughput (if this is a frequently used operation)
    if (stats.operationType === 'service-call' && stats.throughput < 0.01 && stats.totalCount > 0) {
        anomalies.push(`Low throughput: ${stats.throughput.toFixed(4)} ops/sec`);
    }

    if (anomalies.length > 0 && logAlerts) {
        logger.warn('Performance anomalies detected', {
            operation: `${stats.operationType}:${stats.operationName}`,
            anomalies,
            stats: {
                totalCount: stats.totalCount,
                errorRate: stats.errorRate,
                p95Duration: stats.p95Duration,
                p99Duration: stats.p99Duration,
                throughput: stats.throughput
            }
        });

        // Enable burst sampling for anomaly investigation
        if (stats.errorRate > 0.2 || stats.p99Duration > 15000) {
            metricsSampler.enableBurstSampling(300000); // 5 minutes
            logger.info('Burst sampling enabled due to anomalies');
        }
    }
}

/**
 * Scheduled function for metrics aggregation
 * Runs every 15 minutes to aggregate recent metrics
 */
export const aggregateMetrics = onSchedule(
    {
        schedule: 'every 15 minutes',
        timeZone: 'UTC',
        region: 'us-central1',
        memory: '512MiB',
        maxInstances: 1,
    },
    async () => {
        await performMetricsAggregation(15, true);
    }
);

/**
 * Daily aggregation for longer-term trends
 * Runs once per day at 2 AM UTC
 */
export const aggregateMetricsDaily = onSchedule(
    {
        schedule: 'every day 02:00',
        timeZone: 'UTC',
        region: 'us-central1',
        memory: '512MiB',
        maxInstances: 1,
    },
    async () => {
        // Aggregate last 24 hours
        await performMetricsAggregation(1440, true);
    }
);