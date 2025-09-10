import {onSchedule} from 'firebase-functions/v2/scheduler';
import {logger} from '../logger';
import {FirestoreCollections} from '@splitifyd/shared';
import {IFirestoreReader, IFirestoreWriter} from "../services/firestore";
import {getAppBuilder} from "../index";
import {getFirestore} from "../firebase";
import {ApplicationBuilder} from "../services/ApplicationBuilder";

// Use singleton ApplicationBuilder
const firestore = getFirestore();
const appBuilder = new ApplicationBuilder(firestore);
const firestoreReader = appBuilder.buildFirestoreReader();
const firestoreWriter = appBuilder.buildFirestoreWriter();

/**
 * Core cleanup logic that can be called by both scheduled function and tests
 * @param firestoreReader - Firestore reader for querying documents
 * @param firestoreWriter - Firestore writer for delete operations and metrics
 * @param deleteAll - If true, delete all documents. If false, only delete documents older than specified minutes
 * @param logMetrics - Whether to log cleanup metrics (default: true)
 * @param minutesToKeep - How many minutes of documents to keep (default: 5, set to 0 for tests)
 * @returns Promise<number> - Total number of documents deleted
 */
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

    // Process all collections in parallel
    const cleanupPromises = collections.map(async (collectionName) => {
        try {
            if (logMetrics) {
                logger.info('cleanup-started', {collection: collectionName, deleteAll});
            }

            let collectionDeleteCount = 0;
            let hasMore = true;

            // Continue deleting until no more documents are found
            while (hasMore) {
                // Query for documents to delete using FirestoreReader
                const docs = deleteAll || minutesToKeep === 0
                    ? await firestoreReader.getOldDocuments(collectionName, new Date(0), 500) // Get all docs if deleteAll
                    : await firestoreReader.getOldDocuments(collectionName, cutoffDate, 500);

                if (docs.length === 0) {
                    hasMore = false;
                    continue;
                }

                // Prepare document paths for bulk delete
                const documentPaths = docs.map(doc => doc.ref.path);

                if (documentPaths.length > 0) {
                    // Use IFirestoreWriter for bulk delete
                    const deleteResult = await firestoreWriter.bulkDelete(documentPaths);
                    collectionDeleteCount += deleteResult.successCount;

                    // If we got fewer than 500 documents, we're done
                    if (documentPaths.length < 500) {
                        hasMore = false;
                    }
                } else {
                    hasMore = false;
                }
            }

            if (logMetrics && collectionDeleteCount > 0) {
                logger.info('cleanup-completed', {collection: collectionName, count: collectionDeleteCount, deleteAll});

                // Log metrics for monitoring using IFirestoreWriter
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
                logger.error(`Failed to cleanup ${collectionName}`, error as Error, {collection: collectionName, deleteAll});
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
        await performCleanup(firestoreReader, firestoreWriter, false, true, 5);
    },
);

/**
 * Log cleanup metrics for monitoring and analysis
 */
async function logCleanupMetrics(
    firestoreWriter: IFirestoreWriter,
    metrics: { collection: string; deletedCount: number; timestamp: string; deleteAll?: boolean }
): Promise<void> {
    try {
        // Store metrics for monitoring using IFirestoreWriter
        await firestoreWriter.addSystemMetrics({
            type: 'cleanup',
            ...metrics,
        });
    } catch (error) {
        // Don't fail cleanup if metrics logging fails - silently ignore
    }
}
