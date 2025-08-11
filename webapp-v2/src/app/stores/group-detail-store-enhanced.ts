import { signal, batch } from '@preact/signals';
import { doc, collection, query, where, orderBy, limit, onSnapshot, Unsubscribe } from 'firebase/firestore';
import { getDb } from '../firebase';
import { ChangeDetector } from '../../utils/change-detector';
import { ConnectionManager } from '../../utils/connection-manager';
import type { ExpenseData, Group, GroupBalances, User } from '../../../../firebase/functions/src/shared/shared-types';
import { apiClient } from '../apiClient';

export interface EnhancedGroupDetailStore {
  // Inherited properties
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
  
  // Enhanced properties
  isStreaming: boolean;
  lastUpdate: number;
  hasRecentUpdates: boolean;
  
  // Methods
  loadGroup(id: string): Promise<void>;
  subscribeToChanges(userId: string): void;
  dispose(): void;
  reset(): void;
  
  // Inherited methods with enhanced behavior
  fetchMembers(): Promise<void>;
  fetchExpenses(cursor?: string, includeDeleted?: boolean): Promise<void>;
  fetchBalances(): Promise<void>;
  loadMoreExpenses(): Promise<void>;
  refreshAll(): Promise<void>;
}

// Enhanced state signals
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

// Streaming state signals
const isStreamingSignal = signal<boolean>(false);
const lastUpdateSignal = signal<number>(0);
const hasRecentUpdatesSignal = signal<boolean>(false);

interface ConflictInfo {
  id: string;
  localData: Partial<ExpenseData>;
  serverData: ExpenseData;
  conflictedFields: string[];
}

class EnhancedGroupDetailStoreImpl implements EnhancedGroupDetailStore {
  private groupListener: Unsubscribe | null = null;
  private balanceListener: Unsubscribe | null = null;
  private expenseChangeListener: (() => void) | null = null;
  private changeDetector = ChangeDetector.getInstance();
  private connectionManager = ConnectionManager.getInstance();
  
  private userContext = new Map<string, any>();
  private optimisticUpdates = new Map<string, Partial<ExpenseData>>();
  private currentGroupId: string | null = null;
  private updateAnimationTimeout: NodeJS.Timeout | null = null;

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
  
  // Enhanced getters
  get isStreaming() { return isStreamingSignal.value; }
  get lastUpdate() { return lastUpdateSignal.value; }
  get hasRecentUpdates() { return hasRecentUpdatesSignal.value; }

  async loadGroup(groupId: string): Promise<void> {
    loadingSignal.value = true;
    errorSignal.value = null;
    this.currentGroupId = groupId;

    try {
      // Initial load via REST
      const group = await apiClient.getGroup(groupId) as Group;
      groupSignal.value = group;

      // Load other data in parallel
      await Promise.all([
        this.fetchMembers(),
        this.fetchBalances(),
        this.fetchExpenses()
      ]);

      // Start streaming after initial load
      this.startStreaming(groupId);
      
    } catch (error) {
      errorSignal.value = error instanceof Error ? error.message : 'Failed to load group';
      throw error;
    } finally {
      loadingSignal.value = false;
    }
  }

  subscribeToChanges(userId: string): void {
    if (!this.currentGroupId) return;
    
    // Subscribe to expense changes using change detector
    this.expenseChangeListener = this.changeDetector.subscribeToExpenseChanges(
      this.currentGroupId,
      userId,
      (change) => {
        this.handleExpenseChange(change);
      }
    );
  }

  private startStreaming(groupId: string): void {
    this.subscribeToGroup(groupId);
    this.subscribeToBalances(groupId);
    isStreamingSignal.value = true;
  }

