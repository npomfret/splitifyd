import { signal, batch } from '@preact/signals';
import { ChangeDetector } from '@/utils/change-detector.ts';
import { logApiResponse, logWarning, logError, logInfo } from '@/utils/browser-logger.ts';
import type { ExpenseData, Group, GroupBalances, GroupMemberWithProfile, SettlementListItem } from '@splitifyd/shared';
import { apiClient } from '../apiClient';
import { permissionsStore } from '../../stores/permissions-store';

export interface EnhancedGroupDetailStore {
    // State
    group: Group | null;
    members: GroupMemberWithProfile[];
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

    // New reference-counted methods
    registerComponent(groupId: string, userId: string): Promise<void>;
    deregisterComponent(groupId: string): void;
    
    // Legacy methods (for backward compatibility during transition)
    loadGroup(id: string): Promise<void>;
    subscribeToChanges(userId: string): void;
    dispose(): void;
    reset(): void;
    
    // Other methods
    fetchSettlements(cursor?: string, userId?: string): Promise<void>;
    loadMoreExpenses(): Promise<void>;
    loadMoreSettlements(): Promise<void>;
    refreshAll(): Promise<void>;
    leaveGroup(groupId: string): Promise<{ success: boolean; message: string }>;
    removeMember(groupId: string, memberId: string): Promise<{ success: boolean; message: string }>;
}

class EnhancedGroupDetailStoreImpl implements EnhancedGroupDetailStore {
    // Private signals - encapsulated within the class
    readonly #groupSignal = signal<Group | null>(null);
    readonly #membersSignal = signal<GroupMemberWithProfile[]>([]);
    readonly #expensesSignal = signal<ExpenseData[]>([]);
    readonly #balancesSignal = signal<GroupBalances | null>(null);
    readonly #settlementsSignal = signal<SettlementListItem[]>([]);
    readonly #loadingSignal = signal<boolean>(false);
    readonly #loadingMembersSignal = signal<boolean>(false);
    readonly #loadingExpensesSignal = signal<boolean>(false);
    readonly #loadingBalancesSignal = signal<boolean>(false);
    readonly #loadingSettlementsSignal = signal<boolean>(false);
    readonly #errorSignal = signal<string | null>(null);
    readonly #hasMoreExpensesSignal = signal<boolean>(true);
    readonly #expenseCursorSignal = signal<string | null>(null);
    readonly #hasMoreSettlementsSignal = signal<boolean>(false);
    readonly #settlementsCursorSignal = signal<string | null>(null);

    // Legacy single-group subscription state (for backward compatibility)
    private expenseChangeListener: (() => void) | null = null;
    private groupChangeListener: (() => void) | null = null;
    private changeDetector = new ChangeDetector();
    private currentGroupId: string | null = null;
    
