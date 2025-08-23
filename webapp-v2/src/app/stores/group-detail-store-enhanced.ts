import { signal, batch } from '@preact/signals';
import { ChangeDetector } from '@/utils/change-detector.ts';
import { logApiResponse, logWarning, logError, logInfo } from '@/utils/browser-logger.ts';
import type { ExpenseData, Group, GroupBalances, User, SettlementListItem } from '@shared/shared-types.ts';
import { apiClient } from '../apiClient';

export interface EnhancedGroupDetailStore {
    // State
    group: Group | null;
    members: User[];
    expenses: ExpenseData[];
    balances: GroupBalances | null;
    settlements: SettlementListItem[];
    loading: boolean;
    loadingMembers: boolean;
    loadingExpenses: boolean;
    loadingBalances: boolean;
    loadingSettlements: boolean;
    error: string | null;
    hasMoreExpenses: boolean;
    expenseCursor: string | null;
    hasMoreSettlements: boolean;
    settlementsCursor: string | null;

    // Methods
    loadGroup(id: string): Promise<void>;
    subscribeToChanges(userId: string): void;
    dispose(): void;
    reset(): void;
    fetchMembers(): Promise<void>;
    fetchExpenses(cursor?: string, includeDeleted?: boolean): Promise<void>;
    fetchBalances(): Promise<void>;
    fetchSettlements(cursor?: string, userId?: string): Promise<void>;
    loadMoreExpenses(): Promise<void>;
    loadMoreSettlements(): Promise<void>;
    refreshAll(): Promise<void>;
    leaveGroup(groupId: string): Promise<{ success: boolean; message: string }>;
    removeMember(groupId: string, memberId: string): Promise<{ success: boolean; message: string }>;
    fetchGroup(id: string): Promise<void>;
}

// State signals
const groupSignal = signal<Group | null>(null);
const membersSignal = signal<User[]>([]);
const expensesSignal = signal<ExpenseData[]>([]);
const balancesSignal = signal<GroupBalances | null>(null);
const settlementsSignal = signal<SettlementListItem[]>([]);
const loadingSignal = signal<boolean>(false);
const loadingMembersSignal = signal<boolean>(false);
const loadingExpensesSignal = signal<boolean>(false);
const loadingBalancesSignal = signal<boolean>(false);
const loadingSettlementsSignal = signal<boolean>(false);
const errorSignal = signal<string | null>(null);
const hasMoreExpensesSignal = signal<boolean>(true);
const expenseCursorSignal = signal<string | null>(null);
const hasMoreSettlementsSignal = signal<boolean>(false);
const settlementsCursorSignal = signal<string | null>(null);

class EnhancedGroupDetailStoreImpl implements EnhancedGroupDetailStore {
    private expenseChangeListener: (() => void) | null = null;
    private groupChangeListener: (() => void) | null = null;
    private changeDetector = new ChangeDetector();
    private currentGroupId: string | null = null;

    // State getters
    get group() {
        return groupSignal.value;
    }
    get members() {
        return membersSignal.value;
    }
    get expenses() {
        return expensesSignal.value;
    }
    get balances() {
        return balancesSignal.value;
    }
    get loading() {
        return loadingSignal.value;
    }
    get loadingMembers() {
        return loadingMembersSignal.value;
    }
    get loadingExpenses() {
        return loadingExpensesSignal.value;
    }
    get loadingBalances() {
        return loadingBalancesSignal.value;
    }
    get error() {
        return errorSignal.value;
    }
    get hasMoreExpenses() {
        return hasMoreExpensesSignal.value;
    }
    get expenseCursor() {
        return expenseCursorSignal.value;
    }
    get settlements() {
        return settlementsSignal.value;
    }
    get loadingSettlements() {
        return loadingSettlementsSignal.value;
    }
    get hasMoreSettlements() {
        return hasMoreSettlementsSignal.value;
    }
    get settlementsCursor() {
        return settlementsCursorSignal.value;
    }