  private subscribeToGroup(groupId: string): void {
    // Full streaming for group metadata (small payload)
    const groupDoc = doc(getDb(), 'groups', groupId);
    
    this.groupListener = onSnapshot(
      groupDoc,
      { includeMetadataChanges: false },
      (snapshot) => {
        if (snapshot.exists() && !snapshot.metadata.fromCache) {
          const data = snapshot.data() as Group;
          
          // Smart update - only update changed fields
          batch(() => {
            const currentGroup = groupSignal.value;
            if (currentGroup && this.hasGroupChanges(currentGroup, data)) {
              groupSignal.value = { ...data, id: groupId };
              this.markUpdate();
              this.showUpdateAnimation();
            } else if (!currentGroup) {
              // Initial load from streaming
              groupSignal.value = { ...data, id: groupId };
            }
          });
        }
      },
      (error) => {
        console.warn('Group streaming error, falling back to REST:', error);
        this.handleStreamingError('group', groupId);
      }
    );
  }

  private subscribeToBalances(groupId: string): void {
    // Full streaming for balances (critical, small payload)
    const balancesQuery = query(
      collection(getDb(), 'group-balances'),
      where('groupId', '==', groupId)
    );
    
    this.balanceListener = onSnapshot(
      balancesQuery,
      { includeMetadataChanges: false },
      (snapshot) => {
        if (!snapshot.metadata.fromCache) {
          const balanceData: GroupBalances = {
            groupId,
            userBalances: {},
            simplifiedDebts: [],
            lastUpdated: new Date().toISOString()
          };
          
          let hasData = false;
          snapshot.forEach(doc => {
            const data = doc.data();
            if (data) {
              balanceData.userBalances[doc.id] = {
                userId: doc.id,
                owes: data.owes || {},
                owedBy: data.owedBy || {},
                netBalance: data.netBalance || data.balance || 0
              };
              hasData = true;
            }
          });

          if (hasData || snapshot.empty) {
            // Calculate settlements from balances
            this.calculateSettlements(balanceData);
            
            batch(() => {
              if (this.hasBalanceChanges(balancesSignal.value, balanceData)) {
                balancesSignal.value = balanceData;
                this.markUpdate();
                this.updateBalancesWithAnimation(balanceData);
              }
            });
          }
        }
      },
      (error) => {
        console.warn('Balance streaming error, falling back to REST:', error);
        this.handleStreamingError('balance', groupId);
      }
    );
  }

  private handleExpenseChange(change: any): void {
    if (!this.connectionManager.isOnline.value) return;
    
    // Save user context before refresh
    this.saveUserContext();
    
    // Schedule refresh based on priority
    const delay = this.getRefreshDelay(change.metadata?.priority);
    
    if (this.updateAnimationTimeout) {
      clearTimeout(this.updateAnimationTimeout);
    }
    
    this.updateAnimationTimeout = setTimeout(() => {
      this.refreshExpenses(change);
    }, delay);
  }

  private async refreshExpenses(change?: any): Promise<void> {
    if (!this.currentGroupId) return;

    try {
      // Fetch current page of expenses
      const response = await apiClient.getExpenses(
        this.currentGroupId,
        20, // Same page size as original
        undefined, // Reset to first page
        false // Don't include deleted
      );

      // Detect changes for animation
      const oldExpenses = expensesSignal.value;
      const changes = this.detectExpenseChanges(oldExpenses, response.expenses);
      
      batch(() => {
        expensesSignal.value = response.expenses;
        hasMoreExpensesSignal.value = response.hasMore;
        expenseCursorSignal.value = response.nextCursor || null;
        
        if (changes.added.length > 0 || changes.modified.length > 0) {
          this.markUpdate();
          this.animateExpenseChanges(changes);
        }
        
        // Restore user context
        this.restoreUserContext();
      });
      
    } catch (error) {
      console.debug('Background expense refresh failed:', error);
      // Silent fail for background refresh
    }
  }

  private getRefreshDelay(priority?: string): number {
    const quality = this.connectionManager.connectionQuality.value;
    
    switch (priority) {
      case 'high':
        return 100;
      case 'medium':
        return quality === 'poor' ? 2000 : 500;
      case 'low':
        return quality === 'poor' ? 5000 : 1000;
      default:
        return 500;
    }
  }

