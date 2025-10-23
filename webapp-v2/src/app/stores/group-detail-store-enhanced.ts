import { permissionsStore } from '@/stores/permissions-store.ts';
import { logError, logInfo } from '@/utils/browser-logger';
import { UserNotificationDetector, userNotificationDetector } from '@/utils/user-notification-detector';
import { batch, signal } from '@preact/signals';
import { ExpenseDTO, GroupBalances, GroupDTO, GroupId, GroupMember, ListCommentsResponse, SettlementWithMembers } from '@splitifyd/shared';
import { apiClient } from '../apiClient';

const GROUP_EXPENSE_PAGE_SIZE = 8;
const GROUP_SETTLEMENT_PAGE_SIZE = 8;
const GROUP_COMMENT_PAGE_SIZE = 8;

interface EnhancedGroupDetailStore {
    // State accessors (wrap these in useComputed() in components)
    readonly group: GroupDTO | null;
    readonly members: GroupMember[];
    readonly expenses: ExpenseDTO[];
    readonly balances: GroupBalances | null;
    readonly settlements: SettlementWithMembers[];
    readonly commentsResponse: ListCommentsResponse | null;
    readonly loading: boolean;
    readonly loadingMembers: boolean;
    readonly loadingExpenses: boolean;
    readonly loadingSettlements: boolean;
    readonly error: string | null;
    readonly hasMoreExpenses: boolean;
    readonly hasMoreSettlements: boolean;
    readonly showDeletedSettlements: boolean;

    // Methods
    loadGroup(id: string): Promise<void>;

    dispose(): void;

    reset(): void;

    refreshAll(): Promise<void>;

    registerComponent(groupId: GroupId, userId: string): Promise<void>;

    deregisterComponent(groupId: GroupId): void;

    loadMoreExpenses(): Promise<void>;

    loadMoreSettlements(): Promise<void>;

    fetchSettlements(): Promise<void>;

    setDeletingGroup(value: boolean): void;

    setShowDeletedSettlements(value: boolean): void;
}

class EnhancedGroupDetailStoreImpl implements EnhancedGroupDetailStore {
    // Private signals
    readonly #groupSignal = signal<GroupDTO | null>(null);
    readonly #membersSignal = signal<GroupMember[]>([]);
    readonly #expensesSignal = signal<ExpenseDTO[]>([]);
    readonly #balancesSignal = signal<GroupBalances | null>(null);
    readonly #settlementsSignal = signal<SettlementWithMembers[]>([]);
    readonly #commentsResponseSignal = signal<ListCommentsResponse | null>(null);
    readonly #loadingSignal = signal<boolean>(false);
    readonly #loadingMembersSignal = signal<boolean>(false);
    readonly #loadingExpensesSignal = signal<boolean>(false);
    readonly #loadingSettlementsSignal = signal<boolean>(false);
    readonly #errorSignal = signal<string | null>(null);
    readonly #hasMoreExpensesSignal = signal<boolean>(true);
    readonly #hasMoreSettlementsSignal = signal<boolean>(false);
    readonly #isDeletingGroupSignal = signal<boolean>(false);
    readonly #showDeletedSettlementsSignal = signal<boolean>(false);

    // Reference counting infrastructure for multi-group support
    readonly #subscriberCounts = new Map<string, number>();

    // Single detector per user, not per group
    private notificationUnsubscribe: (() => void) | null = null;

    // Current group tracking for core functionality
    private currentGroupId: string | null = null;
    private expenseCursor: string | null = null;
    private settlementCursor: string | null = null;

    constructor(private notificationDetector: UserNotificationDetector) {}

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

