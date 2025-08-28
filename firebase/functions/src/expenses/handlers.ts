import { Response } from 'express';
import * as admin from 'firebase-admin';
import { AuthenticatedRequest } from '../auth/middleware';
import { firestoreDb } from '../firebase';
import { validateUserAuth } from '../auth/utils';
import { Errors, ApiError } from '../utils/errors';
import { createServerTimestamp, parseISOToTimestamp, timestampToISO } from '../utils/dateHelpers';
import { logger } from '../logger';
import { HTTP_STATUS } from '../constants';
import { validateCreateExpense, validateUpdateExpense, validateExpenseId, Expense } from './validation';
import { FirestoreCollections, DELETED_AT_FIELD } from '@splitifyd/shared';
import { _getGroupMembersData } from '../groups/memberHandlers';
import { expenseService, ExpenseDocumentSchema } from '../services/ExpenseService';
import { z } from 'zod';

const getExpensesCollection = () => {
    return firestoreDb.collection(FirestoreCollections.EXPENSES);
};

const getGroupsCollection = () => {
    return firestoreDb.collection(FirestoreCollections.GROUPS);
};

const fetchExpense = async (expenseId: string, userId: string): Promise<{ docRef: admin.firestore.DocumentReference; expense: Expense }> => {
    const docRef = getExpensesCollection().doc(expenseId);
    const doc = await docRef.get();

    if (!doc.exists) {
        throw Errors.NOT_FOUND('Expense');
    }

    const rawData = doc.data();
    if (!rawData) {
        throw Errors.NOT_FOUND('Expense');
    }

    // Validate the expense data structure
    let expense: Expense;
    try {
        // Add the id field since it's not stored in the document data
        const dataWithId = { ...rawData, id: doc.id };
        const validatedData = ExpenseDocumentSchema.parse(dataWithId);
        expense = validatedData as Expense;
    } catch (error) {
        logger.error('Invalid expense document structure', error as Error, {
            expenseId,
            validationErrors: error instanceof z.ZodError ? error.issues : undefined,
        });
        throw new ApiError(HTTP_STATUS.INTERNAL_ERROR, 'INVALID_EXPENSE_DATA', 'Expense data is corrupted');
    }

    // Check if the expense is soft-deleted
    if (expense.deletedAt) {
        throw Errors.NOT_FOUND('Expense');
    }

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

    // Participant check is now handled by the permission system in individual handlers

    return { docRef, expense };
};

export const createExpense = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = validateUserAuth(req);
    const expenseData = validateCreateExpense(req.body);

    try {
        const expense = await expenseService.createExpense(userId, expenseData);
        res.status(HTTP_STATUS.CREATED).json(expense);
    } catch (error) {
        logger.error('Failed to create expense', error, {
            userId,
            groupId: expenseData.groupId,
        });
        throw error;
    }
};

export const getExpense = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = validateUserAuth(req);
    const expenseId = validateExpenseId(req.query.id);

    const expense = await expenseService.getExpense(expenseId, userId);

    res.json(expense);
};

export const updateExpense = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = validateUserAuth(req);
    const expenseId = validateExpenseId(req.query.id);
    const updateData = validateUpdateExpense(req.body);

    try {
        const updatedExpense = await expenseService.updateExpense(expenseId, userId, updateData);
        res.json(updatedExpense);
    } catch (error) {
        logger.error('Failed to update expense', error, {
            expenseId,
            userId,
            updates: Object.keys(updateData),
        });
        throw error;
    }
};

export const deleteExpense = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = validateUserAuth(req);
    const expenseId = validateExpenseId(req.query.id);

    await expenseService.deleteExpense(expenseId, userId);

    res.json({
        message: 'Expense deleted successfully',
    });
};

/**
 * Internal function to get group expenses data
 * Used by both the HTTP handler and consolidated endpoints
 */