  private hasGroupChanges(current: Group, updated: Group): boolean {
    const fieldsToCheck: (keyof Group)[] = ['name', 'description', 'memberIds', 'lastActivity'];
    return fieldsToCheck.some(field => 
      JSON.stringify(current[field]) !== JSON.stringify(updated[field])
    );
  }

  private hasBalanceChanges(current: GroupBalances | null, updated: GroupBalances): boolean {
    if (!current) return true;
    
    return JSON.stringify(current.userBalances) !== JSON.stringify(updated.userBalances) ||
           JSON.stringify(current.simplifiedDebts) !== JSON.stringify(updated.simplifiedDebts);
  }

  private detectExpenseChanges(oldExpenses: ExpenseData[], newExpenses: ExpenseData[]) {
    const oldMap = new Map(oldExpenses.map(e => [e.id, e]));
    const newMap = new Map(newExpenses.map(e => [e.id, e]));
    
    const added = newExpenses.filter(e => !oldMap.has(e.id));
    const modified = newExpenses.filter(e => {
      const old = oldMap.get(e.id);
      return old && JSON.stringify(old) !== JSON.stringify(e);
    });
    const removed = oldExpenses.filter(e => !newMap.has(e.id));
    
    return { added, modified, removed };
  }

  private markUpdate(): void {
    lastUpdateSignal.value = Date.now();
    hasRecentUpdatesSignal.value = true;
    
    // Clear recent updates flag after 3 seconds
    setTimeout(() => {
      hasRecentUpdatesSignal.value = false;
    }, 3000);
  }

  private showUpdateAnimation(): void {
    // Trigger subtle UI update animation
    document.documentElement.style.setProperty('--update-flash', '1');
    setTimeout(() => {
      document.documentElement.style.setProperty('--update-flash', '0');
    }, 300);
  }

  private updateBalancesWithAnimation(balances: GroupBalances): void {
    // Add CSS class for balance update animation
    const balanceElements = document.querySelectorAll('.balance-item');
    balanceElements.forEach(element => {
      element.classList.add('balance-updated');
      setTimeout(() => {
        element.classList.remove('balance-updated');
      }, 500);
    });
  }

  private animateExpenseChanges(changes: any): void {
    // Animate new expenses
    changes.added.forEach((expense: ExpenseData, index: number) => {
      setTimeout(() => {
        const element = document.querySelector(`[data-expense-id="${expense.id}"]`);
        if (element) {
          element.classList.add('expense-added');
          setTimeout(() => element.classList.remove('expense-added'), 500);
        }
      }, index * 100);
    });
    
    // Animate modified expenses
    changes.modified.forEach((expense: ExpenseData) => {
      const element = document.querySelector(`[data-expense-id="${expense.id}"]`);
      if (element) {
        element.classList.add('expense-modified');
        setTimeout(() => element.classList.remove('expense-modified'), 300);
      }
    });
  }

  private calculateSettlements(balanceData: GroupBalances): void {
    const balances = Object.entries(balanceData.userBalances).map(([userId, userBalance]) => [userId, userBalance.netBalance]);
    const creditors = balances.filter(([_, balance]) => (balance as number) > 0.01);
    const debtors = balances.filter(([_, balance]) => (balance as number) < -0.01);
    
    const settlements = [];
    let creditorIndex = 0;
    let debtorIndex = 0;
    
    while (creditorIndex < creditors.length && debtorIndex < debtors.length) {
      const [creditorId, creditAmount] = creditors[creditorIndex];
      const [debtorId, debtAmount] = debtors[debtorIndex];
      
      const settlementAmount = Math.min(creditAmount as number, Math.abs(debtAmount as number));
      
      settlements.push({
        from: { userId: debtorId as string },
        to: { userId: creditorId as string },
        amount: Number(settlementAmount.toFixed(2))
      });
      
      (creditors[creditorIndex][1] as number) -= settlementAmount;
      (debtors[debtorIndex][1] as number) += settlementAmount;
      
      if ((creditors[creditorIndex][1] as number) < 0.01) creditorIndex++;
      if (Math.abs(debtors[debtorIndex][1] as number) < 0.01) debtorIndex++;
    }
    
    balanceData.simplifiedDebts = settlements;
  }

