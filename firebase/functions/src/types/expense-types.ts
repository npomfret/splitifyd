export interface ExpenseSplit {
  userId: string;
  amount: number;
  percentage?: number;
  userName?: string;
}

export interface ExpenseData {
  id: string;
  groupId: string;
  description: string;
  amount: number;
  paidBy: string;
  paidByName?: string;
  splits: ExpenseSplit[];
  createdAt: string;
  createdBy: string;
  category: string;
  date: string;
  updatedAt?: string;
  splitType: 'equal' | 'exact' | 'percentage';
  participants: string[];
  receiptUrl?: string;
}

export interface CreateExpenseRequest {
  groupId: string;
  description: string;
  amount: number;
  paidBy: string;
  category: string;
  date: string;
  splitType: 'equal' | 'exact' | 'percentage';
  participants: string[];
  splits?: ExpenseSplit[];
  receiptUrl?: string;
}

export interface UpdateExpenseRequest {
  description?: string;
  amount?: number;
  paidBy?: string;
  category?: string;
  date?: string;
  splitType?: 'equal' | 'exact' | 'percentage';
  participants?: string[];
  splits?: ExpenseSplit[];
  receiptUrl?: string;
}

export const EXPENSE_CATEGORIES = [
  'food',
  'transport',
  'utilities',
  'entertainment',
  'shopping',
  'accommodation',
  'healthcare',
  'education',
  'other'
] as const;


