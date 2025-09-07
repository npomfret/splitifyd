/**
 * Scheduled job for cleaning up old performance metrics
 * 
 * Runs daily to:
 * - Delete raw metrics older than 7 days
 * - Delete aggregated stats older than 30 days
 * - Delete performance alerts older than 90 days
 * - Optimize Firestore storage costs
 */

import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getFirestore } from '../firebase';
import { Timestamp } from 'firebase-admin/firestore';
import { logger } from '../logger';

export interface CleanupConfig {
    rawMetricsRetentionDays: number;
    aggregatesRetentionDays: number;
    alertsRetentionDays: number;
    batchSize: number;
    maxDeletesPerRun: number;
}

const DEFAULT_CONFIG: CleanupConfig = {
    rawMetricsRetentionDays: 7,
    aggregatesRetentionDays: 30,
    alertsRetentionDays: 90,
    batchSize: 500,
    maxDeletesPerRun: 10000
};

/**
 * Core cleanup logic that can be called by both scheduled function and tests
 */
export async function performMetricsCleanup(
    config: Partial<CleanupConfig> = {},
    logMetrics: boolean = true
): Promise<{ deletedCounts: Record<string, number>; totalDeleted: number }> {
    const finalConfig = { ...DEFAULT_CONFIG, ...config };
    const db = getFirestore();
    const deletedCounts: Record<string, number> = {};
    let totalDeleted = 0;

    try {
        // Calculate cutoff dates
        const now = new Date();
        const rawMetricsCutoff = new Date();
        rawMetricsCutoff.setDate(now.getDate() - finalConfig.rawMetricsRetentionDays);
        
        const aggregatesCutoff = new Date();
        aggregatesCutoff.setDate(now.getDate() - finalConfig.aggregatesRetentionDays);
        
        const alertsCutoff = new Date();
        alertsCutoff.setDate(now.getDate() - finalConfig.alertsRetentionDays);

        // Clean up raw metrics collection
        const rawMetricsDeleted = await cleanupCollection(
            db,
            'performance-metrics',
            'timestamp',
            rawMetricsCutoff,
            finalConfig,
            logMetrics
        );
        deletedCounts['raw_metrics'] = rawMetricsDeleted;
        totalDeleted += rawMetricsDeleted;

        // Clean up aggregated stats
        const aggregatesDeleted = await cleanupCollection(
            db,
            'performance-aggregates',
            'periodEnd',
            aggregatesCutoff,
            finalConfig,
            logMetrics
        );
        deletedCounts['aggregates'] = aggregatesDeleted;
        totalDeleted += aggregatesDeleted;

        // Clean up performance alerts (if collection exists)
        const alertsDeleted = await cleanupCollection(
            db,
            'performance-alerts',
            'timestamp',
            alertsCutoff,
            finalConfig,
            logMetrics
        );
        deletedCounts['alerts'] = alertsDeleted;
        totalDeleted += alertsDeleted;

        // Clean up system metrics (used by cleanup itself)
        const systemMetricsDeleted = await cleanupCollection(
            db,
            'system-metrics',
            'createdAt',
            aggregatesCutoff,
            finalConfig,
            logMetrics
        );
        deletedCounts['system_metrics'] = systemMetricsDeleted;
        totalDeleted += systemMetricsDeleted;

        if (logMetrics) {
            logger.info('Metrics cleanup completed', {
                deletedCounts,
                totalDeleted,
                config: finalConfig
            });

            // Log cleanup metrics
            await logCleanupMetrics(db, deletedCounts, totalDeleted);
        }

        return { deletedCounts, totalDeleted };
    } catch (error) {
        logger.error('Failed to cleanup metrics', error, {
            config: finalConfig
        });
        return { deletedCounts, totalDeleted: 0 };
    }
}


/**
 * Clean up a specific collection
 */
