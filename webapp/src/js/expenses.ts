import { apiCall } from './api.js';
import type {
  ExpenseData,
  CreateExpenseRequest,
  UpdateExpenseRequest,
  ExpenseListResponse,
  ExpenseCategory,
  ExpenseSplit,
  CurrencyFormatter
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

  static async listGroupExpenses(groupId: string, limit: number = 50, cursor: string | null = null): Promise<ExpenseListResponse> {
    const params = new URLSearchParams({
      groupId,
      limit: limit.toString()
    });
    
    if (cursor) {
      params.append('cursor', cursor);
    }

    return apiCall<ExpenseListResponse>(`/expenses/group?${params.toString()}`);
  }

  static async listUserExpenses(limit: number = 50, cursor: string | null = null): Promise<ExpenseListResponse> {
    const params = new URLSearchParams({
      limit: limit.toString()
    });
    
    if (cursor) {
      params.append('cursor', cursor);
    }

    return apiCall<ExpenseListResponse>(`/expenses/user?${params.toString()}`);
  }


  static getExpenseCategories(): ExpenseCategory[] {
    return [
      { value: 'food', label: 'Food & Dining', icon: '🍽️' },
      { value: 'transport', label: 'Transportation', icon: '🚗' },
      { value: 'utilities', label: 'Utilities', icon: '💡' },
      { value: 'entertainment', label: 'Entertainment', icon: '🎮' },
      { value: 'shopping', label: 'Shopping', icon: '🛍️' },
      { value: 'accommodation', label: 'Accommodation', icon: '🏠' },
      { value: 'healthcare', label: 'Healthcare', icon: '🏥' },
      { value: 'education', label: 'Education', icon: '📚' },
      { value: 'other', label: 'Other', icon: '📌' }
    ];
  }

}