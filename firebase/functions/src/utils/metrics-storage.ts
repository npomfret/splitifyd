/**
 * Metrics Storage Service
 * 
 * Manages storage of performance metrics in Firestore with:
 * - Buffered writes to reduce Firestore operations
 * - Automatic batching of metrics
 * - Timestamp-based partitioning for efficient queries
 * - Compression of context data
 */

import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import { logger } from '../logger';
import type { IFirestoreWriter } from '../services/firestore/IFirestoreWriter';
import type { IFirestoreReader } from '../services/firestore/IFirestoreReader';
import type { WriteResult } from '../services/firestore/IFirestoreWriter';

// Global flag to ensure shutdown message is only logged once per process
let shutdownMessageLogged = false;

export interface PerformanceMetric {
    timestamp: Date;
    operationType: string;
    operationName: string;
    duration: number;
    success: boolean;
    sampled: boolean;
    sampleRate: number;
    context?: Record<string, any>;
    error?: string;
    
    // Additional metadata
    environment?: string;
    version?: string;
    userId?: string;
    groupId?: string;
    requestId?: string;
}

export interface AggregatedStats {
    period: 'hour' | 'day' | 'week';
    periodStart: Date;
    periodEnd: Date;
    operationType: string;
    operationName: string;
    
    // Statistical metrics
    totalCount: number;
    successCount: number;
    failureCount: number;
    sampledCount: number;
    
    // Duration statistics (in ms)
    avgDuration: number;
    minDuration: number;
    maxDuration: number;
    p50Duration: number;
    p95Duration: number;
    p99Duration: number;
    
    // Derived metrics
    successRate: number;
    errorRate: number;
    throughput: number; // operations per second
    
    // Top errors
    topErrors?: Array<{ error: string; count: number }>;
}

export interface MetricsStorageConfig {
    bufferSize: number;           // Max metrics to buffer before flush
    flushIntervalMs: number;      // Auto-flush interval
    maxBatchSize: number;         // Max metrics per Firestore batch
    compressionEnabled: boolean;  // Enable context compression
    collectionPrefix: string;     // Prefix for collections
}

export class MetricsStorage {
    private config: MetricsStorageConfig;
    private metricsBuffer: PerformanceMetric[] = [];
    private flushTimer?: NodeJS.Timeout;
    private firestoreWriter: IFirestoreWriter;
    private firestoreReader: IFirestoreReader;
    private isShuttingDown = false;

    constructor(firestoreWriter: IFirestoreWriter, firestoreReader: IFirestoreReader, config?: Partial<MetricsStorageConfig>) {
        this.config = {
            bufferSize: 100,
            flushIntervalMs: 30000, // 30 seconds
            maxBatchSize: 500,
            compressionEnabled: true,
            collectionPrefix: 'performance',
            ...config
        };

        this.firestoreWriter = firestoreWriter;
        this.firestoreReader = firestoreReader;
        
        // Start auto-flush timer
        this.startAutoFlush();

        // Register shutdown handler
        this.registerShutdownHandler();
    }


    /**
     * Store a performance metric
     */
    async storeMetric(metric: PerformanceMetric): Promise<void> {
        if (this.isShuttingDown) {
            // During shutdown, write directly
            await this.writeMetricDirect(metric);
            return;
        }

        // Add to buffer
        this.metricsBuffer.push(metric);

        // Flush if buffer is full
        if (this.metricsBuffer.length >= this.config.bufferSize) {
            await this.flush();
        }
    }

    /**
     * Store multiple metrics
     */
    async storeMetrics(metrics: PerformanceMetric[]): Promise<void> {
        if (this.isShuttingDown) {
            // During shutdown, write directly
            await this.writeMetricsDirect(metrics);
            return;
        }

        // Add to buffer
        this.metricsBuffer.push(...metrics);

        // Flush if buffer is full
        if (this.metricsBuffer.length >= this.config.bufferSize) {
            await this.flush();
        }
    }

    /**
     * Flush buffered metrics to Firestore
     */
    async flush(): Promise<void> {
        if (this.metricsBuffer.length === 0) {
            return;
        }

        const metricsToFlush = [...this.metricsBuffer];
        this.metricsBuffer = [];

        try {
            await this.writeMetricsBatch(metricsToFlush);
            logger.info('Metrics flushed to Firestore', { count: metricsToFlush.length });
        } catch (error) {
            logger.error('Failed to flush metrics', error, { count: metricsToFlush.length });
            
            // Re-add metrics to buffer if not shutting down
            if (!this.isShuttingDown) {
                this.metricsBuffer.unshift(...metricsToFlush);
            }
        }
    }

    /**
     * Write metrics in batches
     */
    private async writeMetricsBatch(metrics: PerformanceMetric[]): Promise<void> {
        const batches = this.createBatches(metrics, this.config.maxBatchSize);

        for (const batch of batches) {
            const collectionName = this.getMetricsCollectionName();
            const documents = batch.map(metric => this.prepareMetricDocument(metric));

            await this.firestoreWriter.writePerformanceMetrics(collectionName, documents);
        }
    }

