import { onSchedule } from 'firebase-functions/v2/scheduler';
import { admin } from '../firebase';
import { logger } from '../logger';

const db = admin.firestore();

/**
 * Clean up old change documents to prevent storage bloat
 * Runs daily at 2 AM UTC
 */
export const cleanupChanges = onSchedule(
    {
        schedule: 'every day 02:00',
        timeZone: 'UTC',
        region: 'us-central1',
        memory: '256MiB',
        maxInstances: 1,
    },
    async () => {
        const cutoffDate = new Date();
        cutoffDate.setHours(cutoffDate.getHours() - 24); // Keep last 24 hours of changes

        const collections = ['group-changes', 'expense-changes', 'balance-changes'];

        for (const collectionName of collections) {
            try {
                logger.info(`Cleaning up ${collectionName}`, { cutoffDate: cutoffDate.toISOString() });

                // Query for old documents
                const snapshot = await db
                    .collection(collectionName)
                    .where('timestamp', '<', cutoffDate)
                    .limit(500) // Process in batches to avoid timeouts
                    .get();

                if (snapshot.empty) {
                    logger.info(`No old documents in ${collectionName}`);
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

                logger.info(`Cleaned up ${deleteCount} documents from ${collectionName}`);
            } catch (error) {
                logger.errorWithContext(`Failed to cleanup ${collectionName}`, error as Error);
            }
        }
    },
);
