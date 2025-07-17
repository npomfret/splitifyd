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
import { GroupData, GroupMember } from '../documents/validation';

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
  
  // Check if user is the group owner (creator)
  if (groupData.userId === userId) {
    return;
  }
  
  // Check if user is a member of the group
  const groupDataTyped = groupData.data as GroupData;
  if (groupDataTyped.members && Array.isArray(groupDataTyped.members)) {
    const isMember = groupDataTyped.members.some((member: GroupMember) => member.uid === userId);
    if (isMember) {
      return;
    }
  }
  
  throw new ApiError(HTTP_STATUS.FORBIDDEN, 'NOT_GROUP_MEMBER', 'You are not a member of this group');
};

const fetchExpense = async (expenseId: string, userId: string): Promise<{ docRef: admin.firestore.DocumentReference, expense: Expense }> => {
  const docRef = getExpensesCollection().doc(expenseId);
  const doc = await docRef.get();

  if (!doc.exists) {
    throw Errors.NOT_FOUND('Expense');
  }

  const expense = doc.data() as Expense;

  // Single authorization check: fetch group once and verify access
  const groupDoc = await getGroupsCollection().doc(expense.groupId).get();
  
  if (!groupDoc.exists) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, 'GROUP_NOT_FOUND', 'Group not found');
  }

  const groupData = groupDoc.data();
  
  // Check if this is a group document (has data.name)
  if (!groupData || !groupData.data || !groupData.data.name) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, 'GROUP_NOT_FOUND', 'Group not found');
  }
  
  // Check if user is group owner (creator)
  if (groupData.userId === userId) {
    return { docRef, expense };
  }
  
  // Check if user is a participant in this expense
  if (!expense.participants || !expense.participants.includes(userId)) {
    throw new ApiError(HTTP_STATUS.FORBIDDEN, 'NOT_EXPENSE_PARTICIPANT', 'You are not a participant in this expense');
  }

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

  const groupDoc = await getGroupsCollection().doc(expenseData.groupId).get();
  const groupData = groupDoc.data();
  if (!groupData?.data?.memberIds) {
    throw new Error(`Group ${expenseData.groupId} not found or missing member data`);
  }
  const memberIds = groupData.data.memberIds;

  const now = new Date();
  const docRef = getExpensesCollection().doc();
  
  const splits = calculateSplits(
    expenseData.amount,
    expenseData.splitType,
    expenseData.participants,
    expenseData.splits
  );

  const expense: Expense = {
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
    memberIds,
    createdAt: Timestamp.fromDate(now),
    updatedAt: Timestamp.fromDate(now),
  };

  // Only add receiptUrl if it's defined
  if (expenseData.receiptUrl !== undefined) {
    expense.receiptUrl = expenseData.receiptUrl;
  }

  try {
    // Use transaction to create expense and update group metadata atomically
    await admin.firestore().runTransaction(async (transaction) => {
      const groupDocRef = getGroupsCollection().doc(expenseData.groupId);
      const groupDoc = await transaction.get(groupDocRef);
      
      if (!groupDoc.exists) {
        throw new Error(`Group ${expenseData.groupId} not found`);
      }
      
      const groupData = groupDoc.data();
      const currentExpenseCount = groupData?.data?.expenseCount || 0;
      const lastExpenseTime = now.toISOString();
      
      // Create the expense
      transaction.set(docRef, expense);
      
      // Update group metadata
      transaction.update(groupDocRef, {
        'data.expenseCount': currentExpenseCount + 1,
        'data.lastExpenseTime': lastExpenseTime
      });
      
      logger.info('Transaction: Creating expense and updating group metadata', {
        expenseId: docRef.id,
        groupId: expenseData.groupId,
        newExpenseCount: currentExpenseCount + 1,
        lastExpenseTime
      });
    });

    logger.info('Expense created with metadata update', {
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

  // Type note: This is intentionally `any` because we're building a dynamic update object
  // that gets transformed before being passed to Firestore
  const updates: any = {
    ...updateData,
    updatedAt: Timestamp.now(),
  };

  if (updateData.date) {
    updates.date = Timestamp.fromDate(new Date(updateData.date));
  }

  if (updateData.splitType || updateData.participants || updateData.splits || updateData.amount) {
    const amount = updateData.amount || expense.amount;
    const splitType = updateData.splitType || expense.splitType;
    const participants = updateData.participants || expense.participants;
    
    // If only amount is updated and splitType is 'exact', we need to recalculate as equal splits
    // since the old exact splits won't match the new amount
    let finalSplitType = splitType;
    let splits = updateData.splits || expense.splits;
    
    if (updateData.amount && !updateData.splitType && !updateData.participants && !updateData.splits) {
      if (splitType === 'exact') {
        // When only amount changes on exact splits, convert to equal splits
        finalSplitType = 'equal';
        splits = [];
      }
    }

    updates.splits = calculateSplits(amount, finalSplitType, participants, splits);
  }

  try {
    // If date is being updated, we need to update group metadata too
    if (updateData.date) {
      await admin.firestore().runTransaction(async (transaction) => {
        const groupDocRef = getGroupsCollection().doc(expense.groupId);
        const groupDoc = await transaction.get(groupDocRef);
        
        if (!groupDoc.exists) {
          throw new Error(`Group ${expense.groupId} not found`);
        }
        
        // Update the expense
        transaction.update(docRef, updates);
        
        // Update group's lastExpenseTime if this becomes the latest expense
        const newDate = new Date(updateData.date!);
        const lastExpenseTime = newDate.toISOString();
        
        transaction.update(groupDocRef, {
          'data.lastExpenseTime': lastExpenseTime
        });
        
        logger.info('Transaction: Updating expense and group lastExpenseTime', {
          expenseId,
          groupId: expense.groupId,
          newDate: lastExpenseTime
        });
      });
    } else {
      // No date change, just update the expense
      await docRef.update(updates);
    }

    logger.info('Expense updated', {
      expenseId,
      userId,
      updates: Object.keys(updateData)
    });

    res.json({
      message: 'Expense updated successfully',
    });
  } catch (error) {
    logger.error('Failed to update expense', {
      expenseId,
      userId,
      error: error instanceof Error ? error : new Error('Unknown error'),
      updates: Object.keys(updateData)
    });
    throw error;
  }
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

  try {
    // Use transaction to delete expense and update group metadata atomically
    await admin.firestore().runTransaction(async (transaction) => {
      const groupDocRef = getGroupsCollection().doc(expense.groupId);
      const groupDoc = await transaction.get(groupDocRef);
      
      if (!groupDoc.exists) {
        throw new Error(`Group ${expense.groupId} not found`);
      }
      
      // Delete the expense
      transaction.delete(docRef);
      
      // Simply decrement the expense count (triggers will recalculate correct values)
      const groupData = groupDoc.data();
      const currentExpenseCount = groupData?.data?.expenseCount || 1;
      const newCount = Math.max(0, currentExpenseCount - 1);
      
      transaction.update(groupDocRef, {
        'data.expenseCount': newCount
      });
      
      logger.info('Transaction: Deleting expense and updating group metadata', {
        expenseId,
        groupId: expense.groupId,
        newExpenseCount: newCount
      });
    });

    logger.info('Expense deleted with metadata update', {
      expenseId,
      groupId: expense.groupId,
      userId
    });

    res.json({
      message: 'Expense deleted successfully',
    });
  } catch (error) {
    logger.error('Failed to delete expense', {
      expenseId,
      userId,
      error: error instanceof Error ? error : new Error('Unknown error')
    });
    throw error;
  }
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
    .select('groupId', 'createdBy', 'paidBy', 'amount', 'description', 'category', 'date', 'splitType', 'participants', 'splits', 'receiptUrl', 'createdAt', 'updatedAt', 'memberIds', 'deletedAt')
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
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
  const cursor = req.query.cursor as string;

  let query = getExpensesCollection()
    .where('memberIds', 'array-contains', userId)
    .select('groupId', 'createdBy', 'paidBy', 'amount', 'description', 'category', 'date', 'splitType', 'participants', 'splits', 'receiptUrl', 'createdAt', 'updatedAt', 'memberIds', 'deletedAt')
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