    get commentsResponse() {
        return this.#commentsResponseSignal.value;
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

    get showDeletedSettlements() {
        return this.#showDeletedSettlementsSignal.value;
    }

    setDeletingGroup(value: boolean): void {
        this.#isDeletingGroupSignal.value = value;
        // GroupDTO deletion flag changed (routine)
    }

    setShowDeletedSettlements(value: boolean): void {
        this.#showDeletedSettlementsSignal.value = value;
    }

    async loadGroup(groupId: GroupId): Promise<void> {
        this.#loadingSignal.value = true;
        this.#errorSignal.value = null;
        this.currentGroupId = groupId;

        try {
            const fullDetails = await apiClient.getGroupFullDetails(groupId, {
                expenseLimit: GROUP_EXPENSE_PAGE_SIZE,
                includeDeletedSettlements: this.#showDeletedSettlementsSignal.value,
                settlementLimit: GROUP_SETTLEMENT_PAGE_SIZE,
                commentLimit: GROUP_COMMENT_PAGE_SIZE,
            });

            batch(() => {
                this.#groupSignal.value = fullDetails.group;
                this.#membersSignal.value = fullDetails.members.members;
                this.#expensesSignal.value = fullDetails.expenses.expenses;
                this.#balancesSignal.value = fullDetails.balances;
                this.#settlementsSignal.value = fullDetails.settlements.settlements;
                this.#commentsResponseSignal.value = fullDetails.comments;
                this.#hasMoreExpensesSignal.value = fullDetails.expenses.hasMore;
                this.#hasMoreSettlementsSignal.value = fullDetails.settlements.hasMore;
                this.#loadingExpensesSignal.value = false;
                this.#loadingSettlementsSignal.value = false;
                this.#loadingSignal.value = false;
            });

            this.expenseCursor = fullDetails.expenses.nextCursor ?? null;
            this.settlementCursor = fullDetails.settlements.nextCursor ?? null;

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
                logInfo('GroupDTO deleted, clearing state', { groupId: this.currentGroupId });

                this.#errorSignal.value = 'GROUP_DELETED';
                batch(() => {
                    this.#groupSignal.value = null;
                    this.#membersSignal.value = [];
                    this.#expensesSignal.value = [];
                    this.#balancesSignal.value = null;
                    this.#settlementsSignal.value = [];
                    this.#commentsResponseSignal.value = null;
                    this.#loadingSignal.value = false;
                });

                this.currentGroupId = null;
                return;
            }

            if (isAccessDenied) {
                // User has been removed from the group - handle gracefully without error
                logInfo('User removed from group, clearing state', { groupId: this.currentGroupId });

                this.#errorSignal.value = 'GROUP_DELETED';
                batch(() => {
                    this.#groupSignal.value = null;
                    this.#membersSignal.value = [];
                    this.#expensesSignal.value = [];
                    this.#balancesSignal.value = null;
                    this.#settlementsSignal.value = [];
                    this.#commentsResponseSignal.value = null;
                    this.#loadingSignal.value = false;
                });

                this.currentGroupId = null;
                return;
            }

            logError('RefreshAll: Failed to refresh all data', { error, groupId: this.currentGroupId });
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
            this.#commentsResponseSignal.value = null;
            this.#loadingSignal.value = false;
            this.#errorSignal.value = null;
        });

