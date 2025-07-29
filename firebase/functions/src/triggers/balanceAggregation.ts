import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { updateGroupBalances } from '../services/balanceCalculator';
import { logger } from '../logger';
import { db } from '../firebase';
import { FieldValue } from 'firebase-admin/firestore';

export const onExpenseWriteV6 = onDocumentWritten({
    document: 'expenses/{expenseId}',
    region: 'us-central1',
    memory: '512MiB',
    maxInstances: 5,
    timeoutSeconds: 20,
}, async (event) => {
    const expenseId = event.params.expenseId;
    const eventId = event.id;
    const change = event.data;
    
    if (!change) {
        logger.error('No change data in event', { expenseId, eventId });
        return;
    }
        
        let groupId: string | null = null;
        
        if (change.after.exists) {
            const data = change.after.data();
            groupId = data?.groupId;
        } else if (change.before.exists) {
            const data = change.before.data();
            groupId = data?.groupId;
        }
        
        if (!groupId) {
            logger.error('No groupId found for expense', { expenseId, eventId });
            return;
        }

        // Idempotency check using eventId with trigger name to prevent duplicate processing
        const processingDoc = db.collection('_processing_events').doc(`${eventId}-balanceUpdate`);
        
        try {
            await db.runTransaction(async (transaction) => {
                const processingSnapshot = await transaction.get(processingDoc);
                
                if (processingSnapshot.exists && processingSnapshot.data()?.processed === true) {
                    logger.info('Event already processed, skipping', { eventId, expenseId, groupId });
                    return;
                }
                
                // Mark as processing
                transaction.set(processingDoc, { 
                    processed: true, 
                    expenseId, 
                    groupId, 
                    timestamp: FieldValue.serverTimestamp() 
                });
                
                // Update group balances
                await updateGroupBalances(groupId);
                logger.info('Updated group balances', { groupId, expenseId, eventId });
            });
        } catch (error) {
            logger.error('Failed to update group balances', { 
                groupId, 
                expenseId, 
                eventId,
                error: error instanceof Error ? error : new Error(String(error))
            });
            throw error;
        }
    });