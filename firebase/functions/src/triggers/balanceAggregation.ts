import * as functions from 'firebase-functions/v1';
import { updateGroupBalances } from '../services/balanceCalculator';
import { logger } from '../logger';

export const onExpenseWrite = functions.firestore
    .document('expenses/{expenseId}')
    .onWrite(async (change: any, context: any) => {
        const expenseId = context.params.expenseId;
        
        let groupId: string | null = null;
        
        if (change.after.exists) {
            const data = change.after.data();
            groupId = data?.groupId;
        } else if (change.before.exists) {
            const data = change.before.data();
            groupId = data?.groupId;
        }
        
        if (!groupId) {
            logger.error('No groupId found for expense', { expenseId });
            return;
        }

        try {
            await updateGroupBalances(groupId);
            logger.info('Updated group balances', { groupId, expenseId });
        } catch (error) {
            logger.error('Failed to update group balances', { 
                groupId, 
                expenseId, 
                error: error instanceof Error ? error : new Error(String(error))
            });
            throw error;
        }
    });