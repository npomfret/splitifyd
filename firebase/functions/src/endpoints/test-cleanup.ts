import { onRequest } from 'firebase-functions/v2/https';
import { performCleanup } from '../scheduled/cleanup';
import { logger } from '../logger';
import { getFirestore } from '../firebase';
import { ApplicationBuilder } from '../services/ApplicationBuilder';

const firestore = getFirestore();
const applicationBuilder = new ApplicationBuilder(firestore);
const firestoreReader = applicationBuilder.buildFirestoreReader();
const firestoreWriter = applicationBuilder.buildFirestoreWriter();

export const testCleanup = onRequest(
    {
        region: 'us-central1',
        memory: '256MiB',
        timeoutSeconds: 60,
    },
    async (req, res) => {
        if (process.env.NODE_ENV === 'production') {
            logger.error('test-cleanup-in-production', new Error('Production safety violation'));
            res.status(403).json({ 
                error: 'Test cleanup disabled in production'
            });
            return;
        }

        if (req.method !== 'POST') {
            res.status(405).json({ error: 'Method not allowed. Use POST.' });
            return;
        }

        try {
            logger.info('test-cleanup-start');
            
            const totalCleaned = await performCleanup(firestoreReader, firestoreWriter, false, false, 0);
            
            const response = {
                success: true,
                message: `Cleanup completed successfully`,
                documentsDeleted: totalCleaned,
                timestamp: new Date().toISOString()
            };
            
            logger.info('test-cleanup-complete', {documentsDeleted: totalCleaned});
            res.status(200).json(response);
            
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error('test-cleanup-failed', error as Error);
            
            res.status(500).json({
                success: false,
                error: 'Cleanup failed',
                message: errorMessage,
                timestamp: new Date().toISOString()
            });
        }
    }
);