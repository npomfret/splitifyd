import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { logger } from '../logger';

const recalculateGroupStats = async (groupId: string): Promise<void> => {
  const expensesCollection = admin.firestore().collection('expenses');
  
  const countSnapshot = await expensesCollection
    .where('groupId', '==', groupId)
    .count()
    .get();
  
  const expenseCount = countSnapshot.data().count;
  
  let lastExpenseTime: string | null = null;
  if (expenseCount > 0) {
    const lastExpenseSnapshot = await expensesCollection
      .where('groupId', '==', groupId)
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();
    
    if (!lastExpenseSnapshot.empty) {
      const lastExpenseData = lastExpenseSnapshot.docs[0].data();
      lastExpenseTime = (lastExpenseData.createdAt as any).toDate().toISOString();
    }
  }
  
  await admin.firestore().collection('documents').doc(groupId).update({
    'data.expenseCount': expenseCount,
    'data.lastExpenseTime': lastExpenseTime
  });
};

export const onExpenseCreateV5 = functions.firestore
  .document('expenses/{expenseId}')
  .onCreate(async (snapshot, context) => {
    const expense = snapshot.data();
    const groupId = expense.groupId;
    
    if (!groupId) {
      return;
    }
    
    try {
      await admin.firestore().collection('documents').doc(groupId).update({
        'data.expenseCount': admin.firestore.FieldValue.increment(1),
        'data.lastExpenseTime': (expense.createdAt as any).toDate().toISOString()
      });
    } catch (error) {
      logger.error('Failed to update group stats on expense create', { error: error as Error, groupId });
      throw error;
    }
  });

export const onExpenseUpdateV5 = functions.firestore
  .document('expenses/{expenseId}')
  .onUpdate(async (change, context) => {
    const beforeData = change.before.data();
    const afterData = change.after.data();
    
    if (!beforeData || !afterData) {
      return;
    }
    
    if (beforeData.groupId !== afterData.groupId) {
      if (beforeData.groupId) {
        await recalculateGroupStats(beforeData.groupId);
      }
      if (afterData.groupId) {
        await recalculateGroupStats(afterData.groupId);
      }
    } else if (afterData.groupId) {
      await recalculateGroupStats(afterData.groupId);
    }
  });

export const onExpenseDeleteV5 = functions.firestore
  .document('expenses/{expenseId}')
  .onDelete(async (snapshot, context) => {
    const expense = snapshot.data();
    const groupId = expense.groupId;
    
    if (!groupId) {
      return;
    }
    
    try {
      await recalculateGroupStats(groupId);
    } catch (error) {
      logger.error('Failed to update group stats on expense delete', { error: error as Error, groupId });
      throw error;
    }
  });