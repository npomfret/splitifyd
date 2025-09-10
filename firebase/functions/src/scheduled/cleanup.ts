import {onSchedule} from 'firebase-functions/v2/scheduler';
import {logger} from '../logger';
import {FirestoreCollections} from '@splitifyd/shared';
import {IFirestoreReader, IFirestoreWriter} from "../services/firestore";
import {getAppBuilder} from "../index";
import {getFirestore} from "../firebase";
import {ApplicationBuilder} from "../services/ApplicationBuilder";

const firestore = getFirestore();
const appBuilder = new ApplicationBuilder(firestore);
const firestoreReader = appBuilder.buildFirestoreReader();
const firestoreWriter = appBuilder.buildFirestoreWriter();

export async function performCleanup(
    firestoreReader: IFirestoreReader,
    firestoreWriter: IFirestoreWriter,
    deleteAll = false,
    logMetrics = true,
    minutesToKeep = 5
): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setMinutes(cutoffDate.getMinutes() - minutesToKeep);

    const collections = [FirestoreCollections.TRANSACTION_CHANGES, FirestoreCollections.BALANCE_CHANGES];
    let totalDeleted = 0;

    const cleanupPromises = collections.map(async (collectionName) => {
        try {

            let collectionDeleteCount = 0;
            let hasMore = true;

            while (hasMore) {
                const docs = deleteAll || minutesToKeep === 0
                    ? await firestoreReader.getOldDocuments(collectionName, new Date(0), 500) // Get all docs if deleteAll
                    : await firestoreReader.getOldDocuments(collectionName, cutoffDate, 500);

                if (docs.length === 0) {
                    hasMore = false;
                    continue;
                }

                const documentPaths = docs.map(doc => doc.ref.path);

                if (documentPaths.length > 0) {
                    const deleteResult = await firestoreWriter.bulkDelete(documentPaths);
                    collectionDeleteCount += deleteResult.successCount;

                    if (documentPaths.length < 500) {
                        hasMore = false;
                    }
                } else {
                    hasMore = false;
                }
            }

            if (logMetrics && collectionDeleteCount > 0) {
                logger.info('cleanup-completed', {collection: collectionName, count: collectionDeleteCount});

                await logCleanupMetrics(firestoreWriter, {
                    collection: collectionName,
                    deletedCount: collectionDeleteCount,
                    timestamp: new Date().toISOString(),
                    deleteAll,
                });
            }

            return collectionDeleteCount;
        } catch (error) {
            if (logMetrics) {
                logger.error('cleanup-failed', error as Error, {collection: collectionName});
            }
            return 0;
        }
    });

    const deleteCounts = await Promise.all(cleanupPromises);
    totalDeleted = deleteCounts.reduce((sum, count) => sum + count, 0);

    return totalDeleted;
}

export const cleanupChanges = onSchedule(
    {
        schedule: 'every 5 minutes',
        timeZone: 'UTC',
        region: 'us-central1',
        memory: '256MiB',
        maxInstances: 1,
    },
    async () => {
        await performCleanup(firestoreReader, firestoreWriter, false, true, 5);
    },
);

async function logCleanupMetrics(
    firestoreWriter: IFirestoreWriter,
    metrics: { collection: string; deletedCount: number; timestamp: string; deleteAll?: boolean }
): Promise<void> {
    try {
        await firestoreWriter.addSystemMetrics({
            type: 'cleanup',
            ...metrics,
        });
    } catch (error) {
    }
}
