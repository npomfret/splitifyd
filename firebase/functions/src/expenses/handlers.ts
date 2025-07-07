import { Response } from 'express';
import * as admin from 'firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import { AuthenticatedRequest } from '../auth/middleware';
import { validateUserAuth } from '../auth/utils';
import { Errors, ApiError } from '../utils/errors';
import { toISOString } from '../utils/date';
import { logger } from '../logger';
import { HTTP_STATUS } from '../constants';
import {
  validateCreateExpense,
  validateUpdateExpense,
  validateExpenseId,
  calculateSplits,
  Expense
} from './validation';

const getExpensesCollection = () => {
  return admin.firestore().collection('expenses');
};

const getGroupsCollection = () => {
  return admin.firestore().collection('documents');
};



const verifyGroupMembership = async (groupId: string, userId: string): Promise<void> => {
  const groupDoc = await getGroupsCollection().doc(groupId).get();
  
  if (!groupDoc.exists) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, 'GROUP_NOT_FOUND', 'Group not found');
  }

  const groupData = groupDoc.data();
  
  // Check if this is a group document (has data.members)
  if (!groupData || !groupData.data || !groupData.data.name) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, 'GROUP_NOT_FOUND', 'Group not found');
  }
  
  // Check if user owns the document (groups are owned by their creator for now)
  if (groupData.userId !== userId) {
    // In the future, we'd check groupData.data.members array
    // For now, only the creator can add expenses
    throw new ApiError(HTTP_STATUS.FORBIDDEN, 'NOT_GROUP_MEMBER', 'You are not a member of this group');
  }
};

const fetchExpense = async (expenseId: string, userId: string): Promise<{ docRef: admin.firestore.DocumentReference, expense: Expense }> => {
  const docRef = getExpensesCollection().doc(expenseId);
  const doc = await docRef.get();

  if (!doc.exists) {
    throw Errors.NOT_FOUND('Expense');
  }

  const expense = doc.data() as Expense;

  await verifyGroupMembership(expense.groupId, userId);

  return { docRef, expense };
};

export const createExpense = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const userId = validateUserAuth(req);

  logger.info('Creating expense', { userId, body: req.body });

  const expenseData = validateCreateExpense(req.body);

  logger.info('Expense data validated', { userId, expenseData });

  await verifyGroupMembership(expenseData.groupId, userId);

  const now = new Date();
  const docRef = getExpensesCollection().doc();
  
  const splits = calculateSplits(
    expenseData.amount,
    expenseData.splitType,
    expenseData.participants,
    expenseData.splits
  );

  const expense: any = {
    id: docRef.id,
    groupId: expenseData.groupId,
    createdBy: userId,
    paidBy: expenseData.paidBy,
    amount: expenseData.amount,
    description: expenseData.description,
    category: expenseData.category,
    date: Timestamp.fromDate(new Date(expenseData.date)),
    splitType: expenseData.splitType,
    participants: expenseData.participants,
    splits,
    createdAt: Timestamp.fromDate(now),
    updatedAt: Timestamp.fromDate(now),
  };

  // Only add receiptUrl if it's defined
  if (expenseData.receiptUrl !== undefined) {
    expense.receiptUrl = expenseData.receiptUrl;
  }

  try {
    await docRef.set(expense);

    logger.info('Expense created', {
      expenseId: docRef.id,
      groupId: expenseData.groupId,
      amount: expenseData.amount,
      userId
    });

    res.status(HTTP_STATUS.CREATED).json({
      id: docRef.id,
      message: 'Expense created successfully',
    });
  } catch (error) {
    logger.error('Failed to create expense', {
      userId,
      error: error instanceof Error ? error : new Error('Unknown error'),
      expenseData
    });
    throw error;
  }
};

