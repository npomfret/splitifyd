import {signal, batch} from '@preact/signals';
import {userNotificationDetector, UserNotificationDetector} from '@/utils/user-notification-detector';
import {logError, logInfo} from '@/utils/browser-logger';
import {ExpenseDTO, GroupDTO, GroupBalances, GroupMemberDTO, SettlementListItem} from '@splitifyd/shared';
import {apiClient} from '../apiClient';
import {permissionsStore} from '@/stores/permissions-store.ts';

interface EnhancedGroupDetailStore {
    // State
    group: GroupDTO | null;
    members: GroupMemberDTO[];
    expenses: ExpenseDTO[];
    balances: GroupBalances | null;
    settlements: SettlementListItem[];
    loading: boolean;
    loadingMembers: boolean;
    loadingExpenses: boolean;
    loadingSettlements: boolean;
    error: string | null;
    hasMoreExpenses: boolean;
    hasMoreSettlements: boolean;

    // Methods
    loadGroup(id: string): Promise<void>;

    dispose(): void;

    reset(): void;

    refreshAll(): Promise<void>;

    registerComponent(groupId: string, userId: string): Promise<void>;

    deregisterComponent(groupId: string): void;

    loadMoreExpenses(): Promise<void>;

    loadMoreSettlements(): Promise<void>;

    fetchSettlements(cursor?: string, userId?: string): Promise<void>;

    setDeletingGroup(value: boolean): void;
}

class EnhancedGroupDetailStoreImpl implements EnhancedGroupDetailStore {
    // Private signals
    readonly #groupSignal = signal<GroupDTO | null>(null);
    readonly #membersSignal = signal<GroupMemberDTO[]>([]);
    readonly #expensesSignal = signal<ExpenseDTO[]>([]);
    readonly #balancesSignal = signal<GroupBalances | null>(null);
    readonly #settlementsSignal = signal<SettlementListItem[]>([]);
    readonly #loadingSignal = signal<boolean>(false);
    readonly #loadingMembersSignal = signal<boolean>(false);
    readonly #loadingExpensesSignal = signal<boolean>(false);
    readonly #loadingSettlementsSignal = signal<boolean>(false);
    readonly #errorSignal = signal<string | null>(null);
    readonly #hasMoreExpensesSignal = signal<boolean>(true);
    readonly #hasMoreSettlementsSignal = signal<boolean>(false);
    readonly #isDeletingGroupSignal = signal<boolean>(false);

    // Reference counting infrastructure for multi-group support
    readonly #subscriberCounts = new Map<string, number>();

    // Single detector per user, not per group
    private notificationUnsubscribe: (() => void) | null = null;

    // Current group tracking for core functionality
    private currentGroupId: string | null = null;

    constructor(private notificationDetector: UserNotificationDetector) {
    }

// State getters
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

