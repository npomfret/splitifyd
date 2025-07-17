// Business Logic Type Definitions

// Expense Management Types
export interface ExpenseCategory {
  value: string;
  label: string;
  icon: string;
}

export interface ExpenseSplit {
  userId: string;
  amount: number;
  percentage?: number;
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
  splits: ExpenseSplit[];
  category?: string;
  date?: string;
}

export interface UpdateExpenseRequest {
  description?: string;
  amount?: number;
  paidBy?: string;
  splits?: ExpenseSplit[];
  category?: string;
  date?: string;
}

export interface ExpenseListResponse {
  expenses: ExpenseData[];
  cursor?: string;
  hasMore: boolean;
}

// Group Management Types
export interface GroupMember {
  id: string;
  email: string;
  displayName?: string;
  joinedAt: string;
}

export interface GroupBalance {
  userId: string;
  userName: string;
  amount: number; // positive = owed to user, negative = user owes
}

export interface Group {
  id: string;
  name: string;
  description?: string;
  createdBy: string;
  createdAt: string;
  updatedAt?: string;
  members: string[]; // User IDs
  memberCount: number;
}

export interface GroupDetail extends Group {
  memberDetails: GroupMember[];
  userBalance: number;
  balances: GroupBalance[];
  expenseCount: number;
  totalExpenses: number;
  lastActivity?: string;
}

export interface TransformedGroup extends Group {
  members: Array<{
    id: string;
    name: string;
    email?: string;
    initials: string;
  }>;
  yourBalance: number;
  lastExpense?: {
    description: string;
    amount: number;
  };
  lastActivity: string;
  lastActivityRaw?: string;
  expenseCount?: number;
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
export interface GroupCardConfig {
  group: TransformedGroup;
}

export interface ExpenseItemConfig {
  expense: ExpenseData;
  currentUserId: string;
}

export interface MemberItemConfig {
  member: GroupMember | { displayName?: string; email?: string };
  balance?: number | null;
}

export interface BalanceItemConfig {
  balance: GroupBalance;
}

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

// Navigation Header Types
export interface NavHeaderConfig {
  title: string;
  backUrl?: string | null;
  actions?: string | null;
}

// State Management Types
export interface ExpensePageState {
  expenses: ExpenseData[];
  loading: boolean;
  error?: string;
  currentPage: number;
  totalPages: number;
  cursor?: string;
  hasMore: boolean;
}

export interface GroupPageState {
  groups: TransformedGroup[];
  currentGroup?: GroupDetail;
  balances?: GroupBalance[];
  loading: boolean;
  error?: string;
}

export interface DashboardState {
  user: User | null;
  currentView: 'groups' | 'group-detail' | 'expenses' | 'add-expense';
  groupId?: string;
  expenseId?: string;
}

// Service Response Types
export interface ServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// Event Handler Types
export type ClickHandler = (event: MouseEvent) => void;
export type SubmitHandler = (event: SubmitEvent) => void;
export type ChangeHandler = (event: Event) => void;

// Utility Types
export type CurrencyFormatter = (amount: number) => string;
export type DateFormatter = (date: string | Date) => string;

// Re-export types that are used from other files
export type { User } from './global';