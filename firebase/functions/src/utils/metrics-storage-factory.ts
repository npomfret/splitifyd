/**
 * Metrics Storage Factory
 * 
 * Creates the appropriate metrics storage implementation based on environment.
 * This allows for proper dependency injection and testability.
 */

import { isTest } from '../firebase';
import { MetricsStorage } from './metrics-storage';
import { TestMetricsStorage } from './test-metrics-storage';
import type { MetricsStorageConfig } from './metrics-storage';

// Interface for metrics storage operations
export interface IMetricsStorage {
    storeMetric(metric: any): Promise<void>;
    storeMetrics(metrics: any[]): Promise<void>;
    flush(): Promise<void>;
    storeAggregatedStats(stats: any): Promise<any>;
    queryRecentMetrics(minutes: number, filters?: any): Promise<any[]>;
    queryAggregatedStats(period: string, lookbackCount?: number): Promise<any[]>;
    getStats(): any;
    reset(): void;
}

/**
 * Create a metrics storage instance based on environment
 */
export function createMetricsStorage(config?: Partial<MetricsStorageConfig>): IMetricsStorage {
    if (isTest()) {
        return new TestMetricsStorage(config);
    } else {
        return new MetricsStorage(config);
    }
}

// Default instance for backwards compatibility
export const metricsStorage = createMetricsStorage();