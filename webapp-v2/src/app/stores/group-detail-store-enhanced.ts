import { signal, batch } from '@preact/signals';
import { ChangeDetector } from '../../utils/change-detector';
import {logApiResponse, logWarning, logError, logInfo} from '../../utils/browser-logger';
import type { ExpenseData, Group, GroupBalances, User } from '../../../../firebase/functions/src/shared/shared-types';
import { apiClient } from '../apiClient';

export interface EnhancedGroupDetailStore {
  // State
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
  
  // Methods
  loadGroup(id: string): Promise<void>;
  subscribeToChanges(userId: string): void;
  dispose(): void;
  reset(): void;
  fetchMembers(): Promise<void>;
  fetchExpenses(cursor?: string, includeDeleted?: boolean): Promise<void>;
  fetchBalances(): Promise<void>;
  loadMoreExpenses(): Promise<void>;
  refreshAll(): Promise<void>;
}

// State signals
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

class EnhancedGroupDetailStoreImpl implements EnhancedGroupDetailStore {
  private expenseChangeListener: (() => void) | null = null;
  private groupChangeListener: (() => void) | null = null;
  private changeDetector = new ChangeDetector();
  private currentGroupId: string | null = null;

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

  async loadGroup(groupId: string): Promise<void> {
    loadingSignal.value = true;
    errorSignal.value = null;
    this.currentGroupId = groupId;

    try {
      // Initial load via REST
      const [groupData] = await Promise.all([
        apiClient.getGroup(groupId),
        this.fetchMembers(),
        this.fetchExpenses(),
        this.fetchBalances()
      ]);
      
      groupSignal.value = groupData;
      
    } catch (error) {
      errorSignal.value = error instanceof Error ? error.message : 'Failed to load group';
      throw error;
    } finally {
      loadingSignal.value = false;
    }
  }

  subscribeToChanges(userId: string): void {
    if (!this.currentGroupId) {
      logWarning('Cannot subscribe to changes - no currentGroupId', { userId });
      return;
    }
    
    logInfo('Setting up change subscriptions', { 
      groupId: this.currentGroupId, 
      userId 
    });
    
    // Subscribe to expense changes - any change triggers full refresh
    this.expenseChangeListener = this.changeDetector.subscribeToExpenseChanges(
      this.currentGroupId,
      () => {
        // Defensive check: ignore changes if currentGroupId is null (component disposed)
        if (!this.currentGroupId) {
          logInfo("Ignoring expense change - currentGroupId is null (component disposed)");
          return;
        }
        // Any change = refresh everything
        logApiResponse('CHANGE', 'expense_change', 200, { 
          action: 'REFRESHING_ALL',
          groupId: this.currentGroupId 
        });
        this.refreshAll().catch(error => 
          logError('Failed to refresh after expense change', error)
        );
      }
    );
    
    // Subscribe to group changes (member additions/removals, group updates)
    this.groupChangeListener = this.changeDetector.subscribeToGroupChanges(
      userId,
      () => {
        // Defensive check: ignore changes if currentGroupId is null (component disposed)
        if (!this.currentGroupId) {
          logInfo("Ignoring group change - currentGroupId is null (component disposed)");
          return;
        }
        // Group change = refresh group data and members
        logApiResponse('CHANGE', 'group_change', 200, { 
          action: 'REFRESHING_GROUP_AND_MEMBERS',
          groupId: this.currentGroupId 
        });
        Promise.all([
          this.loadGroup(this.currentGroupId!),
          this.fetchMembers()
        ]).catch(error => 
          logError('Failed to refresh after group change', error)
        );
      }
    );
    
    logInfo('Change subscriptions setup complete', { 
      groupId: this.currentGroupId,
      hasExpenseListener: !!this.expenseChangeListener,
      hasGroupListener: !!this.groupChangeListener
    });
  }



  async fetchMembers(): Promise<void> {
    if (!this.currentGroupId) return;
    
    loadingMembersSignal.value = true;
    try {
      const memberData = await apiClient.getGroupMembers(this.currentGroupId);
      membersSignal.value = memberData.members;
    } catch (error) {
      logWarning('Failed to fetch members', { error });
    } finally {
      loadingMembersSignal.value = false;
    }
  }

  async fetchExpenses(cursor?: string, includeDeleted: boolean = false): Promise<void> {
    if (!this.currentGroupId) return;
    
    loadingExpensesSignal.value = true;
    try {
      const response = await apiClient.getExpenses(this.currentGroupId, undefined, cursor, includeDeleted);
      
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
      logWarning('Failed to fetch expenses', { error });
    } finally {
      loadingExpensesSignal.value = false;
    }
  }

  async fetchBalances(): Promise<void> {
    if (!this.currentGroupId) return;
    
    loadingBalancesSignal.value = true;
    try {
      const balanceData = await apiClient.getGroupBalances(this.currentGroupId);
      balancesSignal.value = balanceData;
    } catch (error) {
      logWarning('Failed to fetch balances', { error });
    } finally {
      loadingBalancesSignal.value = false;
    }
  }

  async loadMoreExpenses(): Promise<void> {
    if (!hasMoreExpensesSignal.value || !expenseCursorSignal.value) return;
    await this.fetchExpenses(expenseCursorSignal.value);
  }

  async refreshAll(): Promise<void> {
    if (!this.currentGroupId) return;
    
    await Promise.all([
      this.fetchExpenses(),
      this.fetchBalances(),
      this.fetchMembers()
    ]);
  }

  dispose(): void {
    // Clean up listeners
    if (this.expenseChangeListener) {
      this.expenseChangeListener();
      this.expenseChangeListener = null;
    }
    if (this.groupChangeListener) {
      this.groupChangeListener();
      this.groupChangeListener = null;
    }
  }

  reset(): void {
    this.dispose();
    
    // Reset all signals
    batch(() => {
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
    });
    
    this.currentGroupId = null;
  }
}

// Export singleton instance
export const enhancedGroupDetailStore = new EnhancedGroupDetailStoreImpl();