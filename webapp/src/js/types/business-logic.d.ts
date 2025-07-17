// Business Logic Type Definitions
import { ExpenseData, ExpenseSplit, CreateExpenseRequest, UpdateExpenseRequest } from './expense-types';
import { GroupBalance, TransformedGroup, Member } from './group-types';
import { User } from './global';

export type { ExpenseData, ExpenseSplit, CreateExpenseRequest, UpdateExpenseRequest } from './expense-types';
export type { GroupBalance, TransformedGroup, Member as GroupMember } from './group-types';
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

export interface CreateGroupRequest {
  name: string;
  description?: string;
  memberEmails?: string[];
}

export interface UpdateGroupRequest {
  name?: string;
  description?: string;
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

// Form Component Types
export interface FormFieldConfig {
  label: string;
  id?: string;
  type?: 'text' | 'email' | 'number' | 'select' | 'textarea' | 'checkbox';
  value?: string | number | boolean;
  required?: boolean;
  placeholder?: string;
  options?: Array<string | { value: string; label: string }>;
  step?: number | string;
  readonly?: boolean;
  errorId?: string;
}

export interface FormActionButton {
  text: string;
  id?: string;
  disabled?: boolean;
  type?: 'submit' | 'button';
  className?: string;
}

// List Component Types
export interface EmptyStateConfig {
  icon?: string;
  title: string;
  message?: string;
  actionButton?: string;
}

export interface PaginationConfig {
  currentPage: number;
  totalPages: number;
  onPageChange?: (page: number) => void;
}

// Event Handler Types
export type ClickHandler = (event: MouseEvent) => void;

// Utility Types
export type CurrencyFormatter = (amount: number) => string;
export type DateFormatter = (date: string | Date) => string;
