import { apiCall } from './api.js';
import type {
  ExpenseData,
  CreateExpenseRequest,
  UpdateExpenseRequest,
  ExpenseListResponse,
  ExpenseCategory,
  ExpenseSplit,
  CurrencyFormatter,
  DateFormatter
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

  static calculateEqualSplit(amount: number, participantCount: number): number {
    const splitAmount = amount / participantCount;
    return Math.round(splitAmount * 100) / 100;
  }

  static validateSplitAmounts(amount: number, splits: ExpenseSplit[]): boolean {
    const total = splits.reduce((sum, split) => sum + split.amount, 0);
    return Math.abs(total - amount) < 0.01;
  }

  static validateSplitPercentages(splits: ExpenseSplit[]): boolean {
    const total = splits.reduce((sum, split) => sum + (split.percentage || 0), 0);
    return Math.abs(total - 100) < 0.01;
  }

  static formatAmount: CurrencyFormatter = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  }

  static formatDate: DateFormatter = (date: string | Date): string => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
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

  static getCategoryIcon(category: string): string {
    const categories = this.getExpenseCategories();
    const cat = categories.find(c => c.value === category);
    return cat ? cat.icon : '📌';
  }

  static getCategoryLabel(category: string): string {
    const categories = this.getExpenseCategories();
    const cat = categories.find(c => c.value === category);
    return cat ? cat.label : 'Other';
  }
}