    async loadGroup(groupId: string): Promise<void> {
        loadingSignal.value = true;
        errorSignal.value = null;
        this.currentGroupId = groupId;

        try {
            // Use consolidated endpoint to eliminate race conditions
            const fullDetails = await apiClient.getGroupFullDetails(groupId);

            // Update all signals atomically using batch to prevent race conditions
            batch(() => {
                groupSignal.value = fullDetails.group;
                membersSignal.value = fullDetails.members.members;
                expensesSignal.value = fullDetails.expenses.expenses;
                balancesSignal.value = fullDetails.balances;
                settlementsSignal.value = fullDetails.settlements.settlements;

                // Update pagination state
                hasMoreExpensesSignal.value = fullDetails.expenses.hasMore;
                expenseCursorSignal.value = fullDetails.expenses.nextCursor || null;
                hasMoreSettlementsSignal.value = fullDetails.settlements.hasMore;
                settlementsCursorSignal.value = fullDetails.settlements.nextCursor || null;

                // CRITICAL: Only set loading to false AFTER all data is populated
                loadingSignal.value = false;
            });
        } catch (error) {
            errorSignal.value = error instanceof Error ? error.message : 'Failed to load group';
            loadingSignal.value = false;
            throw error;
        }
    }

    subscribeToChanges(userId: string): void {
        if (!this.currentGroupId) {
            logWarning('Cannot subscribe to changes - no currentGroupId', { userId });
            return;
        }

        logInfo('Setting up change subscriptions', {
            groupId: this.currentGroupId,
            userId,
        });

        // Subscribe to expense changes - any change triggers full refresh
        this.expenseChangeListener = this.changeDetector.subscribeToExpenseChanges(this.currentGroupId, () => {
            // Defensive check: ignore changes if currentGroupId is null (component disposed)
            if (!this.currentGroupId) {
                logInfo('Ignoring expense change - currentGroupId is null (component disposed)');
                return;
            }
            // Any change = refresh everything
            logApiResponse('CHANGE', 'expense_change', 200, {
                action: 'REFRESHING_ALL',
                groupId: this.currentGroupId,
            });
            this.refreshAll().catch((error) => logError('Failed to refresh after expense change', error));
        });

        // Subscribe to group changes (member additions/removals, group updates)
        this.groupChangeListener = this.changeDetector.subscribeToGroupChanges(userId, () => {
            // Defensive check: ignore changes if currentGroupId is null (component disposed)
            if (!this.currentGroupId) {
                logInfo('Ignoring group change - currentGroupId is null (component disposed)');
                return;
            }
            // Group change = refresh group data and members
            logApiResponse('CHANGE', 'group_change', 200, {
                action: 'REFRESHING_GROUP_AND_MEMBERS',
                groupId: this.currentGroupId,
            });
            Promise.all([this.loadGroup(this.currentGroupId!), this.fetchMembers()]).catch((error) => logError('Failed to refresh after group change', error));
        });

        logInfo('Change subscriptions setup complete', {
            groupId: this.currentGroupId,
            hasExpenseListener: !!this.expenseChangeListener,
            hasGroupListener: !!this.groupChangeListener,
        });
    }