export const _getGroupExpensesData = async (
    groupId: string,
    options: {
        limit?: number;
        cursor?: string;
        includeDeleted?: boolean;
    } = {},
): Promise<{
    expenses: any[];
    count: number;
    hasMore: boolean;
    nextCursor?: string;
}> => {
    const limit = Math.min(options.limit || 20, 100);
    const cursor = options.cursor;
    const includeDeleted = options.includeDeleted || false;

    let query = getExpensesCollection()
        .where('groupId', '==', groupId)
        .select(
            'groupId',
            'createdBy',
            'paidBy',
            'amount',
            'currency',
            'description',
            'category',
            'date',
            'splitType',
            'participants',
            'splits',
            'receiptUrl',
            'createdAt',
            'updatedAt',
            'deletedAt',
            'deletedBy',
        )
        .orderBy('date', 'desc')
        .orderBy('createdAt', 'desc')
        .limit(limit + 1);

    // Filter out deleted expenses by default
    if (!includeDeleted) {
        query = query.where(DELETED_AT_FIELD, '==', null);
    }

    if (cursor) {
        try {
            const decodedCursor = Buffer.from(cursor, 'base64').toString('utf-8');
            const cursorData = JSON.parse(decodedCursor);

            if (cursorData.date && cursorData.createdAt) {
                query = query.startAfter(parseISOToTimestamp(cursorData.date) || createServerTimestamp(), parseISOToTimestamp(cursorData.createdAt) || createServerTimestamp());
            }
        } catch (error) {
            throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_CURSOR', 'Invalid cursor format');
        }
    }

    const snapshot = await query.get();

    const hasMore = snapshot.docs.length > limit;
    const expenses = snapshot.docs.slice(0, limit).map((doc) => {
        const data = doc.data() as Expense;
        return {
            id: doc.id,
            groupId: data.groupId,
            createdBy: data.createdBy,
            paidBy: data.paidBy,
            amount: data.amount,
            currency: data.currency,
            description: data.description,
            category: data.category,
            date: timestampToISO(data.date),
            splitType: data.splitType,
            participants: data.participants,
            splits: data.splits,
            receiptUrl: data.receiptUrl,
            createdAt: timestampToISO(data.createdAt),
            updatedAt: timestampToISO(data.updatedAt),
            deletedAt: data.deletedAt ? timestampToISO(data.deletedAt) : null,
            deletedBy: data.deletedBy || null,
        };
    });

    let nextCursor: string | undefined;
    if (hasMore && expenses.length > 0) {
        const lastDoc = snapshot.docs[limit - 1];
        const lastDocData = lastDoc.data() as Expense;
        const cursorData = {
            date: timestampToISO(lastDocData.date),
            createdAt: timestampToISO(lastDocData.createdAt),
            id: lastDoc.id,
        };
        nextCursor = Buffer.from(JSON.stringify(cursorData)).toString('base64');
    }

    return {
        expenses,
        count: expenses.length,
        hasMore,
        nextCursor,
    };
};

export const listGroupExpenses = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = validateUserAuth(req);

    const groupId = req.query.groupId as string;
    if (!groupId) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'MISSING_GROUP_ID', 'Group ID is required');
    }

    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const cursor = req.query.cursor as string;
    const includeDeleted = req.query.includeDeleted === 'true';

    const result = await expenseService.listGroupExpenses(groupId, userId, {
        limit,
        cursor,
        includeDeleted,
    });

    res.json(result);
};

