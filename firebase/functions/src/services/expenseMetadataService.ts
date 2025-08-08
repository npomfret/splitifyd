import * as admin from 'firebase-admin';
import { FirestoreCollections } from '../types/webapp-shared-types';

export interface ExpenseMetadata {
  expenseCount: number;
  lastExpenseTime?: Date;
  lastExpense?: {
    description: string;
    amount: number;
    date: Date;
  };
}

/**
 * Calculate expense metadata for a group on-demand
 */
export const calculateExpenseMetadata = async (groupId: string): Promise<ExpenseMetadata> => {
  if (!groupId) {
    throw new Error('Group ID is required');
  }

  const expensesQuery = admin.firestore()
    .collection(FirestoreCollections.EXPENSES)
    .where('groupId', '==', groupId)
    .orderBy('createdAt', 'desc');

  const snapshot = await expensesQuery.get();
  
  const expenseCount = snapshot.size;
  
  if (expenseCount === 0) {
    return {
      expenseCount: 0,
      lastExpenseTime: undefined,
      lastExpense: undefined
    };
  }

  // Get the most recent expense
  const latestExpenseDoc = snapshot.docs[0];
  const latestExpenseData = latestExpenseDoc.data();

  return {
    expenseCount,
    lastExpenseTime: latestExpenseData.createdAt?.toDate(),
    lastExpense: {
      description: latestExpenseData.description,
      amount: latestExpenseData.amount,
      date: latestExpenseData.date?.toDate() ?? latestExpenseData.createdAt?.toDate() ?? new Date()
    }
  };
};