import { signal, batch } from '@preact/signals';
import { UserNotificationDetector } from '@/utils/user-notification-detector';
import { logWarning, logError, logInfo } from '@/utils/browser-logger';
import type { ExpenseData, Group, GroupBalances, GroupMemberWithProfile, SettlementListItem } from '@splitifyd/shared';
import { apiClient } from '../apiClient';
import { permissionsStore } from '@/stores/permissions-store.ts';

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
    loadingSettlements: boolean;
    error: string | null;
    hasMoreExpenses: boolean;
    hasMoreSettlements: boolean;

    // Methods
    loadGroup(id: string): Promise<void>;
    subscribeToChanges(userId: string): void;
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
    readonly #groupSignal = signal<Group | null>(null);
    readonly #membersSignal = signal<GroupMemberWithProfile[]>([]);
    readonly #expensesSignal = signal<ExpenseData[]>([]);
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
    readonly #activeSubscriptions = new Map<string, () => void>();
    readonly #notificationDetectors = new Map<string, UserNotificationDetector>();

    // Legacy state for backward compatibility
    private currentGroupId: string | null = null;
    private notificationDetector = new UserNotificationDetector();
    private unsubscribeNotifications: (() => void) | null = null;

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
        logInfo('Group deletion flag changed', { isDeletingGroup: value, currentGroupId: this.currentGroupId });
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

    subscribeToChanges(userId: string): void {
        if (!this.currentGroupId) {
            logWarning('Cannot subscribe to changes - no currentGroupId', { userId });
            return;
        }

        logInfo('Setting up notification subscriptions', {
            groupId: this.currentGroupId,
            userId,
        });

        this.unsubscribeNotifications = this.notificationDetector.subscribe(userId, {
            onTransactionChange: (groupId) => {
                if (groupId !== this.currentGroupId) return;
                logInfo('Transaction change detected', { groupId });
                this.refreshAll().catch((error) => logError('Failed to refresh after transaction change', error));
            },
            onGroupChange: (groupId) => {
                if (groupId !== this.currentGroupId) return;
                
                // Skip refresh if we're in the process of deleting this group
                if (this.#isDeletingGroupSignal.value) {
                    logInfo('Group change detected but skipping refresh - group deletion in progress', { groupId });
                    return;
                }
                
                logInfo('Group change detected', { groupId });
                this.refreshAll().catch((error) => logError('Failed to refresh after group change', error));
            },
            onBalanceChange: (groupId) => {
                if (groupId !== this.currentGroupId) return;
                logInfo('Balance change detected', { groupId });
                this.refreshAll().catch((error) => logError('Failed to refresh after balance change', error));
            },
            onGroupRemoved: (groupId) => {
                if (groupId !== this.currentGroupId) return;
                logInfo('Group removed - clearing state without refresh', { groupId });

                // Clear state immediately without trying to fetch the deleted group
                this.#errorSignal.value = 'GROUP_DELETED';
                batch(() => {
                    this.#groupSignal.value = null;
                    this.#membersSignal.value = [];
                    this.#expensesSignal.value = [];
                    this.#balancesSignal.value = null;
                    this.#settlementsSignal.value = [];
                    this.#loadingSignal.value = false;
                    this.#isDeletingGroupSignal.value = false; // Clear deletion flag
                });
            },
        });
    }

    async refreshAll(): Promise<void> {
        if (!this.currentGroupId) return;

        try {
            await this.loadGroup(this.currentGroupId);
            logInfo('RefreshAll: Complete data refresh successful', { groupId: this.currentGroupId });
        } catch (error: any) {
            const isGroupDeleted = error?.status === 404 || (error?.message && error.message.includes('404')) || error?.code === 'NOT_FOUND';
            const isAccessDenied = error?.status === 403 || error?.code === 'FORBIDDEN';

            if (isGroupDeleted) {
                logInfo('RefreshAll: Group has been deleted, clearing state', {
                    groupId: this.currentGroupId,
                    error: error?.message || String(error),
                });

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
                logInfo('RefreshAll: User no longer has access to group (removed/left), clearing state', {
                    groupId: this.currentGroupId,
                    error: error?.message || String(error),
                });

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

            logError('RefreshAll: Failed to refresh all data', { error, groupId: this.currentGroupId });
            throw error;
        }
    }

    dispose(): void {
        // Legacy API - only clean up legacy subscriptions, not reference-counted ones
        if (this.unsubscribeNotifications) {
            this.unsubscribeNotifications();
            this.unsubscribeNotifications = null;
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

    // Reference-counted registration - proper implementation
    async registerComponent(groupId: string, userId: string): Promise<void> {
        logInfo(`Registering component for group: ${groupId}`);
        const currentCount = this.#subscriberCounts.get(groupId) || 0;
        this.#subscriberCounts.set(groupId, currentCount + 1);

        if (currentCount === 0) {
            // First subscriber for this group - create subscription
            logInfo(`First component for ${groupId}, loading group and creating subscription`);
            await this.loadGroup(groupId);
            this.#subscribeToGroupChanges(groupId, userId);
        } else {
            // Additional subscriber - just ensure we have the data
            if (this.currentGroupId !== groupId) {
                // Switch to this group if it's different from the currently loaded one
                await this.loadGroup(groupId);
            }
        }

        // Update permissions store
        permissionsStore.registerComponent(groupId, userId);
    }

    deregisterComponent(groupId: string): void {
        logInfo(`Deregistering component for group: ${groupId}`);
        const currentCount = this.#subscriberCounts.get(groupId) || 0;

        if (currentCount <= 1) {
            logInfo(`Last component for ${groupId}, disposing subscription`);
            this.#subscriberCounts.delete(groupId);
            
            // Clean up subscription for this specific group
            const unsubscribe = this.#activeSubscriptions.get(groupId);
            if (unsubscribe) {
                unsubscribe();
                this.#activeSubscriptions.delete(groupId);
            }

            // Clean up notification detector
            const detector = this.#notificationDetectors.get(groupId);
            if (detector) {
                detector.dispose();
                this.#notificationDetectors.delete(groupId);
            }

            // If this was the current group, clear the state
            if (this.currentGroupId === groupId) {
                this.#clearGroupData();
                this.currentGroupId = null;
            }
        } else {
            this.#subscriberCounts.set(groupId, currentCount - 1);
        }

        // Update permissions store
        permissionsStore.deregisterComponent(groupId);
    }

    // Pagination methods (simplified - just stubs for now)
    async loadMoreExpenses(): Promise<void> {
        logInfo('loadMoreExpenses: Not implemented in minimal version');
    }

    async loadMoreSettlements(): Promise<void> {
        logInfo('loadMoreSettlements: Not implemented in minimal version');
    }

    async fetchSettlements(cursor?: string, userId?: string): Promise<void> {
        logInfo('fetchSettlements: Not implemented in minimal version');
    }

    // Private helper methods for reference counting

    /**
     * Create subscription for a specific group with reference counting
     */
    #subscribeToGroupChanges(groupId: string, userId: string): void {
        logInfo('Setting up notification subscriptions for reference-counted group', {
            groupId,
            userId,
        });

        const detector = new UserNotificationDetector();
        this.#notificationDetectors.set(groupId, detector);

        const unsubscribe = detector.subscribe(userId, {
            onTransactionChange: (changeGroupId) => {
                if (changeGroupId !== groupId) return;
                logInfo('Transaction change detected for reference-counted group', { groupId: changeGroupId });
                this.refreshAll().catch((error) => logError('Failed to refresh after transaction change', error));
            },
            onGroupChange: (changeGroupId) => {
                if (changeGroupId !== groupId) return;
                
                // Skip refresh if we're in the process of deleting this group
                if (this.#isDeletingGroupSignal.value) {
                    logInfo('Group change detected but skipping refresh - group deletion in progress (reference-counted)', { groupId: changeGroupId });
                    return;
                }
                
                logInfo('Group change detected for reference-counted group', { groupId: changeGroupId });
                this.refreshAll().catch((error) => logError('Failed to refresh after group change', error));
            },
            onBalanceChange: (changeGroupId) => {
                if (changeGroupId !== groupId) return;
                logInfo('Balance change detected for reference-counted group', { groupId: changeGroupId });
                this.refreshAll().catch((error) => logError('Failed to refresh after balance change', error));
            },
            onGroupRemoved: (changeGroupId) => {
                if (changeGroupId !== groupId) return;
                logInfo('Group removed - clearing state for reference-counted group', { groupId: changeGroupId });
                this.#clearGroupData();
            },
        });

        this.#activeSubscriptions.set(groupId, unsubscribe);
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

export const enhancedGroupDetailStore = new EnhancedGroupDetailStoreImpl();
