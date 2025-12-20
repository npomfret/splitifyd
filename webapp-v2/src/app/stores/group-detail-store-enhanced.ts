import { GROUP_DETAIL_ERROR_CODES } from '@/constants/error-codes.ts';
import { logError, logWarning } from '@/utils/browser-logger';
import type { ReactionEmoji, SettlementId } from '@billsplit-wl/shared';
import { ExpenseDTO, GroupBalances, GroupDTO, GroupId, GroupMember, ListCommentsResponse, SettlementWithMembers, UserId } from '@billsplit-wl/shared';
import { batch, signal } from '@preact/signals';
import { apiClient } from '../apiClient';
import type { ActivityFeedRealtimeService } from '../services/activity-feed-realtime-service';
import { activityFeedRealtimeService } from '../services/activity-feed-realtime-service';
import { getAuthStore } from './auth-store';
import { GroupDetailCollectionManager } from './helpers/group-detail-collection-manager';
import { GroupDetailRealtimeCoordinator } from './helpers/group-detail-realtime-coordinator';
import { GroupDetailSideEffectsManager } from './helpers/group-detail-side-effects';

const GROUP_EXPENSE_PAGE_SIZE = 8;
const GROUP_SETTLEMENT_PAGE_SIZE = 8;
const GROUP_COMMENT_PAGE_SIZE = 8;

