import { apiCall } from './api.js';
import type {
  ExpenseData,
  CreateExpenseRequest,
  UpdateExpenseRequest,
  ExpenseListResponse
} from './types/business-logic.js';

export class ExpenseService {
  static async createExpense(expenseData: CreateExpenseRequest): Promise<ExpenseData> {
    return apiCall<ExpenseData>('/expenses', {
      method: 'POST',
      body: JSON.stringify(expenseData)
    });
  }

  static async getExpense(expenseId: string): Promise<ExpenseData> {
    return apiCall<ExpenseData>(`/expenses?id=${expenseId}`);
  }

  static async updateExpense(expenseId: string, updateData: UpdateExpenseRequest): Promise<ExpenseData> {
    return apiCall<ExpenseData>(`/expenses?id=${expenseId}`, {
      method: 'PUT',
      body: JSON.stringify(updateData)
    });
  }

  static async deleteExpense(expenseId: string): Promise<{ success: boolean }> {
    return apiCall<{ success: boolean }>(`/expenses?id=${expenseId}`, {
      method: 'DELETE'
    });
  }

}