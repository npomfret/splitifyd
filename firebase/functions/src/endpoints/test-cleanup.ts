import { onRequest } from 'firebase-functions/v2/https';
import { performCleanup } from '../scheduled/cleanup';
import { logger } from '../logger';
import { getFirestore } from '../firebase';
import { ApplicationBuilder } from '../services/ApplicationBuilder';

/**
 * HTTP endpoint for cleaning up change documents during tests
 * ONLY works in non-production environments for safety
 */
export const testCleanup = onRequest(
    {
        region: 'us-central1',
        memory: '256MiB',
        timeoutSeconds: 60,
    },
    async (req, res) => {
        // Safety check - blow up if called in production
        if (process.env.NODE_ENV === 'production') {
            const errorMessage = 'TEST CLEANUP ENDPOINT CALLED IN PRODUCTION - THIS SHOULD NEVER HAPPEN!';
            logger.error(errorMessage, new Error('Production safety violation'));
            res.status(403).json({ 
                error: errorMessage,
                message: 'Test cleanup endpoint is disabled in production for safety'
            });
            return;
        }

        // Only allow POST requests
        if (req.method !== 'POST') {
            res.status(405).json({ error: 'Method not allowed. Use POST.' });
            return;
        }

        try {
            logger.info('Test cleanup endpoint called');
            
            // Create services with dependency injection
            const firestore = getFirestore();
            const applicationBuilder = new ApplicationBuilder(firestore);
            const firestoreReader = applicationBuilder.buildFirestoreReader();
            const firestoreWriter = applicationBuilder.buildFirestoreWriter();
            
            // Delete all change documents (minutesToKeep = 0, no metrics logging)
            const totalCleaned = await performCleanup(firestoreReader, firestoreWriter, false, false, 0);
            
            const response = {
                success: true,
                message: `Cleanup completed successfully`,
                documentsDeleted: totalCleaned,
                timestamp: new Date().toISOString()
            };
            
            logger.info('Test cleanup completed', response);
            res.status(200).json(response);
            
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error('Test cleanup failed', error as Error);
            
            res.status(500).json({
                success: false,
                error: 'Cleanup failed',
                message: errorMessage,
                timestamp: new Date().toISOString()
            });
        }
    }
);