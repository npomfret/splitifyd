import { GROUP_DETAIL_ERROR_CODES } from '@/constants/error-codes.ts';
import { permissionsStore } from '@/stores/permissions-store.ts';
import { logError, logInfo } from '@/utils/browser-logger';
import { batch, signal } from '@preact/signals';
import { ActivityFeedItem, ExpenseDTO, GroupBalances, GroupDTO, GroupId, GroupMember, ListCommentsResponse, SettlementWithMembers } from '@splitifyd/shared';
import { apiClient } from '../apiClient';
import type { ActivityFeedStore } from './activity-feed-store';
import { activityFeedStore } from './activity-feed-store';

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
    readonly showDeletedExpenses: boolean;

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
    setShowDeletedExpenses(value: boolean): void;

    archiveGroup(): Promise<void>;

    unarchiveGroup(): Promise<void>;
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
    readonly #showDeletedExpensesSignal = signal<boolean>(false);

    // Reference counting infrastructure for multi-group support
    readonly #subscriberCounts = new Map<string, number>();

    private readonly activityFeed: ActivityFeedStore;
    private readonly activityListenerId = 'group-detail-store';
    private activityListenerRegistered = false;
    private currentUserId: string | null = null;

    // Current group tracking for core functionality
    private currentGroupId: string | null = null;
    private expenseCursor: string | null = null;
    private settlementCursor: string | null = null;

    constructor(activityFeed: ActivityFeedStore = activityFeedStore) {
        this.activityFeed = activityFeed;
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

    get showDeletedExpenses() {
        return this.#showDeletedExpensesSignal.value;
    }

    setDeletingGroup(value: boolean): void {
        this.#isDeletingGroupSignal.value = value;
        // GroupDTO deletion flag changed (routine)
    }

    setShowDeletedSettlements(value: boolean): void {
        this.#showDeletedSettlementsSignal.value = value;
    }

    setShowDeletedExpenses(value: boolean): void {
        this.#showDeletedExpensesSignal.value = value;
    }

    async loadGroup(groupId: GroupId): Promise<void> {
        this.#loadingSignal.value = true;
        this.#errorSignal.value = null;
        this.currentGroupId = groupId;

        try {
            const fullDetails = await apiClient.getGroupFullDetails(groupId, {
                expenseLimit: GROUP_EXPENSE_PAGE_SIZE,
                includeDeletedExpenses: this.#showDeletedExpensesSignal.value,
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

                this.#errorSignal.value = GROUP_DETAIL_ERROR_CODES.GROUP_DELETED;
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

                this.#errorSignal.value = GROUP_DETAIL_ERROR_CODES.GROUP_DELETED;
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

    async archiveGroup(): Promise<void> {
        if (!this.currentGroupId) return;
        this.#errorSignal.value = null;
        try {
            await apiClient.archiveGroup(this.currentGroupId);
            await this.refreshAll();
        } catch (error: any) {
            this.#errorSignal.value = error instanceof Error ? error.message : 'Failed to archive group';
            throw error;
        }
    }

    async unarchiveGroup(): Promise<void> {
        if (!this.currentGroupId) return;
        this.#errorSignal.value = null;
        try {
            await apiClient.unarchiveGroup(this.currentGroupId);
            await this.refreshAll();
        } catch (error: any) {
            this.#errorSignal.value = error instanceof Error ? error.message : 'Failed to unarchive group';
            throw error;
        }
    }

    dispose(): void {
        this.disposeSubscription();
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
        const currentCount = this.#subscriberCounts.get(groupId) || 0;
        this.#subscriberCounts.set(groupId, currentCount + 1);

        await this.loadGroup(groupId);

        const shouldRegisterListener = !this.activityListenerRegistered || this.currentUserId !== userId;
        if (shouldRegisterListener) {
            this.currentUserId = userId;
            try {
                await this.activityFeed.registerListener(this.activityListenerId, userId, this.handleActivityEvent);
                this.activityListenerRegistered = true;
            } catch (error) {
                logError('Failed to register activity feed listener for group detail store', {
                    error: error instanceof Error ? error.message : String(error),
                    groupId,
                    userId,
                });
            }
        }

        permissionsStore.registerComponent(groupId, userId);
    }

    deregisterComponent(groupId: GroupId): void {
        const currentCount = this.#subscriberCounts.get(groupId) || 0;

        if (currentCount <= 1) {
            this.#subscriberCounts.delete(groupId);

            if (this.currentGroupId === groupId) {
                this.#clearGroupData();
                this.currentGroupId = null;
            }

            if (this.#subscriberCounts.size === 0) {
                this.disposeSubscription();
            }
        } else {
            this.#subscriberCounts.set(groupId, currentCount - 1);
        }

        permissionsStore.deregisterComponent(groupId);
    }

    private handleActivityEvent = (event: ActivityFeedItem): void => {
        const { groupId, eventType, details } = event;

        if (!groupId || !this.#subscriberCounts.has(groupId)) {
            return;
        }

        if (this.currentGroupId !== groupId) {
            return;
        }

        if (eventType === 'member-left' && details?.targetUserId && details.targetUserId === this.currentUserId) {
            logInfo('Current user removed from group via activity feed', {
                groupId,
                eventId: event.id,
            });
            this.#clearGroupData();
            this.#errorSignal.value = GROUP_DETAIL_ERROR_CODES.USER_REMOVED_FROM_GROUP;
            this.currentGroupId = null;
            return;
        }

        const shouldRefresh = (() => {
            switch (eventType) {
                case 'expense-created':
                case 'expense-updated':
                case 'expense-deleted':
                case 'settlement-created':
                case 'settlement-updated':
                case 'member-joined':
                case 'member-left':
                case 'comment-added':
                    return true;
                default:
                    return true;
            }
        })();

        if (shouldRefresh) {
            this.refreshAll().catch((error) =>
                logError('Failed to refresh group detail after activity event', {
                    error: error instanceof Error ? error.message : String(error),
                    groupId,
                    eventType,
                    eventId: event.id,
                })
            );
        }
    };

    private disposeSubscription(): void {
        if (this.activityListenerRegistered) {
            this.activityFeed.deregisterListener(this.activityListenerId);
            this.activityListenerRegistered = false;
            this.currentUserId = null;
        }
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
                includeDeletedExpenses: this.#showDeletedExpensesSignal.value,
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
                includeDeletedExpenses: this.#showDeletedExpensesSignal.value,
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
                includeDeletedExpenses: this.#showDeletedExpensesSignal.value,
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

export const enhancedGroupDetailStore = new EnhancedGroupDetailStoreImpl(activityFeedStore);
