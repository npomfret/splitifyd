// Internal Firebase Function types - not shared with webapp
// These type definitions are used only by the Firebase Functions backend

export interface BalanceSummary {
  userId: string;
  userName: string;
  balance: number;
}

// Expense Categories
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