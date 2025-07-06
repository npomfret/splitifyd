import { onDocumentCreated, onDocumentUpdated, onDocumentDeleted } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';

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

export const onExpenseCreate = onDocumentCreated('expenses/{expenseId}', async (event) => {
  const snapshot = event.data;
  if (!snapshot) {
    return;
  }
  
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
    console.error('Failed to update group stats on expense create:', error);
    throw error;
  }
});

export const onExpenseUpdate = onDocumentUpdated('expenses/{expenseId}', async (event) => {
  const beforeData = event.data?.before.data();
  const afterData = event.data?.after.data();
  
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

export const onExpenseDelete = onDocumentDeleted('expenses/{expenseId}', async (event) => {
  const snapshot = event.data;
  if (!snapshot) {
    return;
  }
  
  const expense = snapshot.data();
  const groupId = expense.groupId;
  
  if (!groupId) {
    return;
  }
  
  try {
    await recalculateGroupStats(groupId);
  } catch (error) {
    console.error('Failed to update group stats on expense delete:', error);
    throw error;
  }
});