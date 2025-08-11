import {signal} from '@preact/signals';
import type {ExpenseData, Group, GroupBalances, User} from '../../../../firebase/functions/src/shared/shared-types';
import {apiClient} from '../apiClient';

export interface GroupDetailStore {
  group: Group | null;
  members: User[];
  expenses: ExpenseData[];
  balances: GroupBalances | null;
  loading: boolean;
  loadingMembers: boolean;
  loadingExpenses: boolean;
  loadingBalances: boolean;
  error: string | null;
  hasMoreExpenses: boolean;
  expenseCursor: string | null;
  
  fetchGroup(id: string): Promise<void>;
  fetchMembers(): Promise<void>;
  fetchExpenses(cursor?: string, includeDeleted?: boolean): Promise<void>;
  fetchBalances(): Promise<void>;
  loadMoreExpenses(): Promise<void>;
  refetchExpenses(includeDeleted?: boolean): Promise<void>;
  reset(): void;
  refreshAll(): Promise<void>;
}

// Signals for group detail state
const groupSignal = signal<Group | null>(null);
const membersSignal = signal<User[]>([]);
const expensesSignal = signal<ExpenseData[]>([]);
const balancesSignal = signal<GroupBalances | null>(null);
const loadingSignal = signal<boolean>(false);
const loadingMembersSignal = signal<boolean>(false);
const loadingExpensesSignal = signal<boolean>(false);
const loadingBalancesSignal = signal<boolean>(false);
const errorSignal = signal<string | null>(null);
const hasMoreExpensesSignal = signal<boolean>(true);
const expenseCursorSignal = signal<string | null>(null);

class GroupDetailStoreImpl implements GroupDetailStore {
  // State getters
  get group() { return groupSignal.value; }
  get members() { return membersSignal.value; }
  get expenses() { return expensesSignal.value; }
  get balances() { return balancesSignal.value; }
  get loading() { return loadingSignal.value; }
  get loadingMembers() { return loadingMembersSignal.value; }
  get loadingExpenses() { return loadingExpensesSignal.value; }
  get loadingBalances() { return loadingBalancesSignal.value; }
  get error() { return errorSignal.value; }
  get hasMoreExpenses() { return hasMoreExpensesSignal.value; }
  get expenseCursor() { return expenseCursorSignal.value; }

  async fetchGroup(id: string): Promise<void> {
    loadingSignal.value = true;
    errorSignal.value = null;

    try {
      groupSignal.value = await apiClient.getGroup(id) as Group;

      // Fetch members, balances and expenses in parallel
      await Promise.all([
        this.fetchMembers(),
        this.fetchBalances(),
        this.fetchExpenses()
      ]);
    } catch (error) {
      errorSignal.value = error instanceof Error ? error.message : 'Failed to fetch group';
      throw error;
    } finally {
      loadingSignal.value = false;
    }
  }

  async fetchMembers(): Promise<void> {
    if (!groupSignal.value) return;

    loadingMembersSignal.value = true;
    errorSignal.value = null;

    try {
      const response = await apiClient.getGroupMembers(groupSignal.value.id);
      membersSignal.value = response.members;
    } catch (error) {
      errorSignal.value = error instanceof Error ? error.message : 'Failed to fetch members';
      // Don't throw - members are not critical for basic functionality
      console.error('Failed to fetch group members:', error);
    } finally {
      loadingMembersSignal.value = false;
    }
  }

  async fetchExpenses(cursor?: string, includeDeleted?: boolean): Promise<void> {
    if (!groupSignal.value) return;

    loadingExpensesSignal.value = true;
    errorSignal.value = null;

    try {
      const response = await apiClient.getExpenses(
        groupSignal.value.id,
        20, // Load 20 expenses at a time
        cursor,
        includeDeleted
      );

      if (cursor) {
        // Append to existing expenses
        expensesSignal.value = [...expensesSignal.value, ...response.expenses];
      } else {
        // Replace expenses
        expensesSignal.value = response.expenses;
      }

      hasMoreExpensesSignal.value = response.hasMore;
      expenseCursorSignal.value = response.nextCursor || null;
    } catch (error) {
      errorSignal.value = error instanceof Error ? error.message : 'Failed to fetch expenses';
      throw error;
    } finally {
      loadingExpensesSignal.value = false;
    }
  }

  async fetchBalances(): Promise<void> {
    if (!groupSignal.value) return;

    loadingBalancesSignal.value = true;
    errorSignal.value = null;

    try {
      balancesSignal.value = await apiClient.getGroupBalances(groupSignal.value.id);
    } catch (error) {
      errorSignal.value = error instanceof Error ? error.message : 'Failed to fetch balances';
      throw error;
    } finally {
      loadingBalancesSignal.value = false;
    }
  }

  async loadMoreExpenses(): Promise<void> {
    if (!hasMoreExpensesSignal.value || !expenseCursorSignal.value) return;
    
    await this.fetchExpenses(expenseCursorSignal.value);
  }

  async refetchExpenses(includeDeleted?: boolean): Promise<void> {
    // Reset cursor and expenses to refetch from beginning
    expenseCursorSignal.value = null;
    expensesSignal.value = [];
    hasMoreExpensesSignal.value = true;
    
    await this.fetchExpenses(undefined, includeDeleted);
  }

  reset(): void {
    groupSignal.value = null;
    membersSignal.value = [];
    expensesSignal.value = [];
    balancesSignal.value = null;
    loadingSignal.value = false;
    loadingMembersSignal.value = false;
    loadingExpensesSignal.value = false;
    loadingBalancesSignal.value = false;
    errorSignal.value = null;
    hasMoreExpensesSignal.value = true;
    expenseCursorSignal.value = null;
  }

  async refreshAll(): Promise<void> {
    if (!groupSignal.value) return;
    
    // Refresh group, members, expenses, and balances
    await Promise.all([
      this.fetchGroup(groupSignal.value.id),
      this.fetchMembers(),
      this.fetchBalances(),
      this.fetchExpenses() // Reset expenses to first page
    ]);
  }
}

export const groupDetailStore = new GroupDetailStoreImpl();