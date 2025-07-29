import { signal } from '@preact/signals';
import type { Group, ExpenseData, GroupBalances } from '../../types/webapp-shared-types';
import { apiClient } from '../apiClient';

export interface GroupDetailStore {
  group: Group | null;
  expenses: ExpenseData[];
  balances: GroupBalances | null;
  loading: boolean;
  loadingExpenses: boolean;
  loadingBalances: boolean;
  error: string | null;
  hasMoreExpenses: boolean;
  expenseCursor: string | null;
  
  fetchGroup(id: string): Promise<void>;
  fetchExpenses(cursor?: string): Promise<void>;
  fetchBalances(): Promise<void>;
  loadMoreExpenses(): Promise<void>;
  reset(): void;
  refreshAll(): Promise<void>;
}

// Signals for group detail state
const groupSignal = signal<Group | null>(null);
const expensesSignal = signal<ExpenseData[]>([]);
const balancesSignal = signal<GroupBalances | null>(null);
const loadingSignal = signal<boolean>(false);
const loadingExpensesSignal = signal<boolean>(false);
const loadingBalancesSignal = signal<boolean>(false);
const errorSignal = signal<string | null>(null);
const hasMoreExpensesSignal = signal<boolean>(true);
const expenseCursorSignal = signal<string | null>(null);

class GroupDetailStoreImpl implements GroupDetailStore {
  // State getters
  get group() { return groupSignal.value; }
  get expenses() { return expensesSignal.value; }
  get balances() { return balancesSignal.value; }
  get loading() { return loadingSignal.value; }
  get loadingExpenses() { return loadingExpensesSignal.value; }
  get loadingBalances() { return loadingBalancesSignal.value; }
  get error() { return errorSignal.value; }
  get hasMoreExpenses() { return hasMoreExpensesSignal.value; }
  get expenseCursor() { return expenseCursorSignal.value; }

  async fetchGroup(id: string): Promise<void> {
    loadingSignal.value = true;
    errorSignal.value = null;

    try {
      const group = await apiClient.getGroup(id) as Group;
      groupSignal.value = group;

      // Fetch balances and expenses in parallel
      await Promise.all([
        this.fetchBalances(),
        this.fetchExpenses()
      ]);
    } catch (error) {
      console.error('Error in fetchGroup:', error);
      errorSignal.value = error instanceof Error ? error.message : 'Failed to fetch group';
      throw error;
    } finally {
      loadingSignal.value = false;
    }
  }

  async fetchExpenses(cursor?: string): Promise<void> {
    if (!groupSignal.value) return;

    loadingExpensesSignal.value = true;
    errorSignal.value = null;

    try {
      const response = await apiClient.getExpenses(
        groupSignal.value.id,
        20, // Load 20 expenses at a time
        cursor
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
      const balances = await apiClient.getGroupBalances(groupSignal.value.id);
      balancesSignal.value = balances;
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

  reset(): void {
    groupSignal.value = null;
    expensesSignal.value = [];
    balancesSignal.value = null;
    loadingSignal.value = false;
    loadingExpensesSignal.value = false;
    loadingBalancesSignal.value = false;
    errorSignal.value = null;
    hasMoreExpensesSignal.value = true;
    expenseCursorSignal.value = null;
  }

  async refreshAll(): Promise<void> {
    if (!groupSignal.value) return;
    
    // Refresh group, expenses, and balances
    await Promise.all([
      this.fetchGroup(groupSignal.value.id),
      this.fetchBalances(),
      this.fetchExpenses() // Reset expenses to first page
    ]);
  }
}

export const groupDetailStore = new GroupDetailStoreImpl();