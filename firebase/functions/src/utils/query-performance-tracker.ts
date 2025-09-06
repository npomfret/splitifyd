import { logger } from '../logger';
import { QueryContext } from './performance-monitor';

/**
 * Performance tracking specifically for Firestore queries - without caching
 */
export class QueryPerformanceTracker {
    private static instance: QueryPerformanceTracker;

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
            
            // Log the metric immediately without storing
            this.logMetric(querySignature, {
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
            
            this.logMetric(querySignature, {
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
     * Log a query metric immediately
     */
    private logMetric(querySignature: string, metric: QueryMetric): void {
        // Log slow queries
        if (metric.duration > 500) {
            logger.warn('Slow query detected', {
                querySignature,
                duration_ms: metric.duration,
                collection: metric.collection,
                resultCount: metric.resultCount,
                success: metric.success,
                indexUsed: metric.indexUsed
            });
        }

        // Log failed queries
        if (!metric.success) {
            logger.error('Query failed', {
                querySignature,
                collection: metric.collection,
                error: metric.error
            });
        }
    }

    /**
     * Analyze query performance for issues
     */
    private analyzeQueryPerformance(
        querySignature: string,
        duration: number,
        resultCount: number,
        context: Partial<QueryContext>
    ): void {
        // Check for missing indexes (slow queries with filters)
        if (duration > 1000 && context.filterCount && context.filterCount > 1) {
            logger.warn('Potential missing index detected', {
                querySignature,
                duration_ms: duration,
                filterCount: context.filterCount,
                orderByCount: context.orderByCount,
                resultCount
            });
        }

        // Check for large result sets
        if (resultCount > 1000) {
            logger.warn('Large result set detected', {
                querySignature,
                resultCount,
                duration_ms: duration,
                recommendation: 'Consider pagination or more selective filters'
            });
        }

        // Check for inefficient queries (high duration, low results)
        if (duration > 500 && resultCount < 10) {
            logger.warn('Inefficient query detected', {
                querySignature,
                duration_ms: duration,
                resultCount,
                recommendation: 'Query took long time for small result set'
            });
        }
    }

    /**
     * Get query statistics - no data available without caching
     */
    getQueryStats(querySignature: string): QueryStats | null {
        // Without caching, we cannot provide historical statistics
        return null;
    }

    /**
     * Get all query statistics - no data available without caching
     */
    getAllQueryStats(): QueryStats[] {
        // Without caching, we cannot provide historical statistics
        return [];
    }

    /**
     * Clear query metrics - no-op without caching
     */
    clearMetrics(): void {
        // No metrics to clear
    }

    /**
     * Get slow queries - no data available without caching
     */
    getSlowQueries(thresholdMs: number = 500): QueryMetric[] {
        // Without caching, we cannot provide historical data
        return [];
    }

    /**
     * Get queries by collection - no data available without caching
     */
    getQueriesByCollection(collection: string): QueryMetric[] {
        // Without caching, we cannot provide historical data
        return [];
    }
}

// Export convenience function for getting the tracker instance
export const getQueryTracker = () => QueryPerformanceTracker.getInstance();

// Type definitions
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

interface QueryStats {
    querySignature: string;
    collection: string;
    totalExecutions: number;
    successfulExecutions: number;
    failedExecutions: number;
    averageDuration: number;
    averageResultCount: number;
    maxDuration: number;
    minDuration: number;
    lastExecution: Date;
}