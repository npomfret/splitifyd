import { Response } from 'express';
import { AuthenticatedRequest } from '../auth/middleware';
import { firestoreDb } from '../firebase';
import { validateUserAuth } from '../auth/utils';
import { ApiError } from '../utils/errors';
import { createServerTimestamp, parseISOToTimestamp, timestampToISO } from '../utils/dateHelpers';
import { logger } from '../logger';
import { HTTP_STATUS } from '../constants';
import { validateCreateExpense, validateUpdateExpense, validateExpenseId, Expense } from './validation';
import { FirestoreCollections, DELETED_AT_FIELD } from '@splitifyd/shared';
import { expenseService } from '../services/ExpenseService';

const getExpensesCollection = () => {
    return firestoreDb.collection(FirestoreCollections.EXPENSES);
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

    const result = await expenseService.listUserExpenses(userId, {
        limit,
        cursor,
        includeDeleted,
    });

    res.json(result);
};

export const getExpenseHistory = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = validateUserAuth(req);
    const expenseId = validateExpenseId(req.query.id);

    const result = await expenseService.getExpenseHistory(expenseId, userId);

    res.json(result);
};

/**
 * Get consolidated expense details (expense + group + members)
 * Eliminates race conditions by providing all needed data in one request
 */
export const getExpenseFullDetails = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = validateUserAuth(req);
    const expenseId = validateExpenseId(req.params.id);

    try {
        const result = await expenseService.getExpenseFullDetails(expenseId, userId);
        res.json(result);
    } catch (error) {
        logger.error('Error in getExpenseFullDetails', error, {
            expenseId,
            userId,
        });
        throw error;
    }
};