    async fetchMembers(): Promise<void> {
        if (!this.currentGroupId) return;

        loadingMembersSignal.value = true;
        try {
            const memberData = await apiClient.getGroupMembers(this.currentGroupId);
            if (memberData.members.length === 0) {
                logError('group has no members', { groupId: this.currentGroupId });
            }
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

    async fetchSettlements(cursor?: string, userId?: string): Promise<void> {
        if (!this.currentGroupId) return;

        loadingSettlementsSignal.value = true;
        try {
            const response = await apiClient.listSettlements(this.currentGroupId, 20, cursor, userId);

            if (cursor) {
                // Append to existing settlements
                settlementsSignal.value = [...settlementsSignal.value, ...response.settlements];
            } else {
                // Replace settlements
                settlementsSignal.value = response.settlements;
            }

            hasMoreSettlementsSignal.value = response.hasMore;
            settlementsCursorSignal.value = response.nextCursor || null;
        } catch (error) {
            logWarning('Failed to fetch settlements', { error });
        } finally {
            loadingSettlementsSignal.value = false;
        }
    }

    async loadMoreExpenses(): Promise<void> {
        if (!hasMoreExpensesSignal.value || !expenseCursorSignal.value || !this.currentGroupId) return;

        // Use consolidated endpoint for progressive loading to maintain consistency
        loadingExpensesSignal.value = true;
        try {
            const fullDetails = await apiClient.getGroupFullDetails(this.currentGroupId, {
                expenseCursor: expenseCursorSignal.value,
                expenseLimit: 20,
            });

            batch(() => {
                // Append new expenses to existing ones
                expensesSignal.value = [...expensesSignal.value, ...fullDetails.expenses.expenses];

                // Update pagination state
                hasMoreExpensesSignal.value = fullDetails.expenses.hasMore;
                expenseCursorSignal.value = fullDetails.expenses.nextCursor || null;
            });
        } catch (error) {
            logWarning('Failed to load more expenses', { error });
        } finally {
            loadingExpensesSignal.value = false;
        }
    }

    async loadMoreSettlements(): Promise<void> {
        if (!hasMoreSettlementsSignal.value || !settlementsCursorSignal.value || !this.currentGroupId) return;

        // Use consolidated endpoint for progressive loading to maintain consistency
        loadingSettlementsSignal.value = true;
        try {
            const fullDetails = await apiClient.getGroupFullDetails(this.currentGroupId, {
                settlementCursor: settlementsCursorSignal.value,
                settlementLimit: 20,
            });

            batch(() => {
                // Append new settlements to existing ones
                settlementsSignal.value = [...settlementsSignal.value, ...fullDetails.settlements.settlements];

                // Update pagination state
                hasMoreSettlementsSignal.value = fullDetails.settlements.hasMore;
                settlementsCursorSignal.value = fullDetails.settlements.nextCursor || null;
            });
        } catch (error) {
            logWarning('Failed to load more settlements', { error });
        } finally {
            loadingSettlementsSignal.value = false;
        }
    }

    async refreshAll(): Promise<void> {
        if (!this.currentGroupId) return;

        // Use the consolidated full-details endpoint to ensure atomic data consistency
        // This prevents race conditions where balances might not be calculated yet
        await this.loadGroup(this.currentGroupId);
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
            settlementsSignal.value = [];
            loadingSignal.value = false;
            loadingMembersSignal.value = false;
            loadingExpensesSignal.value = false;
            loadingBalancesSignal.value = false;
            loadingSettlementsSignal.value = false;
            errorSignal.value = null;
            hasMoreExpensesSignal.value = true;
            expenseCursorSignal.value = null;
            hasMoreSettlementsSignal.value = false;
            settlementsCursorSignal.value = null;
        });

        this.currentGroupId = null;
    }

    async leaveGroup(groupId: string): Promise<{ success: boolean; message: string }> {
        try {
            const response = await apiClient.leaveGroup(groupId);
            return response;
        } catch (error) {
            errorSignal.value = error instanceof Error ? error.message : 'Failed to leave group';
            throw error;
        }
    }

    async removeMember(groupId: string, memberId: string): Promise<{ success: boolean; message: string }> {
        try {
            const response = await apiClient.removeGroupMember(groupId, memberId);
            // Refresh members and balances after successful removal
            if (response.success) {
                await Promise.all([this.fetchMembers(), this.fetchBalances()]);
            }
            return response;
        } catch (error) {
            errorSignal.value = error instanceof Error ? error.message : 'Failed to remove member';
            throw error;
        }
    }

    async fetchGroup(id: string): Promise<void> {
        // Alias for loadGroup to maintain compatibility
        return this.loadGroup(id);
    }
}

// Export singleton instance
export const enhancedGroupDetailStore = new EnhancedGroupDetailStoreImpl();
