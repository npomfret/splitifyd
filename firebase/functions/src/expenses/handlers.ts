import { Response } from 'express';
import { AuthenticatedRequest } from '../auth/middleware';
import { validateUserAuth } from '../auth/utils';
import { logger } from '../logger';
import { HTTP_STATUS } from '../constants';
import { validateCreateExpense, validateUpdateExpense, validateExpenseId } from './validation';
import { getFirestore } from '../firebase';
import { ApplicationBuilder } from '../services/ApplicationBuilder';

const firestore = getFirestore();
const applicationBuilder = new ApplicationBuilder(firestore);
const expenseService = applicationBuilder.buildExpenseService();

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

export const getExpenseHistory = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    validateUserAuth(req);
    const expenseId = validateExpenseId(req.query.id);

    const result = await expenseService.getExpenseHistory(expenseId);

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
