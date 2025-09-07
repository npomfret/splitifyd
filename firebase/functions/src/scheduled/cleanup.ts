import { onSchedule } from 'firebase-functions/v2/scheduler';
import {getFirestore} from '../firebase';
import { FieldValue } from 'firebase-admin/firestore';
import { logger } from '../logger';
import { FirestoreCollections } from '@splitifyd/shared';

/**
 * Core cleanup logic that can be called by both scheduled function and tests
 * @param deleteAll - If true, delete all documents. If false, only delete documents older than specified minutes
 * @param logMetrics - Whether to log cleanup metrics (default: true)
 * @param minutesToKeep - How many minutes of documents to keep (default: 5, set to 0 for tests)
 * @returns Promise<number> - Total number of documents deleted
 */
export async function performCleanup(deleteAll = false, logMetrics = true, minutesToKeep = 5): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setMinutes(cutoffDate.getMinutes() - minutesToKeep);

    const collections = [FirestoreCollections.TRANSACTION_CHANGES, FirestoreCollections.BALANCE_CHANGES];
    let totalDeleted = 0;

    // Process all collections in parallel
    const cleanupPromises = collections.map(async (collectionName) => {
        try {
            if (logMetrics) {
                logger.info('cleanup-started', { collection: collectionName, deleteAll });
            }

            let collectionDeleteCount = 0;
            let hasMore = true;

            // Continue deleting until no more documents are found
            while (hasMore) {
                // Query for documents to delete
                const snapshot = deleteAll || minutesToKeep === 0
                    ? await getFirestore().collection(collectionName).limit(500).get()
                    : await getFirestore().collection(collectionName)
                        .where('timestamp', '<', cutoffDate)
                        .limit(500)
                        .get();

                if (snapshot.empty) {
                    hasMore = false;
                    continue;
                }

                // Delete in batches
                const batch = getFirestore().batch();
                let batchDeleteCount = 0;

                snapshot.docs.forEach((doc) => {
                    batch.delete(doc.ref);
                    batchDeleteCount++;
                });

                if (batchDeleteCount > 0) {
                    await batch.commit();
                    collectionDeleteCount += batchDeleteCount;

                    // If we got fewer than 500 documents, we're done
                    if (batchDeleteCount < 500) {
                        hasMore = false;
                    }
                } else {
                    hasMore = false;
                }
            }

            if (logMetrics && collectionDeleteCount > 0) {
                logger.info('cleanup-completed', { collection: collectionName, count: collectionDeleteCount, deleteAll });

                // Log metrics for monitoring
                await logCleanupMetrics({
                    collection: collectionName,
                    deletedCount: collectionDeleteCount,
                    timestamp: new Date().toISOString(),
                    deleteAll,
                });
            }

            return collectionDeleteCount;
        } catch (error) {
            if (logMetrics) {
                logger.error(`Failed to cleanup ${collectionName}`, error as Error, { collection: collectionName, deleteAll });
            }
            return 0;
        }
    });

    // Wait for all collections to complete and sum the results
    const deleteCounts = await Promise.all(cleanupPromises);
    totalDeleted = deleteCounts.reduce((sum, count) => sum + count, 0);

    return totalDeleted;
}

/**
 * Clean up old change documents to prevent storage bloat
 * Runs every 5 minutes to keep change collections small
 * Only keeps changes from the last 5 minutes for real-time notifications
 */
export const cleanupChanges = onSchedule(
    {
        schedule: 'every 5 minutes',
        timeZone: 'UTC',
        region: 'us-central1',
        memory: '256MiB',
        maxInstances: 1,
    },
    async () => {
        await performCleanup(false, true, 5); // Delete only old documents, with metrics logging
    },
);

/**
 * Log cleanup metrics for monitoring and analysis
 */
async function logCleanupMetrics(metrics: { collection: string; deletedCount: number; timestamp: string; deleteAll?: boolean }): Promise<void> {
    try {
        // Store metrics for monitoring (could be sent to external service)
        await getFirestore().collection('system-metrics').add({
            type: 'cleanup',
            ...metrics,
            createdAt: FieldValue.serverTimestamp(),
        });
    } catch (error) {
        // Don't fail cleanup if metrics logging fails - silently ignore
    }
}