    get settlements() {
        return this.#settlementsSignal.value;
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

    get loadingSettlements() {
        return this.#loadingSettlementsSignal.value;
    }

    get error() {
        return this.#errorSignal.value;
    }

    get hasMoreExpenses() {
        return this.#hasMoreExpensesSignal.value;
    }

    get hasMoreSettlements() {
        return this.#hasMoreSettlementsSignal.value;
    }

    setDeletingGroup(value: boolean): void {
        this.#isDeletingGroupSignal.value = value;
        // GroupDTO deletion flag changed (routine)
    }

    async loadGroup(groupId: string): Promise<void> {
        this.#loadingSignal.value = true;
        this.#errorSignal.value = null;
        this.currentGroupId = groupId;

        try {
            const fullDetails = await apiClient.getGroupFullDetails(groupId);

            batch(() => {
                this.#groupSignal.value = fullDetails.group;
                this.#membersSignal.value = fullDetails.members.members;
                this.#expensesSignal.value = fullDetails.expenses.expenses;
                this.#balancesSignal.value = fullDetails.balances;
                this.#settlementsSignal.value = fullDetails.settlements.settlements;
                this.#loadingSignal.value = false;
            });

            permissionsStore.updateGroupData(fullDetails.group, fullDetails.members.members);
        } catch (error: any) {
            this.#errorSignal.value = error instanceof Error ? error.message : 'Failed to load group';
            this.#loadingSignal.value = false;
            throw error;
        }
    }

    async refreshAll(): Promise<void> {
        if (!this.currentGroupId) return;

        try {
            await this.loadGroup(this.currentGroupId);
            // Data refresh successful (routine operation)
        } catch (error: any) {
            const isGroupDeleted = error?.status === 404 || (error?.message && error.message.includes('404')) || error?.code === 'NOT_FOUND';
            const isAccessDenied = error?.status === 403 || error?.code === 'FORBIDDEN';

            if (isGroupDeleted) {
                logInfo('GroupDTO deleted, clearing state', {groupId: this.currentGroupId});

                this.#errorSignal.value = 'GROUP_DELETED';
                batch(() => {
                    this.#groupSignal.value = null;
                    this.#membersSignal.value = [];
                    this.#expensesSignal.value = [];
                    this.#balancesSignal.value = null;
                    this.#settlementsSignal.value = [];
                    this.#loadingSignal.value = false;
                });

                this.currentGroupId = null;
                return;
            }

            if (isAccessDenied) {
                // User has been removed from the group - handle gracefully without error
                logInfo('User removed from group, clearing state', {groupId: this.currentGroupId});

                this.#errorSignal.value = 'GROUP_DELETED';
                batch(() => {
                    this.#groupSignal.value = null;
                    this.#membersSignal.value = [];
                    this.#expensesSignal.value = [];
                    this.#balancesSignal.value = null;
                    this.#settlementsSignal.value = [];
                    this.#loadingSignal.value = false;
                });

                this.currentGroupId = null;
                return;
            }

            logError('RefreshAll: Failed to refresh all data', {error, groupId: this.currentGroupId});
            throw error;
        }
    }

    dispose(): void {
        // Clean up notification detector
        if (this.notificationUnsubscribe) {
            this.notificationUnsubscribe();
            this.notificationUnsubscribe = null;
        }

        // Note: We do NOT clear #subscriberCounts or call permissionsStore.dispose()
        // to avoid breaking other components that might be using the reference-counted API
    }

    reset(): void {
        this.dispose();

        batch(() => {
            this.#groupSignal.value = null;
            this.#membersSignal.value = [];
            this.#expensesSignal.value = [];
            this.#balancesSignal.value = null;
            this.#settlementsSignal.value = [];
            this.#loadingSignal.value = false;
            this.#errorSignal.value = null;
        });

        this.currentGroupId = null;
    }

    // Reference-counted registration - single detector approach
    async registerComponent(groupId: string, userId: string): Promise<void> {
        // Registering component for group (routine)
        const currentCount = this.#subscriberCounts.get(groupId) || 0;
        this.#subscriberCounts.set(groupId, currentCount + 1);

        // Load the group data
        await this.loadGroup(groupId);

        // Set up notification detector if not already running
        this.notificationUnsubscribe = this.notificationDetector.subscribe({
            onTransactionChange: (changeGroupId) => {
                if (changeGroupId === this.currentGroupId) {
                    logInfo('Transaction change detected', {groupId: changeGroupId});
                    this.refreshAll().catch((error) => logError('Failed to refresh after transaction change', error));
                }
            },
            onGroupChange: (changeGroupId) => {
                if (changeGroupId === this.currentGroupId) {
                    logInfo('GroupDTO change detected', {groupId: changeGroupId});
                    this.refreshAll().catch((error) => logError('Failed to refresh after group change', error));
                }
            },
            onBalanceChange: (changeGroupId) => {
                if (changeGroupId === this.currentGroupId) {
                    logInfo('Balance change detected', {groupId: changeGroupId});
                    this.refreshAll().catch((error) => logError('Failed to refresh after balance change', error));
                }
            },
            onGroupRemoved: (changeGroupId) => {
                if (changeGroupId === this.currentGroupId) {
                    logInfo('GroupDTO removed - clearing state and setting removal flag', {groupId: changeGroupId});
                    this.#clearGroupData();
                    // Set specific error after clearing data to trigger better UX
                    this.#errorSignal.value = 'USER_REMOVED_FROM_GROUP';
                }
            },
        });

        // Update permissions store
        permissionsStore.registerComponent(groupId, userId);
    }

    deregisterComponent(groupId: string): void {
        // Deregistering component for group (routine)
        const currentCount = this.#subscriberCounts.get(groupId) || 0;

        if (currentCount <= 1) {
            // Last component for group - cleanup required
            this.#subscriberCounts.delete(groupId);

            // If this was the current group, clear the state
            if (this.currentGroupId === groupId) {
                this.#clearGroupData();
                this.currentGroupId = null;
            }

            // If no more groups being tracked, dispose detector
            if (this.#subscriberCounts.size === 0) {
                // No more groups being tracked, disposing detector
                if (this.notificationUnsubscribe) {
                    this.notificationUnsubscribe();
                    this.notificationUnsubscribe = null;
                }
            }
        } else {
            this.#subscriberCounts.set(groupId, currentCount - 1);
        }

        // Update permissions store
        permissionsStore.deregisterComponent(groupId);
    }

    // Pagination methods (simplified - just stubs for now)
    async loadMoreExpenses(): Promise<void> {
        // Not implemented in minimal version
    }

    async loadMoreSettlements(): Promise<void> {
        // Not implemented in minimal version
    }

    async fetchSettlements(cursor?: string, userId?: string): Promise<void> {
        // Not implemented in minimal version
    }

    /**
     * Clear group data (for when group is removed or switching groups)
     */
    #clearGroupData(): void {
        batch(() => {
            this.#groupSignal.value = null;
            this.#membersSignal.value = [];
            this.#expensesSignal.value = [];
            this.#balancesSignal.value = null;
            this.#settlementsSignal.value = [];
            this.#errorSignal.value = null;
            this.#loadingSignal.value = false;
            this.#loadingMembersSignal.value = false;
            this.#loadingExpensesSignal.value = false;
            this.#loadingSettlementsSignal.value = false;
            this.#hasMoreExpensesSignal.value = true;
            this.#hasMoreSettlementsSignal.value = false;
            this.#isDeletingGroupSignal.value = false; // Clear deletion flag
        });
    }
}

export const enhancedGroupDetailStore = new EnhancedGroupDetailStoreImpl(userNotificationDetector);
