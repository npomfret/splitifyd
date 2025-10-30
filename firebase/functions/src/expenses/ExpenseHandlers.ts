import { MessageResponse } from '@splitifyd/shared';
import { Response } from 'express';
import { AuthenticatedRequest } from '../auth/middleware';
import { validateUserAuth } from '../auth/utils';
import { HTTP_STATUS } from '../constants';
import { logger } from '../logger';
import { ExpenseService } from '../services/ExpenseService';
import { validateCreateExpense, validateExpenseId, validateUpdateExpense } from './validation';

export class ExpenseHandlers {
    constructor(private readonly expenseService: ExpenseService) {
    }

    createExpense = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const userId = validateUserAuth(req);
        const expenseData = validateCreateExpense(req.body);

        try {
            const expense = await this.expenseService.createExpense(userId, expenseData);
            res.status(HTTP_STATUS.CREATED).json(expense);
        } catch (error) {
            logger.error('Failed to create expense', error, {
                userId,
                groupId: expenseData.groupId,
            });
            throw error;
        }
    };

    updateExpense = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const userId = validateUserAuth(req);
        const expenseId = validateExpenseId(req.query.id);
        const updateData = validateUpdateExpense(req.body);

        try {
            const updatedExpense = await this.expenseService.updateExpense(expenseId, userId, updateData);
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

    deleteExpense = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const userId = validateUserAuth(req);
        const expenseId = validateExpenseId(req.query.id);

        await this.expenseService.deleteExpense(expenseId, userId);

        const response: MessageResponse = {
            message: 'Expense deleted successfully',
        };
        res.json(response);
    };

    /**
     * Get consolidated expense details (expense + group + members)
     * Eliminates race conditions by providing all needed data in one request
     */
    getExpenseFullDetails = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const userId = validateUserAuth(req);
        const expenseId = validateExpenseId(req.params.id);

        try {
            const result = await this.expenseService.getExpenseFullDetails(expenseId, userId);
            res.json(result);
        } catch (error) {
            logger.error('Error in getExpenseFullDetails', error, {
                expenseId,
                userId,
            });
            throw error;
        }
    };
}
