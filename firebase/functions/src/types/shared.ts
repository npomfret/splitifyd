// This file is auto-synchronized with the shared-types package
// DO NOT EDIT DIRECTLY - Edit shared-types package instead
// Last sync: 2024-07-12

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

export type ExpenseCategoryType = typeof EXPENSE_CATEGORIES[number];

export interface Member {
  uid: string;
  name: string;
  initials: string;
  email?: string;
  displayName?: string;
  joinedAt?: string;
}

export interface GroupDetail {
  id: string;
  name: string;
  description?: string;
  members: Member[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// Group-related types removed from Firebase functions shared.ts
// These are only needed by the webapp and are available through the shared-types package
// Firebase functions use their own local models and don't need to import these

// API request/response types are defined locally where used in Firebase functions
// The shared types above are primarily consumed by the webapp through API responses