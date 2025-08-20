import { onSchedule } from 'firebase-functions/v2/scheduler';
import { admin, db } from '../firebase';
import { logger } from '../logger';
import { FirestoreCollections } from '../shared/shared-types';

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
        const cutoffDate = new Date();
        cutoffDate.setMinutes(cutoffDate.getMinutes() - 5); // Keep only last 5 minutes of changes

        const collections = [FirestoreCollections.GROUP_CHANGES, FirestoreCollections.TRANSACTION_CHANGES, FirestoreCollections.BALANCE_CHANGES];

        for (const collectionName of collections) {
            try {
                logger.info('cleanup-started', { collection: collectionName });

                // Query for old documents
                const snapshot = await db
                    .collection(collectionName)
                    .where('timestamp', '<', cutoffDate)
                    .limit(500) // Process in batches to avoid timeouts
                    .get();

                if (snapshot.empty) {
                    continue;
                }

                // Delete in batches
                const batch = db.batch();
                let deleteCount = 0;

                snapshot.docs.forEach((doc) => {
                    batch.delete(doc.ref);
                    deleteCount++;
                });

                await batch.commit();

                logger.info('cleanup-completed', { collection: collectionName, count: deleteCount });
                
                // Log metrics for monitoring
                await logCleanupMetrics({
                    collection: collectionName,
                    deletedCount: deleteCount,
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                logger.error(`Failed to cleanup ${collectionName}`, error as Error, { collection: collectionName });
            }
        }
    },
);

/**
 * Log cleanup metrics for monitoring and analysis
 */
async function logCleanupMetrics(metrics: {
    collection: string;
    deletedCount: number;
    timestamp: string;
}): Promise<void> {
    try {
        // Store metrics for monitoring (could be sent to external service)
        await db.collection('system-metrics').add({
            type: 'cleanup',
            ...metrics,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
    } catch (error) {
        // Don't fail cleanup if metrics logging fails - silently ignore
    }
}
