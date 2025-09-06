/**
 * Metrics Storage Service
 * 
 * Manages storage of performance metrics in Firestore with:
 * - Buffered writes to reduce Firestore operations
 * - Automatic batching of metrics
 * - Timestamp-based partitioning for efficient queries
 * - Compression of context data
 */

import { getFirestore } from '../firebase';
import { Firestore, Timestamp, FieldValue } from 'firebase-admin/firestore';
import { logger } from '../logger';
import { FirestoreWriter } from '../services/firestore/FirestoreWriter';
import type { WriteResult } from '../services/firestore/IFirestoreWriter';

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
    private static instance: MetricsStorage;
    private config: MetricsStorageConfig;
    private metricsBuffer: PerformanceMetric[] = [];
    private flushTimer?: NodeJS.Timeout;
    private firestoreWriter: FirestoreWriter;
    private db: Firestore;
    private isShuttingDown = false;

    private constructor(config?: Partial<MetricsStorageConfig>) {
        this.config = {
            bufferSize: 100,
            flushIntervalMs: 30000, // 30 seconds
            maxBatchSize: 500,
            compressionEnabled: true,
            collectionPrefix: 'performance',
            ...config
        };

        this.db = getFirestore();
        this.firestoreWriter = new FirestoreWriter();
        
        // Start auto-flush timer
        this.startAutoFlush();

        // Register shutdown handler
        this.registerShutdownHandler();
    }

    static getInstance(config?: Partial<MetricsStorageConfig>): MetricsStorage {
        if (!MetricsStorage.instance) {
            MetricsStorage.instance = new MetricsStorage(config);
        }
        return MetricsStorage.instance;
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

            await this.firestoreWriter.bulkCreate(collectionName, documents);
        }
    }

    /**
     * Write a single metric directly (for shutdown)
     */
    private async writeMetricDirect(metric: PerformanceMetric): Promise<void> {
        const collectionName = this.getMetricsCollectionName();
        const document = this.prepareMetricDocument(metric);

        await this.db.collection(collectionName).add(document);
    }

    /**
     * Write multiple metrics directly (for shutdown)
     */
    private async writeMetricsDirect(metrics: PerformanceMetric[]): Promise<void> {
        if (metrics.length === 0) return;

        const batch = this.db.batch();
        const collectionName = this.getMetricsCollectionName();

        for (const metric of metrics.slice(0, this.config.maxBatchSize)) {
            const docRef = this.db.collection(collectionName).doc();
            const document = this.prepareMetricDocument(metric);
            batch.set(docRef, document);
        }

        await batch.commit();
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
     * Get metrics collection name with date partitioning
     */
    private getMetricsCollectionName(): string {
        const date = new Date();
        const yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        return `${this.config.collectionPrefix}-metrics-${yearMonth}`;
    }

    /**
     * Store aggregated statistics
     */
    async storeAggregatedStats(stats: AggregatedStats): Promise<WriteResult> {
        const collectionName = `${this.config.collectionPrefix}-aggregates`;
        
        const document = {
            ...stats,
            periodStart: Timestamp.fromDate(stats.periodStart),
            periodEnd: Timestamp.fromDate(stats.periodEnd),
            createdAt: FieldValue.serverTimestamp()
        };

        const docRef = this.db.collection(collectionName).doc();
        await docRef.set(document);

        return {
            id: docRef.id,
            success: true,
            timestamp: Timestamp.now()
        };
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
        const cutoff = new Date();
        cutoff.setMinutes(cutoff.getMinutes() - minutes);

        const collectionName = this.getMetricsCollectionName();
        let query = this.db
            .collection(collectionName)
            .where('timestamp', '>=', Timestamp.fromDate(cutoff))
            .orderBy('timestamp', 'desc')
            .limit(1000);

        if (filters?.operationType) {
            query = query.where('operationType', '==', filters.operationType);
        }

        if (filters?.operationName) {
            query = query.where('operationName', '==', filters.operationName);
        }

        if (filters?.success !== undefined) {
            query = query.where('success', '==', filters.success);
        }

        const snapshot = await query.get();

        return snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                ...data,
                timestamp: data.timestamp.toDate(),
                context: typeof data.context === 'string' 
                    ? JSON.parse(data.context) 
                    : data.context
            } as PerformanceMetric;
        });
    }

    /**
     * Query aggregated stats
     */
    async queryAggregatedStats(
        period: 'hour' | 'day' | 'week',
        lookbackCount: number = 24
    ): Promise<AggregatedStats[]> {
        const collectionName = `${this.config.collectionPrefix}-aggregates`;
        
        const snapshot = await this.db
            .collection(collectionName)
            .where('period', '==', period)
            .orderBy('periodStart', 'desc')
            .limit(lookbackCount)
            .get();

        return snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                ...data,
                periodStart: data.periodStart.toDate(),
                periodEnd: data.periodEnd.toDate()
            } as AggregatedStats;
        });
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
            logger.info('Metrics storage shutting down, flushing remaining metrics');
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

// Export singleton instance
export const metricsStorage = MetricsStorage.getInstance();