    // New reference counting infrastructure
    readonly #subscriberCounts = new Map<string, number>();
    readonly #activeSubscriptions = new Map<string, {
        expenseListener: () => void;
        groupListener: () => void;
        changeDetector: ChangeDetector;
        userId: string;
    }>();

    // State getters - readonly values for external consumers
    get group() {
        return this.#groupSignal.value;
    }
    get members() {
        return this.#membersSignal.value;
    }
    get expenses() {
        return this.#expensesSignal.value;
    }
    get balances() {
        return this.#balancesSignal.value;
    }
    get loading() {
        return this.#loadingSignal.value;
    }
    get loadingMembers() {
        return this.#loadingMembersSignal.value;
    }
    get loadingExpenses() {
        return this.#loadingExpensesSignal.value;
    }
    get loadingBalances() {
        return this.#loadingBalancesSignal.value;
    }
    get error() {
        return this.#errorSignal.value;
    }
    get hasMoreExpenses() {
        return this.#hasMoreExpensesSignal.value;
    }
    get expenseCursor() {
        return this.#expenseCursorSignal.value;
    }
    get settlements() {
        return this.#settlementsSignal.value;
    }
    get loadingSettlements() {
        return this.#loadingSettlementsSignal.value;
    }
    get hasMoreSettlements() {
        return this.#hasMoreSettlementsSignal.value;
    }
    get settlementsCursor() {
        return this.#settlementsCursorSignal.value;
    }

    // NEW REFERENCE-COUNTED API
    
    /**
     * Register a component that needs this group's data.
     * Uses reference counting to manage subscriptions efficiently.
     */
    async registerComponent(groupId: string, userId: string): Promise<void> {
        logInfo('Registering component for group', { groupId, userId });
        const currentCount = this.#subscriberCounts.get(groupId) || 0;
        this.#subscriberCounts.set(groupId, currentCount + 1);

        if (currentCount === 0) {
            // First component for this group - create subscription
            logInfo(`First component for group ${groupId}, creating subscription.`);
            await this.#loadGroupAndSubscribe(groupId, userId);
        }
    }

    /**
     * Deregister a component that no longer needs this group's data.
     * Cleans up subscriptions when no components are using them.
     */
    deregisterComponent(groupId: string): void {
        logInfo('Deregistering component for group', { groupId });
        const currentCount = this.#subscriberCounts.get(groupId) || 0;

        if (currentCount <= 1) {
            // Last component for this group - dispose subscription
            logInfo(`Last component for group ${groupId}, disposing subscription.`);
            this.#subscriberCounts.delete(groupId);
            this.#disposeGroupSubscription(groupId);
        } else {
            this.#subscriberCounts.set(groupId, currentCount - 1);
        }
    }

    // INTERNAL METHODS FOR REFERENCE COUNTING

    /**
     * Internal method to load group data and set up subscriptions
     */
    async #loadGroupAndSubscribe(groupId: string, userId: string): Promise<void> {
        // Load the group data first
        await this.loadGroup(groupId);
        
        // Initialize permissions store for this group
        permissionsStore.registerComponent(groupId, userId);
        
        // Set up dedicated subscriptions for this group
        this.#subscribeToGroupChanges(groupId, userId);
    }

    /**
     * Internal method to subscribe to changes for a specific group
     */
    #subscribeToGroupChanges(groupId: string, userId: string): void {
        // Create a dedicated change detector for this group
        const groupChangeDetector = new ChangeDetector();
        
        // Subscribe to expense changes for this group
        const expenseListener = groupChangeDetector.subscribeToExpenseChanges(groupId, () => {
            // Always refresh for reference-counted subscriptions - we only create them for active groups
            logApiResponse('CHANGE', 'expense_change', 200, {
                action: 'REFRESHING_ALL',
                groupId,
            });
            this.refreshAll().catch((error) => 
                logError('Failed to refresh after expense change', error)
            );
        });

        // Subscribe to group changes (member additions/removals, group updates)
        const groupListener = groupChangeDetector.subscribeToGroupChanges(userId, () => {
            // Always refresh for reference-counted subscriptions - we only create them for active groups
            logApiResponse('CHANGE', 'group_change', 200, {
                action: 'REFRESHING_ALL',
                groupId,
            });
            this.refreshAll().catch((error) => 
                logError('Failed to refresh after group change', error)
            );
        });

        // Store subscription info for cleanup
        this.#activeSubscriptions.set(groupId, {
            expenseListener,
            groupListener,
            changeDetector: groupChangeDetector,
            userId,
        });

        logInfo('Group change subscriptions setup complete', {
            groupId,
            userId,
            hasExpenseListener: !!expenseListener,
            hasGroupListener: !!groupListener,
        });
    }

    /**
     * Internal method to dispose subscriptions for a specific group
     */
    #disposeGroupSubscription(groupId: string): void {
        const subscription = this.#activeSubscriptions.get(groupId);
        if (!subscription) {
            return;
        }

        // Clean up the listeners
        if (subscription.expenseListener) {
            subscription.expenseListener();
        }
        if (subscription.groupListener) {
            subscription.groupListener();
        }

        // Dispose the change detector
        subscription.changeDetector.dispose();
        
        // Deregister from permissions store
        permissionsStore.deregisterComponent(groupId);

        // Remove from tracking
        this.#activeSubscriptions.delete(groupId);
        
        logInfo('Group subscription disposed', { groupId });
    }

    // LEGACY API (for backward compatibility)

    async loadGroup(groupId: string): Promise<void> {
        this.#loadingSignal.value = true;
        this.#errorSignal.value = null;
        this.currentGroupId = groupId;

        try {
            // Use consolidated endpoint to eliminate race conditions
            const fullDetails = await apiClient.getGroupFullDetails(groupId);

            // Update all signals atomically using batch to prevent race conditions
            batch(() => {
                logInfo('LoadGroup: Updating group signal', {
                    groupId: this.currentGroupId,
                    oldName: this.#groupSignal.value?.name,
                    newName: fullDetails.group.name,
                });
                this.#groupSignal.value = fullDetails.group;
                this.#membersSignal.value = fullDetails.members.members;
                this.#expensesSignal.value = fullDetails.expenses.expenses;
                this.#balancesSignal.value = fullDetails.balances;
                this.#settlementsSignal.value = fullDetails.settlements.settlements;

                // Update pagination state
                this.#hasMoreExpensesSignal.value = fullDetails.expenses.hasMore;
                this.#expenseCursorSignal.value = fullDetails.expenses.nextCursor || null;
                this.#hasMoreSettlementsSignal.value = fullDetails.settlements.hasMore;
                this.#settlementsCursorSignal.value = fullDetails.settlements.nextCursor || null;

                // CRITICAL: Only set loading to false AFTER all data is populated
                this.#loadingSignal.value = false;
            });
            
            // Update permissions store with the new group data and members
            permissionsStore.updateGroupData(fullDetails.group, fullDetails.members.members);
        } catch (error) {
            this.#errorSignal.value = error instanceof Error ? error.message : 'Failed to load group';
            this.#loadingSignal.value = false;
            throw error;
        }
    }

    subscribeToChanges(userId: string): void {
        if (!this.currentGroupId) {
            logWarning('Cannot subscribe to changes - no currentGroupId', { userId });
            return;
        }

        // Initialize permissions store with current user using reference counting
        permissionsStore.registerComponent(this.currentGroupId, userId);

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
            // Group change = refresh everything (same as expense changes for consistency)
            logApiResponse('CHANGE', 'group_change', 200, {
                action: 'REFRESHING_ALL',
                groupId: this.currentGroupId,
            });
            this.refreshAll().catch((error) => logError('Failed to refresh after group change', error));
        });

        logInfo('Change subscriptions setup complete', {
            groupId: this.currentGroupId,
            hasExpenseListener: !!this.expenseChangeListener,
            hasGroupListener: !!this.groupChangeListener,
        });
    }

    async fetchSettlements(cursor?: string, userId?: string): Promise<void> {
        if (!this.currentGroupId) return;

        this.#loadingSettlementsSignal.value = true;
        try {
            const response = await apiClient.listSettlements(this.currentGroupId, 20, cursor, userId);

            if (cursor) {
                // Append to existing settlements
                this.#settlementsSignal.value = [...this.#settlementsSignal.value, ...response.settlements];
            } else {
                // Replace settlements
                this.#settlementsSignal.value = response.settlements;
            }

            this.#hasMoreSettlementsSignal.value = response.hasMore;
            this.#settlementsCursorSignal.value = response.nextCursor || null;
        } catch (error) {
            logWarning('Failed to fetch settlements', { error });
        } finally {
            this.#loadingSettlementsSignal.value = false;
        }
    }

    async loadMoreExpenses(): Promise<void> {
        if (!this.#hasMoreExpensesSignal.value || !this.#expenseCursorSignal.value || !this.currentGroupId) return;

        // Use consolidated endpoint for progressive loading to maintain consistency
        this.#loadingExpensesSignal.value = true;
        try {
            const fullDetails = await apiClient.getGroupFullDetails(this.currentGroupId, {
                expenseCursor: this.#expenseCursorSignal.value,
                expenseLimit: 20,
            });

            batch(() => {
                // Append new expenses to existing ones
                this.#expensesSignal.value = [...this.#expensesSignal.value, ...fullDetails.expenses.expenses];

                // Update pagination state
                this.#hasMoreExpensesSignal.value = fullDetails.expenses.hasMore;
                this.#expenseCursorSignal.value = fullDetails.expenses.nextCursor || null;
            });
        } catch (error) {
            logWarning('Failed to load more expenses', { error });
        } finally {
            this.#loadingExpensesSignal.value = false;
        }
    }

    async loadMoreSettlements(): Promise<void> {
        if (!this.#hasMoreSettlementsSignal.value || !this.#settlementsCursorSignal.value || !this.currentGroupId) return;

        // Use consolidated endpoint for progressive loading to maintain consistency
        this.#loadingSettlementsSignal.value = true;
        try {
            const fullDetails = await apiClient.getGroupFullDetails(this.currentGroupId, {
                settlementCursor: this.#settlementsCursorSignal.value,
                settlementLimit: 20,
            });

            batch(() => {
                // Append new settlements to existing ones
                this.#settlementsSignal.value = [...this.#settlementsSignal.value, ...fullDetails.settlements.settlements];

                // Update pagination state
                this.#hasMoreSettlementsSignal.value = fullDetails.settlements.hasMore;
                this.#settlementsCursorSignal.value = fullDetails.settlements.nextCursor || null;
            });
        } catch (error) {
            logWarning('Failed to load more settlements', { error });
        } finally {
            this.#loadingSettlementsSignal.value = false;
        }
    }

    async refreshAll(): Promise<void> {
        if (!this.currentGroupId) return;

        logInfo('RefreshAll: Starting complete data refresh', { groupId: this.currentGroupId });

        try {
            // Use the consolidated full-details endpoint to ensure atomic data consistency
            // This prevents race conditions where balances might not be calculated yet
            // loadGroup() already calls getGroupFullDetails() which includes ALL data
            await this.loadGroup(this.currentGroupId);

            logInfo('RefreshAll: Complete data refresh successful', { groupId: this.currentGroupId });
        } catch (error) {
            logError('RefreshAll: Failed to refresh all data', { error, groupId: this.currentGroupId });
            throw error;
        }
    }

    dispose(): void {
        // Clean up ONLY legacy listeners (for backward compatibility)
        // Do NOT interfere with reference-counted subscriptions
        if (this.expenseChangeListener) {
            this.expenseChangeListener();
            this.expenseChangeListener = null;
        }
        if (this.groupChangeListener) {
            this.groupChangeListener();
            this.groupChangeListener = null;
        }

        this.changeDetector.dispose();
        
        // Do NOT call permissionsStore.dispose() as it affects other components
        // Each component should use deregisterComponent() instead
    }

    reset(): void {
        this.dispose();

        // Reset all signals
        batch(() => {
            this.#groupSignal.value = null;
            this.#membersSignal.value = [];
            this.#expensesSignal.value = [];
            this.#balancesSignal.value = null;
            this.#settlementsSignal.value = [];
            this.#loadingSignal.value = false;
            this.#loadingMembersSignal.value = false;
            this.#loadingExpensesSignal.value = false;
            this.#loadingBalancesSignal.value = false;
            this.#loadingSettlementsSignal.value = false;
            this.#errorSignal.value = null;
            this.#hasMoreExpensesSignal.value = true;
            this.#expenseCursorSignal.value = null;
            this.#hasMoreSettlementsSignal.value = false;
            this.#settlementsCursorSignal.value = null;
        });

        this.currentGroupId = null;
    }

    async leaveGroup(groupId: string): Promise<{ success: boolean; message: string }> {
        try {
            const response = await apiClient.leaveGroup(groupId);
            return response;
        } catch (error) {
            this.#errorSignal.value = error instanceof Error ? error.message : 'Failed to leave group';
            throw error;
        }
    }

    async removeMember(groupId: string, memberId: string): Promise<{ success: boolean; message: string }> {
        try {
            const response = await apiClient.removeGroupMember(groupId, memberId);
            // Refresh all data after successful removal
            if (response.success) {
                await this.refreshAll();
            }
            return response;
        } catch (error) {
            this.#errorSignal.value = error instanceof Error ? error.message : 'Failed to remove member';
            throw error;
        }
    }

}

// Export singleton instance
export const enhancedGroupDetailStore = new EnhancedGroupDetailStoreImpl();
