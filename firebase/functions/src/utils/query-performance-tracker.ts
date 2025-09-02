import { logger } from '../logger';
import { QueryContext } from './performance-monitor';

/**
 * Performance tracking specifically for Firestore queries
 */
export class QueryPerformanceTracker {
    private static instance: QueryPerformanceTracker;
    private queryMetrics: Map<string, QueryMetric[]> = new Map();
    private readonly maxMetricsPerQuery = 100; // Keep last 100 executions per query

    private constructor() {}

    static getInstance(): QueryPerformanceTracker {
        if (!QueryPerformanceTracker.instance) {
            QueryPerformanceTracker.instance = new QueryPerformanceTracker();
        }
        return QueryPerformanceTracker.instance;
    }

    /**
     * Track a specific query execution
     */
    async trackQuery<T>(
        querySignature: string,
        collection: string,
        operation: () => Promise<T>,
        context: Partial<QueryContext> = {}
    ): Promise<T> {
        const startTime = Date.now();
        let resultCount = 0;
        let indexUsed = true; // Default assumption

        try {
            const result = await operation();
            
            // Try to extract result count if possible
            if (result && typeof result === 'object') {
                if ('size' in result) {
                    resultCount = (result as any).size;
                } else if ('length' in result) {
                    resultCount = (result as any).length;
                } else if ('docs' in result) {
                    resultCount = (result as any).docs.length;
                }
            }

            const duration = Date.now() - startTime;
            
            // Store the metric
            this.recordMetric(querySignature, {
                timestamp: new Date(),
                duration,
                collection,
                resultCount,
                success: true,
                indexUsed: context.indexUsed ?? indexUsed,
                queryType: context.queryType || 'unknown',
                filterCount: context.filterCount || 0,
                orderByCount: context.orderByCount || 0,
                operation: context.operation
            });

            // Analyze for performance issues
            this.analyzeQueryPerformance(querySignature, duration, resultCount, context);

            return result;
        } catch (error) {
            const duration = Date.now() - startTime;
            
            this.recordMetric(querySignature, {
                timestamp: new Date(),
                duration,
                collection,
                resultCount: 0,
                success: false,
                indexUsed: false,
                queryType: context.queryType || 'unknown',
                filterCount: context.filterCount || 0,
                orderByCount: context.orderByCount || 0,
                operation: context.operation,
                error: error instanceof Error ? error.message : String(error)
            });

            throw error;
        }
    }

    /**
     * Record a query metric
     */
    private recordMetric(querySignature: string, metric: QueryMetric): void {
        if (!this.queryMetrics.has(querySignature)) {
            this.queryMetrics.set(querySignature, []);
        }

        const metrics = this.queryMetrics.get(querySignature)!;
        metrics.push(metric);

        // Keep only the most recent metrics
        if (metrics.length > this.maxMetricsPerQuery) {
            metrics.shift();
        }
    }

    /**
     * Analyze query performance and alert on issues
     */
    private analyzeQueryPerformance(
        querySignature: string,
        duration: number,
        resultCount: number,
        context: Partial<QueryContext>
    ): void {
        const metrics = this.queryMetrics.get(querySignature) || [];
        
        // Alert on slow queries
        const slowThreshold = this.getSlowThreshold(context.queryType);
        if (duration > slowThreshold) {
            logger.warn(`Slow query detected`, {
                querySignature,
                duration_ms: duration,
                collection: context.collection,
                queryType: context.queryType,
                resultCount,
                slowThreshold,
                filterCount: context.filterCount,
                orderByCount: context.orderByCount,
                indexUsed: context.indexUsed,
                operation: context.operation
            });
        }

        // Alert on potential full collection scans
        if (!context.indexUsed && resultCount > 50) {
            logger.warn(`Potential full collection scan`, {
                querySignature,
                collection: context.collection,
                resultCount,
                duration_ms: duration,
                recommendation: 'Consider adding a composite index'
            });
        }

        // Performance trend analysis (if we have enough data)
        if (metrics.length >= 10) {
            const recentMetrics = metrics.slice(-10);
            const averageDuration = recentMetrics.reduce((sum, m) => sum + m.duration, 0) / recentMetrics.length;
            
            // Alert if current execution is significantly slower than recent average
            if (duration > averageDuration * 2 && duration > 200) {
                logger.warn(`Query performance degradation detected`, {
                    querySignature,
                    currentDuration_ms: duration,
                    averageDuration_ms: averageDuration,
                    degradationFactor: duration / averageDuration,
                    collection: context.collection,
                    operation: context.operation
                });
            }
        }

        // Alert on high result count queries
        if (resultCount > 1000) {
            logger.warn(`High result count query`, {
                querySignature,
                resultCount,
                duration_ms: duration,
                collection: context.collection,
                recommendation: 'Consider adding pagination or more specific filtering'
            });
        }
    }

