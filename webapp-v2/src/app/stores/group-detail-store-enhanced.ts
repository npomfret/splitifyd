import { signal, batch } from '@preact/signals';
import { UserNotificationDetector } from '@/utils/user-notification-detector';
import { logApiResponse, logWarning, logError, logInfo } from '@/utils/browser-logger';
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

    // State
    private currentGroupId: string | null = null;
    private notificationDetector = new UserNotificationDetector();
    private unsubscribeNotifications: (() => void) | null = null;

    // State getters
    get group() { return this.#groupSignal.value; }
    get members() { return this.#membersSignal.value; }
    get expenses() { return this.#expensesSignal.value; }
    get balances() { return this.#balancesSignal.value; }
    get settlements() { return this.#settlementsSignal.value; }
    get loading() { return this.#loadingSignal.value; }
    get loadingMembers() { return this.#loadingMembersSignal.value; }
    get loadingExpenses() { return this.#loadingExpensesSignal.value; }
    get loadingSettlements() { return this.#loadingSettlementsSignal.value; }
    get error() { return this.#errorSignal.value; }
    get hasMoreExpenses() { return this.#hasMoreExpensesSignal.value; }
    get hasMoreSettlements() { return this.#hasMoreSettlementsSignal.value; }

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

        logInfo('Setting up notification subscriptions', {
            groupId: this.currentGroupId,
            userId,
        });

        this.unsubscribeNotifications = this.notificationDetector.subscribe(userId, {
            onTransactionChange: (groupId) => {
                if (groupId !== this.currentGroupId) return;
                logInfo('Transaction change detected', { groupId });
                this.refreshAll().catch(error => 
                    logError('Failed to refresh after transaction change', error)
                );
            },
            onGroupChange: (groupId) => {
                if (groupId !== this.currentGroupId) return;
                logInfo('Group change detected', { groupId });
                this.refreshAll().catch(error => 
                    logError('Failed to refresh after group change', error)
                );
            },
            onBalanceChange: (groupId) => {
                if (groupId !== this.currentGroupId) return;
                logInfo('Balance change detected', { groupId });
                this.refreshAll().catch(error => 
                    logError('Failed to refresh after balance change', error)
                );
            }
        });
    }

    async refreshAll(): Promise<void> {
        if (!this.currentGroupId) return;
        
        try {
            await this.loadGroup(this.currentGroupId);
            logInfo('RefreshAll: Complete data refresh successful', { groupId: this.currentGroupId });
        } catch (error: any) {
            const isGroupDeleted = 
                error?.status === 404 || 
                (error?.message && error.message.includes('404')) ||
                (error?.code === 'NOT_FOUND');
                
            if (isGroupDeleted) {
                logInfo('RefreshAll: Group has been deleted, clearing state', { 
                    groupId: this.currentGroupId,
                    error: error?.message || String(error)
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
        if (this.unsubscribeNotifications) {
            this.unsubscribeNotifications();
            this.unsubscribeNotifications = null;
        }
        this.notificationDetector.dispose();
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

    // Reference-counted registration (simplified)
    async registerComponent(groupId: string, userId: string): Promise<void> {
        await this.loadGroup(groupId);
        this.subscribeToChanges(userId);
    }

    deregisterComponent(groupId: string): void {
        this.dispose();
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
}

export const enhancedGroupDetailStore = new EnhancedGroupDetailStoreImpl();