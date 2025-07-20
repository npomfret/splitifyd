// Page-specific type definitions for TypeScript migration Phase 5

import type { GroupDetail, Member, ExpenseData, GroupBalances } from './api';

// Group detail types
interface GroupDetailState {
  group: GroupDetail | null;
  expenses: ExpenseData[];
  balances: GroupBalances | null;
  members: Member[];
  currentTab: 'balances' | 'expenses' | 'activity';
  currentPage: number;
  totalPages: number;
  isLoading: boolean;
}

// Export all page types
export {
  GroupDetailState
};