async function cleanupCollection(
    db: FirebaseFirestore.Firestore,
    collectionName: string,
    timestampField: string,
    cutoffDate: Date,
    config: CleanupConfig,
    logMetrics: boolean
): Promise<number> {
    let totalDeleted = 0;
    let hasMore = true;
    const cutoffTimestamp = Timestamp.fromDate(cutoffDate);

    while (hasMore && totalDeleted < config.maxDeletesPerRun) {
        try {
            // Query for old documents
            const snapshot = await db
                .collection(collectionName)
                .where(timestampField, '<', cutoffTimestamp)
                .limit(Math.min(config.batchSize, config.maxDeletesPerRun - totalDeleted))
                .get();

            if (snapshot.empty) {
                hasMore = false;
                continue;
            }

            // Delete in batch
            const batch = db.batch();
            snapshot.docs.forEach(doc => {
                batch.delete(doc.ref);
            });

            await batch.commit();
            totalDeleted += snapshot.size;

            // Check if there might be more documents
            hasMore = snapshot.size === config.batchSize;

            if (logMetrics && totalDeleted > 0 && totalDeleted % 1000 === 0) {
                logger.info(`Cleanup progress`, {
                    collection: collectionName,
                    deleted: totalDeleted
                });
            }
        } catch (error) {
            logger.error(`Failed to cleanup collection ${collectionName}`, error);
            hasMore = false;
        }
    }

    if (logMetrics && totalDeleted > 0) {
        logger.info(`Cleaned up collection`, {
            collection: collectionName,
            documentsDeleted: totalDeleted,
            cutoffDate: cutoffDate.toISOString()
        });
    }

    return totalDeleted;
}

/**
 * Delete an entire collection
 */
async function deleteEntireCollection(
    db: FirebaseFirestore.Firestore,
    collectionName: string,
    batchSize: number,
    maxDeletes: number
): Promise<number> {
    let totalDeleted = 0;
    let hasMore = true;

    while (hasMore && totalDeleted < maxDeletes) {
        try {
            const snapshot = await db
                .collection(collectionName)
                .limit(Math.min(batchSize, maxDeletes - totalDeleted))
                .get();

            if (snapshot.empty) {
                hasMore = false;
                continue;
            }

            const batch = db.batch();
            snapshot.docs.forEach(doc => {
                batch.delete(doc.ref);
            });

            await batch.commit();
            totalDeleted += snapshot.size;

            hasMore = snapshot.size === batchSize;
        } catch (error) {
            logger.error(`Failed to delete collection ${collectionName}`, error);
            hasMore = false;
        }
    }

    return totalDeleted;
}

/**
 * Log cleanup metrics for monitoring
 */
async function logCleanupMetrics(
    db: FirebaseFirestore.Firestore,
    deletedCounts: Record<string, number>,
    totalDeleted: number
): Promise<void> {
    try {
        await db.collection('system-metrics').add({
            type: 'metrics-cleanup',
            timestamp: Timestamp.now(),
            deletedCounts,
            totalDeleted,
            createdAt: Timestamp.now()
        });
    } catch (error) {
        // Don't fail cleanup if metrics logging fails
        logger.error('Failed to log cleanup metrics', error);
    }
}

/**
 * Scheduled function for metrics cleanup
 * Runs daily at 3 AM UTC
 */
export const cleanupMetrics = onSchedule(
    {
        schedule: 'every day 03:00',
        timeZone: 'UTC',
        region: 'us-central1',
        memory: '512MiB',
        maxInstances: 1,
    },
    async () => {
        await performMetricsCleanup({}, true);
    }
);

/**
 * Aggressive cleanup for emergencies
 * Can be triggered manually if storage is running low
 */
export const aggressiveMetricsCleanup = onSchedule(
    {
        // Disabled by default - uncomment and deploy to enable
        // schedule: 'every sunday 04:00',
        schedule: 'every 9999 hours', // Effectively disabled
        timeZone: 'UTC',
        region: 'us-central1',
        memory: '1GiB',
        maxInstances: 1,
    },
    async () => {
        // More aggressive retention periods
        await performMetricsCleanup({
            rawMetricsRetentionDays: 3,
            aggregatesRetentionDays: 14,
            alertsRetentionDays: 30,
            maxDeletesPerRun: 50000
        }, true);
    }
);