        this.currentGroupId = null;
    }

    // Reference-counted registration - single detector approach
    async registerComponent(groupId: GroupId, userId: string): Promise<void> {
        // Registering component for group (routine)
        const currentCount = this.#subscriberCounts.get(groupId) || 0;
        this.#subscriberCounts.set(groupId, currentCount + 1);

        // Load the group data
        await this.loadGroup(groupId);

        // Set up notification detector if not already running (prevent duplicate subscriptions!)
        if (!this.notificationUnsubscribe) {
            this.notificationUnsubscribe = this.notificationDetector.subscribe({
                onTransactionChange: (changeGroupId) => {
                    if (changeGroupId === this.currentGroupId) {
                        logInfo('Transaction change detected', { groupId: changeGroupId });
                        this.refreshAll().catch((error) => logError('Failed to refresh after transaction change', error));
                    }
                },
                onGroupChange: (changeGroupId) => {
                    if (changeGroupId === this.currentGroupId) {
                        logInfo('GroupDTO change detected', { groupId: changeGroupId });
                        // Refresh all data to pick up changes like settlement lock status after member departure
                        this.refreshAll().catch((error) => logError('Failed to refresh after group change', error));
                    }
                },
                onBalanceChange: (changeGroupId) => {
                    if (changeGroupId === this.currentGroupId) {
                        logInfo('Balance change detected', { groupId: changeGroupId });
                        this.refreshAll().catch((error) => logError('Failed to refresh after balance change', error));
                    }
                },
                onGroupRemoved: (changeGroupId) => {
                    if (changeGroupId === this.currentGroupId) {
                        logInfo('GroupDTO removed - clearing state and setting removal flag', { groupId: changeGroupId });
                        this.#clearGroupData();
                        // Set specific error after clearing data to trigger better UX
                        this.#errorSignal.value = 'USER_REMOVED_FROM_GROUP';
                    }
                },
            });
        }

        // Update permissions store
        permissionsStore.registerComponent(groupId, userId);
    }

    deregisterComponent(groupId: GroupId): void {
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

    async loadMoreExpenses(): Promise<void> {
        if (!this.currentGroupId) {
            return;
        }
        if (!this.#hasMoreExpensesSignal.value || !this.expenseCursor) {
            return;
        }

        this.#loadingExpensesSignal.value = true;

        try {
            const fullDetails = await apiClient.getGroupFullDetails(this.currentGroupId, {
                expenseLimit: GROUP_EXPENSE_PAGE_SIZE,
                expenseCursor: this.expenseCursor,
                includeDeletedSettlements: this.#showDeletedSettlementsSignal.value,
            });

            const nextCursor = fullDetails.expenses.nextCursor ?? null;

            batch(() => {
                this.#expensesSignal.value = [
                    ...this.#expensesSignal.value,
                    ...fullDetails.expenses.expenses,
                ];
                this.#hasMoreExpensesSignal.value = fullDetails.expenses.hasMore;
                this.#loadingExpensesSignal.value = false;
            });

            this.expenseCursor = nextCursor;
        } catch (error: any) {
            this.#loadingExpensesSignal.value = false;
            logError('loadMoreExpenses failed', { error, groupId: this.currentGroupId, cursor: this.expenseCursor });
            throw error;
        }
    }

    async loadMoreSettlements(): Promise<void> {
        if (!this.currentGroupId) {
            return;
        }
        if (!this.#hasMoreSettlementsSignal.value || !this.settlementCursor) {
            return;
        }

        this.#loadingSettlementsSignal.value = true;

        try {
            const fullDetails = await apiClient.getGroupFullDetails(this.currentGroupId, {
                expenseLimit: GROUP_EXPENSE_PAGE_SIZE,
                settlementCursor: this.settlementCursor,
                includeDeletedSettlements: this.#showDeletedSettlementsSignal.value,
                settlementLimit: GROUP_SETTLEMENT_PAGE_SIZE,
            });

            const nextCursor = fullDetails.settlements.nextCursor ?? null;

            batch(() => {
                this.#settlementsSignal.value = [
                    ...this.#settlementsSignal.value,
                    ...fullDetails.settlements.settlements,
                ];
                this.#hasMoreSettlementsSignal.value = fullDetails.settlements.hasMore;
                this.#loadingSettlementsSignal.value = false;
            });

            this.settlementCursor = nextCursor;
        } catch (error: any) {
            this.#loadingSettlementsSignal.value = false;
            logError('loadMoreSettlements failed', { error, groupId: this.currentGroupId, cursor: this.settlementCursor });
            throw error;
        }
    }

    async fetchSettlements(): Promise<void> {
        if (!this.currentGroupId) return;

        this.#loadingSettlementsSignal.value = true;

        try {
            const fullDetails = await apiClient.getGroupFullDetails(this.currentGroupId, {
                expenseLimit: GROUP_EXPENSE_PAGE_SIZE,
                includeDeletedSettlements: this.#showDeletedSettlementsSignal.value,
                settlementLimit: GROUP_SETTLEMENT_PAGE_SIZE,
                commentLimit: GROUP_COMMENT_PAGE_SIZE,
            });

            // Update only settlements (not the whole store)
            batch(() => {
                this.#settlementsSignal.value = fullDetails.settlements.settlements;
                this.#hasMoreSettlementsSignal.value = fullDetails.settlements.hasMore;
                this.#loadingSettlementsSignal.value = false;
            });

            this.settlementCursor = fullDetails.settlements.nextCursor ?? null;
        } catch (error: any) {
            logError('fetchSettlements failed', { error, groupId: this.currentGroupId });
            this.#loadingSettlementsSignal.value = false;
            throw error;
        }
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
        this.expenseCursor = null;
        this.settlementCursor = null;
    }
}

export const enhancedGroupDetailStore = new EnhancedGroupDetailStoreImpl(userNotificationDetector);
