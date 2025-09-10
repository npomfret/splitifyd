import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from '../logger';
import { metrics, Metric } from '../monitoring/lightweight-metrics';

export const logMetrics = onSchedule(
    {
        schedule: 'every 30 minutes',
        timeZone: 'UTC',
        region: 'us-central1',
        memory: '256MiB',
        maxInstances: 1,
    },
    async () => {
        try {
            const snapshot = metrics.getSnapshot();
            
            const report = {
                timestamp: new Date().toISOString(),
                samplingRate: 0.05,
                api: calculateStats(snapshot.api),
                db: calculateStats(snapshot.db),
                trigger: calculateStats(snapshot.trigger),
                memoryStats: metrics.getStats()
            };
            
            logger.info('metrics-report', report);
            
            const oneHourAgo = Date.now() - 3600000;
            metrics.clearOlderThan(oneHourAgo);
            
            const statsAfterCleanup = metrics.getStats();
            logger.info('metrics-cleanup', {remaining: statsAfterCleanup.totalMetrics});
            
        } catch (error) {
            logger.error('metrics-report-failed', error);
        }
    }
);

function calculateStats(metricsArray: Metric[]): any {
    if (!metricsArray.length) {
        return {
            count: 0,
            successRate: 0,
            avgDuration: 0,
            p50: 0,
            p95: 0,
            p99: 0,
            operations: {}
        };
    }

    const durations = metricsArray.map(m => m.duration).sort((a, b) => a - b);
    const successCount = metricsArray.filter(m => m.success).length;

    const operationGroups = new Map<string, Metric[]>();
    for (const metric of metricsArray) {
        const existing = operationGroups.get(metric.operation) || [];
        existing.push(metric);
        operationGroups.set(metric.operation, existing);
    }

    const operations: Record<string, any> = {};
    for (const [operation, operationMetrics] of Array.from(operationGroups.entries())) {
        const opDurations = operationMetrics.map(m => m.duration).sort((a, b) => a - b);
        const opSuccessCount = operationMetrics.filter(m => m.success).length;
        
        operations[operation] = {
            count: operationMetrics.length,
            successRate: opSuccessCount / operationMetrics.length,
            avgDuration: Math.round(opDurations.reduce((a, b) => a + b, 0) / opDurations.length),
            p95: opDurations[Math.floor(opDurations.length * 0.95)] || 0
        };
    }

    return {
        count: metricsArray.length,
        successRate: Math.round((successCount / metricsArray.length) * 100) / 100,
        avgDuration: Math.round(durations.reduce((a, b) => a + b, 0) / durations.length),
        p50: durations[Math.floor(durations.length * 0.5)] || 0,
        p95: durations[Math.floor(durations.length * 0.95)] || 0,
        p99: durations[Math.floor(durations.length * 0.99)] || 0,
        operations: operations
    };
}