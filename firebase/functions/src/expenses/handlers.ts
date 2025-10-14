import { getAppBuilder } from '../ApplicationBuilderSingleton';
import { ExpenseHandlers } from './ExpenseHandlers';

const expenseHandlers = ExpenseHandlers.createExpenseHandlers(getAppBuilder());

export const createExpense = expenseHandlers.createExpense;
export const updateExpense = expenseHandlers.updateExpense;
export const deleteExpense = expenseHandlers.deleteExpense;
export const getExpenseFullDetails = expenseHandlers.getExpenseFullDetails;