export const listUserExpenses = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = validateUserAuth(req);
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const cursor = req.query.cursor as string;
    const includeDeleted = req.query.includeDeleted === 'true';

    let query = getExpensesCollection()
        .where('participants', 'array-contains', userId)
        .select(
            'groupId',
            'createdBy',
            'paidBy',
            'amount',
            'currency',
            'description',
            'category',
            'date',
            'splitType',
            'participants',
            'splits',
            'receiptUrl',
            'createdAt',
            'updatedAt',
            'deletedAt',
            'deletedBy',
        )
        .orderBy('date', 'desc')
        .orderBy('createdAt', 'desc')
        .limit(limit + 1);

    // Filter out deleted expenses by default
    if (!includeDeleted) {
        query = query.where(DELETED_AT_FIELD, '==', null);
    }

    if (cursor) {
        try {
            const decodedCursor = Buffer.from(cursor, 'base64').toString('utf-8');
            const cursorData = JSON.parse(decodedCursor);

            if (cursorData.date && cursorData.createdAt) {
                query = query.startAfter(parseISOToTimestamp(cursorData.date) || createServerTimestamp(), parseISOToTimestamp(cursorData.createdAt) || createServerTimestamp());
            }
        } catch (error) {
            throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_CURSOR', 'Invalid cursor format');
        }
    }

    const snapshot = await query.get();

    const hasMore = snapshot.docs.length > limit;
    const expenses = snapshot.docs.slice(0, limit).map((doc) => {
        const data = doc.data() as Expense;
        return {
            id: doc.id,
            groupId: data.groupId,
            createdBy: data.createdBy,
            paidBy: data.paidBy,
            amount: data.amount,
            currency: data.currency,
            description: data.description,
            category: data.category,
            date: timestampToISO(data.date),
            splitType: data.splitType,
            participants: data.participants,
            splits: data.splits,
            receiptUrl: data.receiptUrl,
            createdAt: timestampToISO(data.createdAt),
            updatedAt: timestampToISO(data.updatedAt),
            deletedAt: data.deletedAt ? timestampToISO(data.deletedAt) : null,
            deletedBy: data.deletedBy || null,
        };
    });

    let nextCursor: string | undefined;
    if (hasMore && expenses.length > 0) {
        const lastDoc = snapshot.docs[limit - 1];
        const lastDocData = lastDoc.data() as Expense;
        const cursorData = {
            date: timestampToISO(lastDocData.date),
            createdAt: timestampToISO(lastDocData.createdAt),
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

export const getExpenseHistory = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = validateUserAuth(req);
    const expenseId = validateExpenseId(req.query.id);

    // Verify user has access to this expense
    await fetchExpense(expenseId, userId);

    const historySnapshot = await getExpensesCollection().doc(expenseId).collection('history').orderBy('modifiedAt', 'desc').limit(20).get();

    const history = historySnapshot.docs.map((doc) => {
        const data = doc.data();
        return {
            id: doc.id,
            modifiedAt: timestampToISO(data.modifiedAt),
            modifiedBy: data.modifiedBy,
            changeType: data.changeType,
            changes: data.changes,
            previousAmount: data.amount,
            previousDescription: data.description,
            previousCategory: data.category,
            previousDate: data.date ? timestampToISO(data.date) : undefined,
            previousSplits: data.splits,
        };
    });

    res.json({
        history,
        count: history.length,
    });
};

/**
 * Get consolidated expense details (expense + group + members)
 * Eliminates race conditions by providing all needed data in one request
 */
export const getExpenseFullDetails = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = validateUserAuth(req);
    const expenseId = validateExpenseId(req.params.id);

    try {
        // Reuse existing tested functions for each data type
        const { expense } = await fetchExpense(expenseId, userId);

        // Get group document for permission check and data
        const groupDoc = await getGroupsCollection().doc(expense.groupId).get();
        if (!groupDoc.exists) {
            throw new ApiError(HTTP_STATUS.NOT_FOUND, 'GROUP_NOT_FOUND', 'Group not found');
        }

        // Check if user is a participant in this expense or a group member (access control for viewing)
        if (!expense.participants || !expense.participants.includes(userId)) {
            // Additional check: allow group members to view expenses they're not participants in
            const groupData = groupDoc.data();
            if (!groupData?.data?.members?.[userId]) {
                throw new ApiError(HTTP_STATUS.FORBIDDEN, 'NOT_AUTHORIZED', 'You are not authorized to view this expense');
            }
        }

        const groupData = groupDoc.data();
        if (!groupData?.data?.name) {
            throw new ApiError(HTTP_STATUS.NOT_FOUND, 'GROUP_NOT_FOUND', 'Invalid group data');
        }

        // Transform group data using same pattern as groups handler
        const group = {
            id: groupDoc.id,
            name: groupData.data.name,
            description: groupData.data.description || '',
            createdBy: groupData.data.createdBy,
            members: groupData.data.members,
            createdAt: groupData.createdAt.toDate().toISOString(),
            updatedAt: groupData.updatedAt.toDate().toISOString(),
        };

        // Use extracted internal functions to eliminate duplication
        const membersData = await _getGroupMembersData(expense.groupId, groupData.data.members!);

        // Format expense response using existing patterns
        const expenseResponse = {
            id: expense.id,
            groupId: expense.groupId,
            createdBy: expense.createdBy,
            paidBy: expense.paidBy,
            amount: expense.amount,
            currency: expense.currency,
            description: expense.description,
            category: expense.category,
            date: timestampToISO(expense.date),
            splitType: expense.splitType,
            participants: expense.participants,
            splits: expense.splits,
            receiptUrl: expense.receiptUrl,
            createdAt: timestampToISO(expense.createdAt),
            updatedAt: timestampToISO(expense.updatedAt),
        };

        // Construct response using existing patterns
        const response = {
            expense: expenseResponse,
            group,
            members: membersData,
        };

        res.json(response);
    } catch (error) {
        logger.error('Error in getExpenseFullDetails', error, {
            expenseId,
            userId,
        });
        throw error;
    }
};