    /**
     * Get performance threshold based on query type
     */
    private getSlowThreshold(queryType?: string): number {
        switch (queryType) {
            case 'single': return 100;      // Single document lookups should be fast
            case 'indexed': return 200;     // Indexed queries
            case 'collection': return 500;  // Collection queries
            case 'scan': return 1000;       // Full scans (already problematic)
            default: return 300;            // Default threshold
        }
    }

    /**
     * Get performance statistics for a query
     */
    getQueryStats(querySignature: string): QueryStats | null {
        const metrics = this.queryMetrics.get(querySignature);
        if (!metrics || metrics.length === 0) {
            return null;
        }

        const successfulMetrics = metrics.filter(m => m.success);
        if (successfulMetrics.length === 0) {
            return null;
        }

        const durations = successfulMetrics.map(m => m.duration).sort((a, b) => a - b);
        const resultCounts = successfulMetrics.map(m => m.resultCount);

        return {
            querySignature,
            executionCount: metrics.length,
            successfulExecutions: successfulMetrics.length,
            failedExecutions: metrics.length - successfulMetrics.length,
            averageDuration: durations.reduce((sum, d) => sum + d, 0) / durations.length,
            medianDuration: durations[Math.floor(durations.length / 2)],
            p95Duration: durations[Math.floor(durations.length * 0.95)],
            minDuration: durations[0],
            maxDuration: durations[durations.length - 1],
            averageResultCount: resultCounts.reduce((sum, c) => sum + c, 0) / resultCounts.length,
            lastExecuted: metrics[metrics.length - 1].timestamp,
            collection: successfulMetrics[0].collection
        };
    }

    /**
     * Get all tracked queries with their performance stats
     */
    getAllQueryStats(): QueryStats[] {
        const allStats: QueryStats[] = [];
        
        for (const querySignature of this.queryMetrics.keys()) {
            const stats = this.getQueryStats(querySignature);
            if (stats) {
                allStats.push(stats);
            }
        }

        // Sort by average duration (slowest first)
        return allStats.sort((a, b) => b.averageDuration - a.averageDuration);
    }

    /**
     * Clear metrics for a specific query or all queries
     */
    clearMetrics(querySignature?: string): void {
        if (querySignature) {
            this.queryMetrics.delete(querySignature);
        } else {
            this.queryMetrics.clear();
        }
    }

    /**
     * Generate a performance report
     */
    generatePerformanceReport(): QueryPerformanceReport {
        const allStats = this.getAllQueryStats();
        const totalExecutions = allStats.reduce((sum, s) => sum + s.executionCount, 0);
        const slowQueries = allStats.filter(s => s.averageDuration > 500);
        const failingQueries = allStats.filter(s => s.failedExecutions > 0);

        return {
            generatedAt: new Date(),
            totalQueries: allStats.length,
            totalExecutions,
            slowQueries: slowQueries.length,
            failingQueries: failingQueries.length,
            averageQueryDuration: allStats.reduce((sum, s) => sum + s.averageDuration, 0) / allStats.length,
            topSlowQueries: allStats.slice(0, 10),
            queriesNeedingIndexes: allStats.filter(s => 
                s.averageDuration > 200 && 
                s.averageResultCount > 10
            )
        };
    }
}

/**
 * Individual query execution metric
 */
interface QueryMetric {
    timestamp: Date;
    duration: number;
    collection: string;
    resultCount: number;
    success: boolean;
    indexUsed: boolean;
    queryType: string;
    filterCount: number;
    orderByCount: number;
    operation?: string;
    error?: string;
}

/**
 * Aggregated statistics for a query
 */
interface QueryStats {
    querySignature: string;
    collection: string;
    executionCount: number;
    successfulExecutions: number;
    failedExecutions: number;
    averageDuration: number;
    medianDuration: number;
    p95Duration: number;
    minDuration: number;
    maxDuration: number;
    averageResultCount: number;
    lastExecuted: Date;
}

/**
 * Complete performance report
 */
interface QueryPerformanceReport {
    generatedAt: Date;
    totalQueries: number;
    totalExecutions: number;
    slowQueries: number;
    failingQueries: number;
    averageQueryDuration: number;
    topSlowQueries: QueryStats[];
    queriesNeedingIndexes: QueryStats[];
}

// Export singleton instance
export const queryPerformanceTracker = QueryPerformanceTracker.getInstance();