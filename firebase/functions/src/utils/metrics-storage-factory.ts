/**
 * Metrics Storage Factory
 * 
 * Creates the appropriate metrics storage implementation based on environment.
 * This allows for proper dependency injection and testability.
 */

import { MetricsStorage } from './metrics-storage';
import type { MetricsStorageConfig } from './metrics-storage';
import { getFirestore } from '../firebase';
import { FirestoreWriter } from '../services/firestore/FirestoreWriter';
import { FirestoreReader } from '../services/firestore/FirestoreReader';

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
 * Create a metrics storage instance
 */
export function createMetricsStorage(config?: Partial<MetricsStorageConfig>): IMetricsStorage {
    const db = getFirestore();
    const firestoreWriter = new FirestoreWriter(db);
    const firestoreReader = new FirestoreReader(db);
    
    return new MetricsStorage(firestoreWriter, firestoreReader, config);
}

