/**
 * Test-only Metrics Storage
 * 
 * A no-op implementation of MetricsStorage that prevents actual Firestore operations during tests.
 * This is automatically used when NODE_ENV indicates a test environment.
 */

import { logger } from '../logger';
import type { PerformanceMetric, AggregatedStats, MetricsStorageConfig } from './metrics-storage';
import type { WriteResult } from '../services/firestore/IFirestoreWriter';
import { Timestamp } from 'firebase-admin/firestore';

export class TestMetricsStorage {
    private static instance: TestMetricsStorage;
    private config: MetricsStorageConfig;

    constructor(config?: Partial<MetricsStorageConfig>) {
        this.config = {
            bufferSize: 100,
            flushIntervalMs: 30000,
            maxBatchSize: 500,
            compressionEnabled: true,
            collectionPrefix: 'performance',
            ...config
        };

        logger.info('TestMetricsStorage: Initialized (no Firestore operations will be performed)');
    }

    static getInstance(config?: Partial<MetricsStorageConfig>): TestMetricsStorage {
        if (!TestMetricsStorage.instance) {
            TestMetricsStorage.instance = new TestMetricsStorage(config);
        }
        return TestMetricsStorage.instance;
    }

    /**
     * No-op store metric implementation
     */
    async storeMetric(metric: PerformanceMetric): Promise<void> {
        // No-op for tests
    }

    /**
     * No-op store multiple metrics implementation
     */
    async storeMetrics(metrics: PerformanceMetric[]): Promise<void> {
        // No-op for tests
    }

    /**
     * No-op flush implementation
     */
    async flush(): Promise<void> {
        // No-op for tests
    }

    /**
     * No-op store aggregated stats implementation
     */
    async storeAggregatedStats(stats: AggregatedStats): Promise<WriteResult> {
        return {
            id: 'test-id',
            success: true,
            timestamp: Timestamp.now()
        };
    }

    /**
     * Mock query recent metrics implementation
     */
    async queryRecentMetrics(
        minutes: number,
        filters?: {
            operationType?: string;
            operationName?: string;
            success?: boolean;
        }
    ): Promise<PerformanceMetric[]> {
        return [];
    }

    /**
     * Mock query aggregated stats implementation
     */
    async queryAggregatedStats(
        period: 'hour' | 'day' | 'week',
        lookbackCount: number = 24
    ): Promise<AggregatedStats[]> {
        return [];
    }

    /**
     * Mock get stats implementation
     */
    getStats(): {
        bufferSize: number;
        isShuttingDown: boolean;
        config: MetricsStorageConfig;
    } {
        return {
            bufferSize: 0,
            isShuttingDown: false,
            config: { ...this.config }
        };
    }

    /**
     * No-op reset implementation
     */
    reset(): void {
        // No-op for tests
    }
}