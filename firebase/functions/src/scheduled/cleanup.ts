/**
 * Scheduled cleanup function for change notifications
 * Removes old change documents to prevent storage bloat
 */

import { onSchedule } from 'firebase-functions/v2/scheduler';
import { admin } from '../firebase';
import { logger } from '../logger';

/**
 * Cleanup old change notifications every 5 minutes
 * Removes change documents older than 5 minutes
 */
export const cleanupChanges = onSchedule(
  {
    schedule: 'every 5 minutes',
    region: 'us-central1',
    memory: '256MiB' as any,
    timeoutSeconds: 120,
    retryCount: 2
  },
  async (event) => {
    const startTime = Date.now();
    const cutoffTime = startTime - (5 * 60 * 1000); // 5 minutes ago
    const batchSize = 500; // Process in chunks to avoid memory issues
    
    // Collections to clean up
    const collections = ['group-changes', 'expense-changes', 'balance-changes'];
    
    // Track metrics
    const metrics = {
      totalDeleted: 0,
      collectionCounts: {} as Record<string, number>,
      errors: [] as string[],
      duration: 0
    };
    
    logger.info('Starting change notification cleanup', { 
      cutoffTime: new Date(cutoffTime).toISOString() 
    });
    
    for (const collectionName of collections) {
      try {
        const deletedCount = await cleanupCollection(collectionName, cutoffTime, batchSize);
        metrics.collectionCounts[collectionName] = deletedCount;
        metrics.totalDeleted += deletedCount;
        
        if (deletedCount > 0) {
          logger.info(`Cleaned up ${deletedCount} documents from ${collectionName}`);
        }
      } catch (error: any) {
        const errorMessage = `Failed to cleanup ${collectionName}: ${error}` ;
        logger.error(errorMessage, { error });
        metrics.errors.push(errorMessage);
      }
    }
    
    // Calculate duration
    metrics.duration = Date.now() - startTime;
    
    // Log final metrics
    if (metrics.totalDeleted > 0 || metrics.errors.length > 0) {
      logger.info('Change notification cleanup completed', metrics);
    }
    
    // Store metrics for monitoring
    await storeCleanupMetrics(metrics);
    
    // Log metrics for monitoring (don't return - void function)
  }
);

/**
 * Clean up a single collection
 */
async function cleanupCollection(
  collectionName: string,
  cutoffTime: number,
  batchSize: number
): Promise<number> {
  let totalDeleted = 0;
  let hasMore = true;
  
  while (hasMore) {
    // Query for old documents
    const snapshot = await admin.firestore()
      .collection(collectionName)
      .where('timestamp', '<', cutoffTime)
      .limit(batchSize)
      .get();
    
    if (snapshot.empty) {
      hasMore = false;
      break;
    }
    
    // Delete in batch
    const batch = admin.firestore().batch();
    snapshot.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
    totalDeleted += snapshot.size;
    
    // If we got less than batchSize, we're done
    if (snapshot.size < batchSize) {
      hasMore = false;
    }
  }
  
  return totalDeleted;
}

/**
 * Store cleanup metrics for monitoring
 */
async function storeCleanupMetrics(metrics: {
  totalDeleted: number;
  collectionCounts: Record<string, number>;
  errors: string[];
  duration: number;
}): Promise<void> {
  try {
    const metricsDoc = {
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      lastRunAt: Date.now(),
      totalDeleted: metrics.totalDeleted,
      collectionCounts: metrics.collectionCounts,
      errors: metrics.errors,
      duration: metrics.duration,
      success: metrics.errors.length === 0
    };
    
    // Store in monitoring collection
    await admin.firestore()
      .collection('_monitoring')
      .doc('cleanup-metrics')
      .set(metricsDoc, { merge: true });
    
    // Also store historical record
    await admin.firestore()
      .collection('_monitoring')
      .doc('cleanup-history')
      .collection('runs')
      .add(metricsDoc);
    
  } catch (error: any) {
    // Don't fail the function if metrics storage fails
    logger.warn('Could not store cleanup metrics', { error: error as Error });
  }
}

/**
 * Manual cleanup function that can be triggered on-demand
 * Useful for testing or emergency cleanup
 */
export const manualCleanupChanges = onSchedule(
  {
    schedule: 'every 24 hours', // Run daily as a backup
    region: 'us-central1',
    memory: '512MiB' as any,
    timeoutSeconds: 300
  },
  async (event) => {
    const startTime = Date.now();
    const cutoffTime = startTime - (60 * 60 * 1000); // 1 hour ago for manual cleanup
    const batchSize = 1000; // Larger batch for manual cleanup
    
    const collections = ['group-changes', 'expense-changes', 'balance-changes'];
    let totalDeleted = 0;
    
    logger.info('Starting manual change notification cleanup', { 
      cutoffTime: new Date(cutoffTime).toISOString() 
    });
    
    for (const collectionName of collections) {
      try {
        const deletedCount = await cleanupCollection(collectionName, cutoffTime, batchSize);
        totalDeleted += deletedCount;
        
        if (deletedCount > 0) {
          logger.info(`Manual cleanup: Deleted ${deletedCount} documents from ${collectionName}`);
        }
      } catch (error: any) {
        logger.error(`Manual cleanup failed for ${collectionName}:`, { error: error as Error });
      }
    }
    
    const duration = Date.now() - startTime;
    logger.info('Manual cleanup completed', { 
      totalDeleted, 
      duration,
      durationSeconds: duration / 1000
    });
    
    // Log final metrics (don't return - void function)
    logger.info('Manual cleanup metrics', { totalDeleted, duration });
  }
);