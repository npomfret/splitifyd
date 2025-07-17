export interface ExpenseSplit {
  userId: string;
  amount: number;
  percentage?: number;
  userName?: string;
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

export interface Member {
  uid: string;
  name: string;
  initials: string;
  email?: string;
  displayName?: string;
  joinedAt?: string;
}