export const getExpense = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const userId = validateUserAuth(req);

  const expenseId = validateExpenseId(req.query.id);

  const { expense } = await fetchExpense(expenseId, userId);

  res.json({
    id: expense.id,
    groupId: expense.groupId,
    createdBy: expense.createdBy,
    paidBy: expense.paidBy,
    amount: expense.amount,
    description: expense.description,
    category: expense.category,
    date: toISOString(expense.date),
    splitType: expense.splitType,
    participants: expense.participants,
    splits: expense.splits,
    receiptUrl: expense.receiptUrl,
    createdAt: toISOString(expense.createdAt),
    updatedAt: toISOString(expense.updatedAt),
  });
};

export const updateExpense = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const userId = validateUserAuth(req);

  const expenseId = validateExpenseId(req.query.id);

  const updateData = validateUpdateExpense(req.body);

  const { docRef, expense } = await fetchExpense(expenseId, userId);

  if (expense.createdBy !== userId) {
    throw new ApiError(HTTP_STATUS.FORBIDDEN, 'NOT_EXPENSE_CREATOR', 'Only the expense creator can edit it');
  }

  const updates: any = {
    ...updateData,
    updatedAt: Timestamp.now(),
  };

  if (updateData.date) {
    updates.date = Timestamp.fromDate(new Date(updateData.date));
  }

  if (updateData.splitType || updateData.participants || updateData.splits) {
    const amount = updateData.amount || expense.amount;
    const splitType = updateData.splitType || expense.splitType;
    const participants = updateData.participants || expense.participants;
    const splits = updateData.splits || expense.splits;

    updates.splits = calculateSplits(amount, splitType, participants, splits);
  }

  await docRef.update(updates);

  logger.info('Expense updated', {
    expenseId,
    userId,
    updates: Object.keys(updateData)
  });

  res.json({
    message: 'Expense updated successfully',
  });
};

export const deleteExpense = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const userId = validateUserAuth(req);

  const expenseId = validateExpenseId(req.query.id);

  const { docRef, expense } = await fetchExpense(expenseId, userId);

  if (expense.createdBy !== userId) {
    throw new ApiError(HTTP_STATUS.FORBIDDEN, 'NOT_EXPENSE_CREATOR', 'Only the expense creator can delete it');
  }

  await docRef.delete();

  logger.info('Expense deleted', {
    expenseId,
    groupId: expense.groupId,
    userId
  });

  res.json({
    message: 'Expense deleted successfully',
  });
};

export const listGroupExpenses = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const userId = validateUserAuth(req);

  const groupId = req.query.groupId as string;
  if (!groupId) {
    throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'MISSING_GROUP_ID', 'Group ID is required');
  }

  await verifyGroupMembership(groupId, userId);

  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
  const cursor = req.query.cursor as string;

  let query = getExpensesCollection()
    .where('groupId', '==', groupId)
    .orderBy('date', 'desc')
    .orderBy('createdAt', 'desc')
    .limit(limit + 1);

  if (cursor) {
    try {
      const decodedCursor = Buffer.from(cursor, 'base64').toString('utf-8');
      const cursorData = JSON.parse(decodedCursor);
      
      if (cursorData.date && cursorData.createdAt) {
        query = query.startAfter(
          new Date(cursorData.date),
          new Date(cursorData.createdAt)
        );
      }
    } catch (error) {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_CURSOR', 'Invalid cursor format');
    }
  }

  const snapshot = await query.get();
  
  const hasMore = snapshot.docs.length > limit;
  const expenses = snapshot.docs
    .slice(0, limit)
    .map(doc => {
      const data = doc.data() as Expense;
      return {
        id: doc.id,
        groupId: data.groupId,
        createdBy: data.createdBy,
        paidBy: data.paidBy,
        amount: data.amount,
        description: data.description,
        category: data.category,
        date: toISOString(data.date),
        splitType: data.splitType,
        participants: data.participants,
        splits: data.splits,
        receiptUrl: data.receiptUrl,
        createdAt: toISOString(data.createdAt),
        updatedAt: toISOString(data.updatedAt),
      };
    });

  let nextCursor: string | undefined;
  if (hasMore && expenses.length > 0) {
    const lastDoc = snapshot.docs[limit - 1];
    const lastDocData = lastDoc.data() as Expense;
    const cursorData = {
      date: toISOString(lastDocData.date),
      createdAt: toISOString(lastDocData.createdAt),
      id: lastDoc.id,
    };
    nextCursor = Buffer.from(JSON.stringify(cursorData)).toString('base64');
  }

  res.json({
    expenses,
    count: expenses.length,
    hasMore,
    nextCursor,
  });
};

