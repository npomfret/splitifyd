import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { admin } from '../firebase';
import { logger } from '../logger';
import * as adminFirestore from 'firebase-admin/firestore';

const db = admin.firestore();

/**
 * Track changes to groups and create change documents for realtime updates
 */
export const trackGroupChanges = onDocumentWritten(
  {
    document: 'groups/{groupId}',
    region: 'us-central1',
  },
  async (event) => {
    const groupId = event.params.groupId;
    const beforeData = event.data?.before?.data();
    const afterData = event.data?.after?.data();
    
    logger.info('trackGroupChanges triggered', { 
      groupId, 
      hasBeforeData: !!beforeData,
      hasAfterData: !!afterData,
      afterDataKeys: afterData ? Object.keys(afterData) : [],
      memberIds: afterData?.data?.memberIds || beforeData?.data?.memberIds
    });
    
    // Determine change type
    let changeType: 'created' | 'updated' | 'deleted';
    if (!beforeData && afterData) {
      changeType = 'created';
    } else if (beforeData && !afterData) {
      changeType = 'deleted';
    } else {
      changeType = 'updated';
    }
    
    try {
      // Get affected users from the group (nested in data field)
      const affectedUsers = afterData?.data?.memberIds || beforeData?.data?.memberIds || [];
      
      logger.info('Creating change document', { groupId, changeType, affectedUsers });
      
      // Create change document with proper timestamp
      const changeDoc = {
        groupId,
        changeType,
        timestamp: adminFirestore.Timestamp.now(),
        metadata: {
          affectedUsers,
        },
      };
      
      // Write to group-changes collection
      const docRef = await db.collection('group-changes').add(changeDoc);
      
      logger.info('Group change tracked', { groupId, changeType, changeDocId: docRef.id });
    } catch (error) {
      logger.errorWithContext('Failed to track group change', error as Error, { groupId });
    }
  }
);

/**
 * Track changes to expenses and create change documents for realtime updates
 */
export const trackExpenseChanges = onDocumentWritten(
  {
    document: 'expenses/{expenseId}',
    region: 'us-central1',
  },
  async (event) => {
    const expenseId = event.params.expenseId;
    const beforeData = event.data?.before?.data();
    const afterData = event.data?.after?.data();
    
    // Determine change type
    let changeType: 'created' | 'updated' | 'deleted';
    if (!beforeData && afterData) {
      changeType = 'created';
    } else if (beforeData && !afterData) {
      changeType = 'deleted';
    } else {
      changeType = 'updated';
    }
    
    try {
      // Get groupId from expense data
      const groupId = afterData?.groupId || beforeData?.groupId;
      if (!groupId) {
        logger.warn('Expense has no groupId', { expenseId });
        return;
      }
      
      // Get affected users (paidBy and splitBetween)
      const affectedUsers = new Set<string>();
      
      if (afterData) {
        affectedUsers.add(afterData.paidBy);
        afterData.splitBetween?.forEach((userId: string) => affectedUsers.add(userId));
      }
      if (beforeData) {
        affectedUsers.add(beforeData.paidBy);
        beforeData.splitBetween?.forEach((userId: string) => affectedUsers.add(userId));
      }
      
      // Create change document
      const changeDoc = {
        groupId,
        expenseId,
        changeType,
        timestamp: adminFirestore.Timestamp.now(),
        metadata: {
          affectedUsers: Array.from(affectedUsers),
        },
      };
      
      // Write to expense-changes collection
      await db.collection('expense-changes').add(changeDoc);
      
      // Also create a balance change document since expenses affect balances
      const balanceChangeDoc = {
        groupId,
        changeType: 'recalculated' as const,
        timestamp: adminFirestore.Timestamp.now(),
        metadata: {
          affectedUsers: Array.from(affectedUsers),
          triggeredBy: 'expense',
          triggerId: expenseId,
        },
      };
      
      await db.collection('balance-changes').add(balanceChangeDoc);
      
      logger.info('Expense change tracked', { expenseId, groupId, changeType });
    } catch (error) {
      logger.errorWithContext('Failed to track expense change', error as Error, { expenseId });
    }
  }
);

/**
 * Track changes to settlements and create change documents for realtime updates
 */
export const trackSettlementChanges = onDocumentWritten(
  {
    document: 'settlements/{settlementId}',
    region: 'us-central1',
  },
  async (event) => {
    const settlementId = event.params.settlementId;
    const beforeData = event.data?.before?.data();
    const afterData = event.data?.after?.data();
    
    // Determine change type
    let changeType: 'created' | 'updated' | 'deleted';
    if (!beforeData && afterData) {
      changeType = 'created';
    } else if (beforeData && !afterData) {
      changeType = 'deleted';
    } else {
      changeType = 'updated';
    }
    
    try {
      // Get groupId from settlement data
      const groupId = afterData?.groupId || beforeData?.groupId;
      if (!groupId) {
        logger.warn('Settlement has no groupId', { settlementId });
        return;
      }
      
      // Get affected users (from and to)
      const affectedUsers = new Set<string>();
      
      if (afterData) {
        affectedUsers.add(afterData.from);
        affectedUsers.add(afterData.to);
      }
      if (beforeData) {
        affectedUsers.add(beforeData.from);
        affectedUsers.add(beforeData.to);
      }
      
      // Create change document
      const changeDoc = {
        groupId,
        settlementId,
        changeType,
        timestamp: adminFirestore.Timestamp.now(),
        metadata: {
          affectedUsers: Array.from(affectedUsers),
        },
      };
      
      // Write to expense-changes collection (settlements are treated as expenses)
      await db.collection('expense-changes').add(changeDoc);
      
      // Also create a balance change document since settlements affect balances
      const balanceChangeDoc = {
        groupId,
        changeType: 'recalculated' as const,
        timestamp: adminFirestore.Timestamp.now(),
        metadata: {
          affectedUsers: Array.from(affectedUsers),
          triggeredBy: 'settlement',
          triggerId: settlementId,
        },
      };
      
      await db.collection('balance-changes').add(balanceChangeDoc);
      
      logger.info('Settlement change tracked', { settlementId, groupId, changeType });
    } catch (error) {
      logger.errorWithContext('Failed to track settlement change', error as Error, { settlementId });
    }
  }
);