  private saveUserContext(): void {
    this.userContext.set('scrollPosition', window.scrollY);
    this.userContext.set('focusedElement', document.activeElement?.id || null);
    
    // Save form data if any
    const forms = document.querySelectorAll('form');
    const formData: { [key: string]: FormData } = {};
    forms.forEach((form, index) => {
      if (form.id || form.className) {
        const key = form.id || `form-${index}`;
        formData[key] = new FormData(form);
      }
    });
    this.userContext.set('formData', formData);
  }

  private restoreUserContext(): void {
    // Restore scroll position
    const scrollPos = this.userContext.get('scrollPosition');
    if (scrollPos) {
      requestAnimationFrame(() => {
        window.scrollTo({ top: scrollPos, behavior: 'instant' });
      });
    }
    
    // Restore focus
    const focusId = this.userContext.get('focusedElement');
    if (focusId) {
      setTimeout(() => {
        const element = document.getElementById(focusId);
        if (element && element.focus) {
          element.focus();
        }
      }, 50);
    }
  }

  private handleStreamingError(type: string, groupId: string): void {
    console.warn(`${type} streaming failed, falling back to REST`);
    
    // Implement exponential backoff retry
    setTimeout(() => {
      if (this.currentGroupId === groupId) {
        this.retryStreaming(type, groupId);
      }
    }, 5000);
  }

  private retryStreaming(type: string, groupId: string): void {
    if (type === 'group') {
      this.subscribeToGroup(groupId);
    } else if (type === 'balance') {
      this.subscribeToBalances(groupId);
    }
  }

  // Inherited methods with enhanced behavior
  async fetchMembers(): Promise<void> {
    if (!this.currentGroupId) return;

    loadingMembersSignal.value = true;
    errorSignal.value = null;

    try {
      const response = await apiClient.getGroupMembers(this.currentGroupId);
      membersSignal.value = response.members;
    } catch (error) {
      errorSignal.value = error instanceof Error ? error.message : 'Failed to fetch members';
      console.error('Failed to fetch group members:', error);
    } finally {
      loadingMembersSignal.value = false;
    }
  }

  async fetchExpenses(cursor?: string, includeDeleted?: boolean): Promise<void> {
    if (!this.currentGroupId) return;

    loadingExpensesSignal.value = true;
    errorSignal.value = null;

    try {
      const response = await apiClient.getExpenses(
        this.currentGroupId,
        20,
        cursor,
        includeDeleted
      );

      if (cursor) {
        expensesSignal.value = [...expensesSignal.value, ...response.expenses];
      } else {
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
    if (!this.currentGroupId) return;

    loadingBalancesSignal.value = true;
    errorSignal.value = null;

    try {
      balancesSignal.value = await apiClient.getGroupBalances(this.currentGroupId);
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

  async refreshAll(): Promise<void> {
    if (!this.currentGroupId) return;
    
    await Promise.all([
      this.fetchMembers(),
      this.fetchBalances(),
      this.fetchExpenses() // Reset to first page
    ]);
  }

  reset(): void {
    // Clean up listeners
    this.dispose();
    
    // Reset state
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
    
    // Reset streaming state
    isStreamingSignal.value = false;
    lastUpdateSignal.value = 0;
    hasRecentUpdatesSignal.value = false;
    
    this.currentGroupId = null;
    this.userContext.clear();
    this.optimisticUpdates.clear();
  }

  dispose(): void {
    // Clean up all listeners
    if (this.groupListener) {
      this.groupListener();
      this.groupListener = null;
    }
    
    if (this.balanceListener) {
      this.balanceListener();
      this.balanceListener = null;
    }
    
    if (this.expenseChangeListener) {
      this.expenseChangeListener();
      this.expenseChangeListener = null;
    }
    
    if (this.updateAnimationTimeout) {
      clearTimeout(this.updateAnimationTimeout);
      this.updateAnimationTimeout = null;
    }
    
    isStreamingSignal.value = false;
  }
}

export const enhancedGroupDetailStore = new EnhancedGroupDetailStoreImpl();