export const listUserExpenses = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const userId = validateUserAuth(req);

  // For now, get groups where user is the owner
  const userGroupsSnapshot = await getGroupsCollection()
    .where('userId', '==', userId)
    .get();

  const groupIds = userGroupsSnapshot.docs.map(doc => doc.id);

  if (groupIds.length === 0) {
    res.json({
      expenses: [],
      count: 0,
      hasMore: false,
    });
    return;
  }

  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
  const cursor = req.query.cursor as string;

  // Split groupIds into chunks of 10 to work around Firestore's 'in' query limit
  const FIRESTORE_IN_LIMIT = 10;
  const groupIdChunks: string[][] = [];
  for (let i = 0; i < groupIds.length; i += FIRESTORE_IN_LIMIT) {
    groupIdChunks.push(groupIds.slice(i, i + FIRESTORE_IN_LIMIT));
  }

  // Execute queries for each chunk in parallel
  const queryPromises = groupIdChunks.map(async (chunk) => {
    let query = getExpensesCollection()
      .where('groupId', 'in', chunk)
      .orderBy('date', 'desc')
      .orderBy('createdAt', 'desc')
      .limit(limit + 1);

    if (cursor) {
      try {
        const decodedCursor = Buffer.from(cursor, 'base64').toString('utf-8');
        const cursorData = JSON.parse(decodedCursor);
        
        if (cursorData.date && cursorData.createdAt) {
          query = query.startAfter(
            new Date(cursorData.date),
            new Date(cursorData.createdAt)
          );
        }
      } catch (error) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_CURSOR', 'Invalid cursor format');
      }
    }

    return query.get();
  });

  const snapshots = await Promise.all(queryPromises);
  
  // Merge and sort all documents
  const allDocs = snapshots.flatMap(snapshot => snapshot.docs);
  allDocs.sort((a, b) => {
    const aData = a.data() as Expense;
    const bData = b.data() as Expense;
    
    const dateCompare = (bData.date as any).toMillis() - (aData.date as any).toMillis();
    if (dateCompare !== 0) return dateCompare;
    
    return (bData.createdAt as any).toMillis() - (aData.createdAt as any).toMillis();
  });
  
  const hasMore = allDocs.length > limit;
  const expenses = allDocs
    .slice(0, limit)
    .map(doc => {
      const data = doc.data() as Expense;
      return {
        id: doc.id,
        groupId: data.groupId,
        createdBy: data.createdBy,
        paidBy: data.paidBy,
        amount: data.amount,
        description: data.description,
        category: data.category,
        date: toISOString(data.date),
        splitType: data.splitType,
        participants: data.participants,
        splits: data.splits,
        receiptUrl: data.receiptUrl,
        createdAt: toISOString(data.createdAt),
        updatedAt: toISOString(data.updatedAt),
      };
    });

  let nextCursor: string | undefined;
  if (hasMore && expenses.length > 0) {
    const lastDoc = allDocs[limit - 1];
    const lastDocData = lastDoc.data() as Expense;
    const cursorData = {
      date: toISOString(lastDocData.date),
      createdAt: toISOString(lastDocData.createdAt),
      id: lastDoc.id,
    };
    nextCursor = Buffer.from(JSON.stringify(cursorData)).toString('base64');
  }

  res.json({
    expenses,
    count: expenses.length,
    hasMore,
    nextCursor,
  });
};