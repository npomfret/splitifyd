// Component type definitions for Phase 3 TypeScript migration

// Base component interface
export interface Component {
  render(): string | HTMLElement;
  destroy?(): void;
}

// Modal types
export interface ModalConfig {
  id: string;
  title: string;
  content: string;
  confirmText?: string;
  cancelText?: string;
  showCancelButton?: boolean;
  onConfirm?: () => void | Promise<void>;
  onCancel?: () => void;
}

export interface ModalConfirmConfig {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void | Promise<void>;
  onCancel?: () => void;
}

// Navigation types
export interface NavigationAction {
  id?: string;
  text: string;
  icon?: string;
  class?: string;
  onclick?: () => void;
  href?: string;
}

export interface NavigationConfig {
  title: string;
  backUrl?: string;
  actions?: NavigationAction[];
}

// Header types
export interface HeaderConfig {
  title: string;
  showLogout?: boolean;
  totalOwed?: number;
  totalOwe?: number;
  showBalances?: boolean;
}

// Auth card types
export interface AuthCardConfig {
  title: string;
  subtitle?: string;
  content: string;
  footer?: string;
}

// Form component types (for future migration)
export interface FormFieldConfig {
  label: string;
  id?: string;
  type?: 'text' | 'email' | 'number' | 'select' | 'textarea' | 'checkbox' | 'password';
  value?: string | number | boolean;
  required?: boolean;
  placeholder?: string;
  options?: Array<string | { value: string; label: string }>;
  step?: number | string;
  readonly?: boolean;
  errorId?: string;
  autocomplete?: string;
  maxLength?: number;
  minLength?: number;
  min?: number;
  max?: number;
  rows?: number;
  error?: string;
}

// List component types (for future migration)
export interface GroupCardData {
  id: string;
  name: string;
  memberCount: number;
  yourBalance: number;
  lastActivity: string;
}

export interface ExpenseItemData {
  id: string;
  description: string;
  amount: number;
  paidByName: string;
  paidByInitials: string;
  date: string;
  yourShare?: number;
  groupId?: string;
}

export interface MemberData {
  uid: string;
  name: string;
  initials: string;
  isCurrentUser?: boolean;
}

export interface BalanceData {
  userId: string;
  userName: string;
  balance: number;
}

export interface PaginationConfig {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}