// Business Logic Type Definitions
import { ExpenseData } from './webapp-shared-types';
import { User } from './global';

export type { ExpenseData, ExpenseSplit, CreateExpenseRequest, UpdateExpenseRequest, TransformedGroup } from './webapp-shared-types';
export type { User } from './global';

// Additional types needed by business logic
export interface Group {
  id: string;
  name: string;
  description?: string;
  createdBy: string;
  createdAt: string;
  updatedAt?: string;
  members: string[];
  memberCount: number;
}

export interface ExpenseListResponse {
  expenses: ExpenseData[];
  cursor?: string;
  hasMore: boolean;
}

// Expense Management Types
export interface ExpenseCategory {
  value: string;
  label: string;
  icon: string;
}




// Event Handler Types
export type ClickHandler = (event: MouseEvent) => void;

// Utility Types
export type CurrencyFormatter = (amount: number) => string;