type GroupDetailRefreshReason = 'manual' | 'activity-event' | 'mutation' | 'register-component';

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

    refreshAll(reason: GroupDetailRefreshReason): Promise<void>;

    registerComponent(groupId: GroupId, userId: UserId): Promise<void>;

    deregisterComponent(groupId: GroupId): void;

    loadMoreExpenses(): Promise<void>;

    loadMoreSettlements(): Promise<void>;

    fetchSettlements(): Promise<void>;

    setDeletingGroup(value: boolean): void;

    setShowDeletedSettlements(value: boolean): void;
    setShowDeletedExpenses(value: boolean): void;

    archiveGroup(): Promise<void>;

    unarchiveGroup(): Promise<void>;

    toggleSettlementReaction(settlementId: SettlementId, emoji: ReactionEmoji): Promise<void>;
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

    private readonly activityListenerId = 'group-detail-store';
    private readonly expensesCollection: GroupDetailCollectionManager<ExpenseDTO>;
    private readonly settlementsCollection: GroupDetailCollectionManager<SettlementWithMembers>;
    private readonly realtime: GroupDetailRealtimeCoordinator;
    private readonly sideEffects = new GroupDetailSideEffectsManager();

    private currentGroupId: GroupId | null = null;

    constructor(activityFeed: ActivityFeedRealtimeService = activityFeedRealtimeService, debounceDelay: number = 300) {
        this.expensesCollection = new GroupDetailCollectionManager(
            this.#expensesSignal,
            this.#hasMoreExpensesSignal,
            this.#loadingExpensesSignal,
        );
        this.settlementsCollection = new GroupDetailCollectionManager(
            this.#settlementsSignal,
            this.#hasMoreSettlementsSignal,
            this.#loadingSettlementsSignal,
        );
        this.realtime = new GroupDetailRealtimeCoordinator({
            activityFeed,
            listenerId: this.activityListenerId,
            debounceDelay,
            getCurrentGroupId: () => this.currentGroupId,
            onActivityRefresh: ({ groupId, eventType, eventId }) => this.handleActivityDrivenRefresh(groupId, eventType, eventId),
            onSelfRemoval: ({ groupId, eventId }) => this.handleSelfRemoval(groupId),
        });
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
                this.#balancesSignal.value = fullDetails.balances;
                this.#commentsResponseSignal.value = fullDetails.comments;
                this.expensesCollection.replace(fullDetails.expenses.expenses, {
                    hasMore: fullDetails.expenses.hasMore,
                    nextCursor: fullDetails.expenses.nextCursor ?? null,
                });
                this.settlementsCollection.replace(fullDetails.settlements.settlements, {
                    hasMore: fullDetails.settlements.hasMore,
                    nextCursor: fullDetails.settlements.nextCursor ?? null,
                });
                this.#loadingSignal.value = false;
            });

            this.sideEffects.syncMemberThemes(fullDetails.members.members);
            const authStore = await getAuthStore();
            this.sideEffects.updatePermissionsSnapshot(fullDetails.group, fullDetails.members.members, authStore.user?.emailVerified);
        } catch (error: any) {
            logError('GroupDetailStore.loadGroup.failed', error, { groupId });
            this.#errorSignal.value = error instanceof Error ? error.message : 'Failed to load group';
            this.#loadingSignal.value = false;
            throw error;
        }
    }

    async refreshAll(reason: GroupDetailRefreshReason = 'manual'): Promise<void> {
        if (!this.currentGroupId) {
            logWarning('GroupDetailStore.refreshAll.skipped', {
                reason,
                cause: 'missing-current-group',
            });
            return;
        }

        const targetGroupId = this.currentGroupId;

        try {
            await this.loadGroup(targetGroupId);
        } catch (error: any) {
            const isGroupDeleted = error?.status === 404 || (error?.message && error.message.includes('404')) || error?.code === 'NOT_FOUND';
            const isAccessDenied = error?.status === 403 || error?.code === 'FORBIDDEN';

            if (isGroupDeleted) {
                this.#clearGroupData();
                this.#errorSignal.value = GROUP_DETAIL_ERROR_CODES.USER_REMOVED_FROM_GROUP;
                this.#loadingSignal.value = false;
                this.currentGroupId = null;
                return;
            }

            if (isAccessDenied) {
                this.#clearGroupData();
                this.#errorSignal.value = GROUP_DETAIL_ERROR_CODES.GROUP_DELETED;
                this.#loadingSignal.value = false;
                this.currentGroupId = null;
                return;
            }

            logError('GroupDetailStore.refreshAll.failed', error, {
                groupId: targetGroupId,
                reason,
            });
            throw error;
        }
    }

    async archiveGroup(): Promise<void> {
        if (!this.currentGroupId) return;
        this.#errorSignal.value = null;
        try {
            await apiClient.archiveGroupForUser(this.currentGroupId);
            await this.refreshAll('mutation');
        } catch (error: any) {
            this.#errorSignal.value = error instanceof Error ? error.message : 'Failed to archive group';
            throw error;
        }
    }

    async unarchiveGroup(): Promise<void> {
        if (!this.currentGroupId) return;
        this.#errorSignal.value = null;
        try {
            await apiClient.unarchiveGroupForUser(this.currentGroupId);
            await this.refreshAll('mutation');
        } catch (error: any) {
            this.#errorSignal.value = error instanceof Error ? error.message : 'Failed to unarchive group';
            throw error;
        }
    }

    async toggleSettlementReaction(settlementId: SettlementId, emoji: ReactionEmoji): Promise<void> {
        const authStore = await getAuthStore();
        const currentUserId = authStore.user?.uid;
        if (!currentUserId) {
            logError('Failed to toggle settlement reaction: user not authenticated');
            return;
        }

        try {
            const response = await apiClient.toggleSettlementReaction(settlementId, emoji);

            // Optimistically update the local settlement state
            this.#settlementsSignal.value = this.#settlementsSignal.value.map((settlement) => {
                if (settlement.id !== settlementId) {
                    return settlement;
                }

                const currentUserReactions = settlement.userReactions?.[currentUserId] ?? [];
                const currentCounts = settlement.reactionCounts || {};

                let newUserReactionsArray: ReactionEmoji[];
                let newCounts: typeof currentCounts;

                if (response.action === 'added') {
                    newUserReactionsArray = [...currentUserReactions, emoji];
                    newCounts = { ...currentCounts, [emoji]: (currentCounts[emoji] || 0) + 1 };
                } else {
                    newUserReactionsArray = currentUserReactions.filter((e) => e !== emoji);
                    const newCount = (currentCounts[emoji] || 1) - 1;
                    newCounts = { ...currentCounts };
                    if (newCount > 0) {
                        newCounts[emoji] = newCount;
                    } else {
                        delete newCounts[emoji];
                    }
                }

                const newUserReactionsMap = {
                    ...(settlement.userReactions || {}),
                    [currentUserId]: newUserReactionsArray,
                };

                return { ...settlement, userReactions: newUserReactionsMap, reactionCounts: newCounts };
            });
        } catch (error) {
            logError('Failed to toggle settlement reaction', error);
            throw error;
        }
    }

    dispose(): void {
        this.realtime.disposeIfIdle();
    }

    reset(): void {
        this.realtime.dispose();
        this.#clearGroupData();
        this.#loadingSignal.value = false;
        this.#errorSignal.value = null;
        if (this.currentGroupId) {
            this.sideEffects.deregisterPermissions(this.currentGroupId);
        }
        this.currentGroupId = null;
    }

    // Reference-counted registration - single detector approach
    async registerComponent(groupId: GroupId, userId: UserId): Promise<void> {
        await this.loadGroup(groupId);

        await this.realtime.registerComponent(groupId, userId);

        this.sideEffects.registerPermissions(groupId, userId);
    }

    deregisterComponent(groupId: GroupId): void {
        const remaining = this.realtime.deregisterComponent(groupId);

        if (remaining === 0 && this.currentGroupId === groupId) {
            this.#clearGroupData();
            this.currentGroupId = null;
        }

        this.sideEffects.deregisterPermissions(groupId);
    }

    private handleActivityDrivenRefresh(groupId: GroupId, eventType: string, eventId: string): void {
        this.refreshAll('activity-event').catch((error) =>
            logError('Failed to refresh group detail after activity event', {
                error: error instanceof Error ? error.message : String(error),
                groupId,
                eventType,
                eventId,
            })
        );
    }

    private handleSelfRemoval(groupId: GroupId): void {
        this.#clearGroupData();
        this.sideEffects.deregisterPermissions(groupId);
        this.#errorSignal.value = GROUP_DETAIL_ERROR_CODES.USER_REMOVED_FROM_GROUP;
        this.currentGroupId = null;
    }

    async loadMoreExpenses(): Promise<void> {
        if (!this.currentGroupId) {
            return;
        }
        if (!this.expensesCollection.hasMore || !this.expensesCollection.nextCursor) {
            return;
        }

        const cursor = this.expensesCollection.nextCursor;
        this.expensesCollection.markLoading(true);

        try {
            const fullDetails = await apiClient.getGroupFullDetails(this.currentGroupId, {
                expenseLimit: GROUP_EXPENSE_PAGE_SIZE,
                expenseCursor: cursor,
                includeDeletedExpenses: this.#showDeletedExpensesSignal.value,
                includeDeletedSettlements: this.#showDeletedSettlementsSignal.value,
            });

            this.expensesCollection.append(fullDetails.expenses.expenses, {
                hasMore: fullDetails.expenses.hasMore,
                nextCursor: fullDetails.expenses.nextCursor ?? null,
            });
        } catch (error: any) {
            this.expensesCollection.markLoading(false);
            logError('loadMoreExpenses failed', { error, groupId: this.currentGroupId, cursor });
            throw error;
        }
    }

    async loadMoreSettlements(): Promise<void> {
        if (!this.currentGroupId) {
            return;
        }
        if (!this.settlementsCollection.hasMore || !this.settlementsCollection.nextCursor) {
            return;
        }

        const cursor = this.settlementsCollection.nextCursor;
        this.settlementsCollection.markLoading(true);

        try {
            const fullDetails = await apiClient.getGroupFullDetails(this.currentGroupId, {
                expenseLimit: GROUP_EXPENSE_PAGE_SIZE,
                includeDeletedExpenses: this.#showDeletedExpensesSignal.value,
                settlementCursor: cursor,
                includeDeletedSettlements: this.#showDeletedSettlementsSignal.value,
                settlementLimit: GROUP_SETTLEMENT_PAGE_SIZE,
            });

            this.settlementsCollection.append(fullDetails.settlements.settlements, {
                hasMore: fullDetails.settlements.hasMore,
                nextCursor: fullDetails.settlements.nextCursor ?? null,
            });
        } catch (error: any) {
            this.settlementsCollection.markLoading(false);
            logError('loadMoreSettlements failed', { error, groupId: this.currentGroupId, cursor });
            throw error;
        }
    }

    async fetchSettlements(): Promise<void> {
        if (!this.currentGroupId) return;

        this.settlementsCollection.markLoading(true);

        try {
            const fullDetails = await apiClient.getGroupFullDetails(this.currentGroupId, {
                expenseLimit: GROUP_EXPENSE_PAGE_SIZE,
                includeDeletedExpenses: this.#showDeletedExpensesSignal.value,
                includeDeletedSettlements: this.#showDeletedSettlementsSignal.value,
                settlementLimit: GROUP_SETTLEMENT_PAGE_SIZE,
                commentLimit: GROUP_COMMENT_PAGE_SIZE,
            });

            // Update only settlements (not the whole store)
            this.settlementsCollection.replace(fullDetails.settlements.settlements, {
                hasMore: fullDetails.settlements.hasMore,
                nextCursor: fullDetails.settlements.nextCursor ?? null,
            });
        } catch (error: any) {
            logError('fetchSettlements failed', { error, groupId: this.currentGroupId });
            this.settlementsCollection.markLoading(false);
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
            this.#balancesSignal.value = null;
            this.#commentsResponseSignal.value = null;
            this.#errorSignal.value = null;
            this.#loadingSignal.value = false;
            this.#loadingMembersSignal.value = false;
            this.#isDeletingGroupSignal.value = false; // Clear deletion flag
            this.expensesCollection.reset();
            this.settlementsCollection.reset();
            this.#hasMoreExpensesSignal.value = true; // Back to initial state
            this.#hasMoreSettlementsSignal.value = false;
        });
    }
}

// Export singleton instance with environment-aware debounce delay
// Use 10ms in test environments for fast unit tests, 300ms in production
const debounceDelay = import.meta.env.MODE === 'test' ? 10 : 300;
export const enhancedGroupDetailStore = new EnhancedGroupDetailStoreImpl(activityFeedRealtimeService, debounceDelay);