    /**
     * Write a single metric directly (for shutdown)
     */
    private async writeMetricDirect(metric: PerformanceMetric): Promise<void> {
        const collectionName = this.getMetricsCollectionName();
        const document = this.prepareMetricDocument(metric);

        await this.firestoreWriter.writePerformanceMetrics(collectionName, [document]);
    }

    /**
     * Write multiple metrics directly (for shutdown)
     */
    private async writeMetricsDirect(metrics: PerformanceMetric[]): Promise<void> {
        if (metrics.length === 0) return;

        const collectionName = this.getMetricsCollectionName();
        const documents = metrics.slice(0, this.config.maxBatchSize).map(metric => this.prepareMetricDocument(metric));

        await this.firestoreWriter.writePerformanceMetrics(collectionName, documents);
    }

    /**
     * Prepare metric document for storage
     */
    private prepareMetricDocument(metric: PerformanceMetric): any {
        const doc: any = {
            timestamp: Timestamp.fromDate(metric.timestamp),
            operationType: metric.operationType,
            operationName: metric.operationName,
            duration: metric.duration,
            success: metric.success,
            sampled: metric.sampled,
            sampleRate: metric.sampleRate,
            
            // Metadata
            environment: metric.environment || process.env.NODE_ENV || 'production',
            version: metric.version || process.env.FUNCTION_VERSION || 'unknown',
            
            // Optional fields
            ...(metric.userId && { userId: metric.userId }),
            ...(metric.groupId && { groupId: metric.groupId }),
            ...(metric.requestId && { requestId: metric.requestId }),
            ...(metric.error && { error: metric.error }),
            
            // Timestamp for TTL
            createdAt: FieldValue.serverTimestamp()
        };

        // Compress context if enabled
        if (metric.context) {
            doc.context = this.config.compressionEnabled 
                ? this.compressContext(metric.context)
                : metric.context;
        }

        return doc;
    }

    /**
     * Compress context data
     */
    private compressContext(context: Record<string, any>): string {
        try {
            // Simple JSON stringification for now
            // Could use actual compression in the future
            return JSON.stringify(context);
        } catch {
            return '{}';
        }
    }

    /**
     * Get metrics collection name
     */
    private getMetricsCollectionName(): string {
        return `${this.config.collectionPrefix}-metrics`;
    }

    /**
     * Store aggregated statistics
     */
    async storeAggregatedStats(stats: AggregatedStats): Promise<WriteResult> {
        const collectionName = `${this.config.collectionPrefix}-aggregates`;
        
        const document = {
            ...stats,
            periodStart: Timestamp.fromDate(stats.periodStart),
            periodEnd: Timestamp.fromDate(stats.periodEnd)
        };

        return await this.firestoreWriter.writePerformanceStats(collectionName, document);
    }

    /**
     * Query recent metrics
     */
    async queryRecentMetrics(
        minutes: number,
        filters?: {
            operationType?: string;
            operationName?: string;
            success?: boolean;
        }
    ): Promise<PerformanceMetric[]> {
        const collectionName = this.getMetricsCollectionName();
        return await this.firestoreReader.queryPerformanceMetrics(collectionName, minutes, filters);
    }

    /**
     * Query aggregated stats
     */
    async queryAggregatedStats(
        period: 'hour' | 'day' | 'week',
        lookbackCount: number = 24
    ): Promise<AggregatedStats[]> {
        const collectionName = `${this.config.collectionPrefix}-aggregates`;
        return await this.firestoreReader.queryAggregatedStats(collectionName, period, lookbackCount);
    }

    /**
     * Create batches from metrics array
     */
    private createBatches<T>(items: T[], batchSize: number): T[][] {
        const batches: T[][] = [];
        for (let i = 0; i < items.length; i += batchSize) {
            batches.push(items.slice(i, i + batchSize));
        }
        return batches;
    }

    /**
     * Start auto-flush timer
     */
    private startAutoFlush(): void {
        this.flushTimer = setInterval(() => {
            this.flush().catch(error => {
                logger.error('Auto-flush failed', error);
            });
        }, this.config.flushIntervalMs);
    }

    /**
     * Stop auto-flush timer
     */
    private stopAutoFlush(): void {
        if (this.flushTimer) {
            clearInterval(this.flushTimer);
            this.flushTimer = undefined;
        }
    }

    /**
     * Register shutdown handler
     */
    private registerShutdownHandler(): void {
        const shutdownHandler = async () => {
            if (!shutdownMessageLogged) {
                logger.info('Metrics storage shutting down, flushing remaining metrics');
                shutdownMessageLogged = true;
            }
            this.isShuttingDown = true;
            this.stopAutoFlush();
            await this.flush();
        };

        process.on('SIGINT', shutdownHandler);
        process.on('SIGTERM', shutdownHandler);
    }

    /**
     * Get storage statistics
     */
    getStats(): {
        bufferSize: number;
        isShuttingDown: boolean;
        config: MetricsStorageConfig;
    } {
        return {
            bufferSize: this.metricsBuffer.length,
            isShuttingDown: this.isShuttingDown,
            config: { ...this.config }
        };
    }

    /**
     * Reset storage (for testing)
     */
    reset(): void {
        this.metricsBuffer = [];
        this.stopAutoFlush();
        this.startAutoFlush();
        this.isShuttingDown = false;
    }
}

// Export is now handled by the factory
// This file only exports the class