import { Response } from 'express';
import { AuthenticatedRequest } from '../auth/middleware';
import {getFirestore} from '../firebase';
import { validateUserAuth } from '../auth/utils';
import { ApiError, Errors } from '../utils/errors';
import { createServerTimestamp, parseISOToTimestamp, timestampToISO } from '../utils/dateHelpers';
import { logger } from '../logger';
import { HTTP_STATUS } from '../constants';
import { validateCreateExpense, validateUpdateExpense, validateExpenseId } from './validation';
import { FirestoreCollections } from '@splitifyd/shared';
import { getExpenseService } from '../services/serviceRegistration';

const getExpensesCollection = () => {
    return getFirestore().collection(FirestoreCollections.EXPENSES);
};



export const createExpense = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = validateUserAuth(req);
    const expenseData = validateCreateExpense(req.body);

    try {
        const expense = await getExpenseService().createExpense(userId, expenseData);
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

    const expense = await getExpenseService().getExpense(expenseId, userId);

    res.json(expense);
};

export const updateExpense = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = validateUserAuth(req);
    const expenseId = validateExpenseId(req.query.id);
    const updateData = validateUpdateExpense(req.body);

    try {
        const updatedExpense = await getExpenseService().updateExpense(expenseId, userId, updateData);
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

    await getExpenseService().deleteExpense(expenseId, userId);

    res.json({
        message: 'Expense deleted successfully',
    });
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

    const result = await getExpenseService().listGroupExpenses(groupId, userId, {
        limit,
        cursor,
        includeDeleted,
    });

    res.json(result);
};

export const listUserExpenses = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = validateUserAuth(req);
    
    // Validate and sanitize limit parameter
    const limitParam = req.query.limit as string;
    let limit = 50; // default
    if (limitParam !== undefined) {
        const parsedLimit = parseInt(limitParam);
        if (isNaN(parsedLimit)) {
            throw Errors.INVALID_INPUT('limit parameter must be a valid number');
        }
        if (parsedLimit < 1) {
            throw Errors.INVALID_INPUT('limit parameter must be greater than 0');
        }
        if (parsedLimit > 100) {
            throw Errors.INVALID_INPUT('limit parameter must not exceed 100');
        }
        limit = parsedLimit;
    }
    
    // Validate other parameters
    const cursor = req.query.cursor as string;
    const includeDeletedParam = req.query.includeDeleted as string;
    const includeDeleted = includeDeletedParam === 'true';
    
    // Validate includeDeleted parameter if provided
    if (includeDeletedParam !== undefined && includeDeletedParam !== 'true' && includeDeletedParam !== 'false') {
        throw Errors.INVALID_INPUT('includeDeleted parameter must be "true" or "false"');
    }
    
    // Check for unsupported parameters
    const supportedParams = ['limit', 'cursor', 'includeDeleted'];
    const providedParams = Object.keys(req.query);
    const unsupportedParams = providedParams.filter(param => !supportedParams.includes(param));
    if (unsupportedParams.length > 0) {
        throw Errors.INVALID_INPUT(`Unsupported parameters: ${unsupportedParams.join(', ')}. Supported parameters are: ${supportedParams.join(', ')}`);
    }

    const result = await getExpenseService().listUserExpenses(userId, {
        limit,
        cursor,
        includeDeleted,
    });

    res.json(result);
};

export const getExpenseHistory = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = validateUserAuth(req);
    const expenseId = validateExpenseId(req.query.id);

    const result = await getExpenseService().getExpenseHistory(expenseId, userId);

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
        const result = await getExpenseService().getExpenseFullDetails(expenseId, userId);
        res.json(result);
    } catch (error) {
        logger.error('Error in getExpenseFullDetails', error, {
            expenseId,
            userId,
        });
        throw error;
    }
};
