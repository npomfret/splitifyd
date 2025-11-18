import { logInfo } from '@/utils/browser-logger.ts';
import { streamingMetrics } from '@/utils/streaming-metrics';
import { batch, ReadonlySignal, signal } from '@preact/signals';
import { CreateGroupRequest, GroupDTO, MemberStatus, MemberStatuses } from '@billsplit-wl/shared';
import type { GroupId, GroupName, UserId } from '@billsplit-wl/shared';
import { apiClient } from '../apiClient';
import type { ActivityFeedRealtimeService } from '../services/activity-feed-realtime-service';
import { activityFeedRealtimeService } from '../services/activity-feed-realtime-service';
import { GroupsErrorManager } from './helpers/groups-error-manager';
import { GroupsPaginationController } from './helpers/groups-pagination-controller';
import { GroupsRealtimeCoordinator } from './helpers/groups-realtime-coordinator';

interface EnhancedGroupsStore {
    groups: GroupDTO[];
    loading: boolean;
    error: string | null;
    initialized: boolean;
    isRefreshing: boolean;
    lastRefresh: number;
    updatingGroupIds: Set<string>;
    isCreatingGroup: boolean;
    currentPage: number;
    hasMore: boolean;
    pageSize: number;
    showArchived: boolean;

    // Readonly signal accessors for reactive components
    readonly groupsSignal: ReadonlySignal<GroupDTO[]>;
    readonly loadingSignal: ReadonlySignal<boolean>;
    readonly errorSignal: ReadonlySignal<string | null>;
    readonly initializedSignal: ReadonlySignal<boolean>;
    readonly isRefreshingSignal: ReadonlySignal<boolean>;
    readonly lastRefreshSignal: ReadonlySignal<number>;
    readonly updatingGroupIdsSignal: ReadonlySignal<Set<string>>;
    readonly isCreatingGroupSignal: ReadonlySignal<boolean>;
    readonly currentPageSignal: ReadonlySignal<number>;
    readonly hasMoreSignal: ReadonlySignal<boolean>;
    readonly pageSizeSignal: ReadonlySignal<number>;
    readonly showArchivedSignal: ReadonlySignal<boolean>;

    fetchGroups(limit?: number, cursor?: string): Promise<void>;
    loadNextPage(): Promise<void>;
    loadPreviousPage(): Promise<void>;
    setPageSize(size: number): Promise<void>;
    createGroup(data: CreateGroupRequest): Promise<GroupDTO>;
    updateGroup(id: string, updates: Partial<GroupDTO>): Promise<void>;
    archiveGroup(groupId: GroupId): Promise<void>;
    unarchiveGroup(groupId: GroupId): Promise<void>;
    refreshGroups(): Promise<void>;
    setShowArchived(showArchived: boolean): Promise<void>;
    toggleShowArchived(): Promise<void>;
    clearError(): void;
    clearValidationError(): void;
    reset(): void;
    registerComponent(componentId: string, userId: UserId): void;
    deregisterComponent(componentId: string): void;
    // Legacy API - kept for backward compatibility
    subscribeToChanges(userId: UserId): void;
    dispose(): void;
}

class EnhancedGroupsStoreImpl implements EnhancedGroupsStore {
    // Private signals - encapsulated within the class
    readonly #groupsSignal = signal<GroupDTO[]>([]);
    readonly #loadingSignal = signal<boolean>(false);
    readonly #initializedSignal = signal<boolean>(false);
    readonly #isRefreshingSignal = signal<boolean>(false);
    readonly #lastRefreshSignal = signal<number>(0);
    readonly #updatingGroupIdsSignal = signal<Set<string>>(new Set());
    readonly #isCreatingGroupSignal = signal<boolean>(false);
    readonly #currentPageSignal = signal<number>(1);
    readonly #hasMoreSignal = signal<boolean>(false);
    readonly #pageSizeSignal = signal<number>(8);
    readonly #showArchivedSignal = signal<boolean>(false);

    private readonly activityListenerId = 'groups-store';
    private readonly pagination: GroupsPaginationController;
    private readonly errorManager = new GroupsErrorManager();
    private readonly realtime: GroupsRealtimeCoordinator;

    constructor(activityFeed: ActivityFeedRealtimeService = activityFeedRealtimeService, debounceDelay: number = 300) {
        this.pagination = new GroupsPaginationController(this.#currentPageSignal, this.#hasMoreSignal, this.#pageSizeSignal);
        this.realtime = new GroupsRealtimeCoordinator({
            activityFeed,
            listenerId: this.activityListenerId,
            debounceDelay,
            isRefreshingSignal: this.#isRefreshingSignal,
            onRefresh: () => this.fetchGroups(),
            onGroupRemoval: this.handleGroupRemoval,
        });
    }

    // State getters - readonly values for external consumers
    get groups() {
        return this.#groupsSignal.value;
    }
    get loading() {
        return this.#loadingSignal.value;
    }
    get error() {
        return this.errorManager.combinedError;
    }
    get initialized() {
        return this.#initializedSignal.value;
    }
    get isRefreshing() {
        return this.#isRefreshingSignal.value;
    }
    get lastRefresh() {
        return this.#lastRefreshSignal.value;
    }
    get updatingGroupIds() {
        return this.#updatingGroupIdsSignal.value;
    }
    get isCreatingGroup() {
        return this.#isCreatingGroupSignal.value;
    }
    get currentPage() {
        return this.#currentPageSignal.value;
    }
    get hasMore() {
        return this.#hasMoreSignal.value;
    }
    get pageSize() {
        return this.#pageSizeSignal.value;
    }
    get showArchived() {
        return this.#showArchivedSignal.value;
    }

    // Signal accessors for reactive components - return readonly signals
    get groupsSignal(): ReadonlySignal<GroupDTO[]> {
        return this.#groupsSignal;
    }
    get loadingSignal(): ReadonlySignal<boolean> {
        return this.#loadingSignal;
    }
    get errorSignal(): ReadonlySignal<string | null> {
        return this.errorManager.errorSignal;
    }
    get initializedSignal(): ReadonlySignal<boolean> {
        return this.#initializedSignal;
    }
    get isRefreshingSignal(): ReadonlySignal<boolean> {
        return this.#isRefreshingSignal;
    }
    get lastRefreshSignal(): ReadonlySignal<number> {
        return this.#lastRefreshSignal;
    }
    get updatingGroupIdsSignal(): ReadonlySignal<Set<string>> {
        return this.#updatingGroupIdsSignal;
    }
    get isCreatingGroupSignal(): ReadonlySignal<boolean> {
        return this.#isCreatingGroupSignal;
    }
    get currentPageSignal(): ReadonlySignal<number> {
        return this.#currentPageSignal;
    }
    get hasMoreSignal(): ReadonlySignal<boolean> {
        return this.#hasMoreSignal;
    }
    get pageSizeSignal(): ReadonlySignal<number> {
        return this.#pageSizeSignal;
    }
    get showArchivedSignal(): ReadonlySignal<boolean> {
        return this.#showArchivedSignal;
    }

    async fetchGroups(limit?: number, cursor?: string): Promise<void> {
        this.#loadingSignal.value = true;
        this.errorManager.clearNetworkError(); // Only clear network errors, not validation errors

        const startTime = Date.now();
        const pageSize = limit ?? this.pagination.pageSize;

        try {
            // Include metadata to get change information and pagination params
            const response = await apiClient.listGroups({
                includeMetadata: true,
                limit: pageSize,
                cursor,
                statusFilter: this.resolveStatusFilter(),
            });

            // Track REST refresh metrics
            const latency = Date.now() - startTime;
            streamingMetrics.trackRestRefresh(latency);

            // Log each group ID for debugging
            logInfo('fetchGroups: Groups received from server', {
                groupIds: response.groups.map((g) => g.id),
                groupCount: response.groups.length,
                groups: response.groups.map((g) => ({ id: g.id, name: g.name })),
                hasMore: response.hasMore,
                cursor,
                nextCursor: response.nextCursor,
            });

            // Update pagination state
            this.#groupsSignal.value = response.groups;
            this.pagination.applyResult({
                hasMore: response.hasMore,
                nextCursor: response.nextCursor ?? null,
            });
            this.#lastRefreshSignal.value = response.metadata?.serverTime || Date.now();
            this.#initializedSignal.value = true;
        } catch (error: any) {
            // Handle 404 or empty response gracefully - this might mean all groups were deleted
            if (error?.status === 404 || error?.message?.includes('404')) {
                logInfo('fetchGroups: No groups found (404), clearing list', { error: error?.message });
                this.#groupsSignal.value = [];
                this.pagination.applyResult({
                    hasMore: false,
                    nextCursor: null,
                });
                this.#lastRefreshSignal.value = Date.now();
                this.#initializedSignal.value = true;
            } else {
                this.errorManager.setNetworkError(this.errorManager.getErrorMessage(error));
                throw error;
            }
        } finally {
            this.#loadingSignal.value = false;
        }
    }

    async loadNextPage(): Promise<void> {
        if (!this.pagination.canLoadNext()) {
            logInfo('loadNextPage: No more pages available');
            return;
        }

        const cursor = this.pagination.prepareNextPageCursor();
        if (!cursor) {
            logInfo('loadNextPage: Next page cursor missing');
            return;
        }

        await this.fetchGroups(this.pagination.pageSize, cursor);
    }

    async loadPreviousPage(): Promise<void> {
        if (!this.pagination.canLoadPrevious()) {
            logInfo('loadPreviousPage: Already on first page');
            return;
        }

        const cursor = this.pagination.preparePreviousPageCursor();
        await this.fetchGroups(this.pagination.pageSize, cursor);
    }

    async setPageSize(size: number): Promise<void> {
        this.pagination.setPageSize(size);
        await this.fetchGroups(size);
    }

    async createGroup(data: CreateGroupRequest): Promise<GroupDTO> {
        this.#isCreatingGroupSignal.value = true;
        // Clear both error types when starting a new operation
        this.errorManager.clearAll();

        try {
            const newGroup = await apiClient.createGroup(data);

            // Reset to first page and fetch fresh data from server to ensure consistency
            const pageSize = this.pagination.pageSize;
            this.pagination.reset();
            await this.fetchGroups(pageSize);

            return newGroup;
        } catch (error) {
            // Categorize errors: validation (400s) vs network/server errors
            this.errorManager.handleApiError(error);
            throw error;
        } finally {
            this.#isCreatingGroupSignal.value = false;
        }
    }

    async updateGroup(id: string, updates: Partial<GroupDTO>): Promise<void> {
        const groupIndex = this.#groupsSignal.value.findIndex((g) => g.id === id);

        if (groupIndex === -1) {
            throw new Error(`Group with id ${id} not found`);
        }

        // Mark this group as updating
        const newUpdatingIds = new Set(this.#updatingGroupIdsSignal.value);
        newUpdatingIds.add(id);
        this.#updatingGroupIdsSignal.value = newUpdatingIds;

        try {
            // Send update to server (only name and description are supported by API)
            const updateData: { name?: GroupName; description?: string; } = {};
            if (updates.name !== undefined) updateData.name = updates.name;
            if (updates.description !== undefined) updateData.description = updates.description;

            if (Object.keys(updateData).length > 0) {
                await apiClient.updateGroup(id, updateData);
            }

            // Fetch fresh data from server to ensure consistency (maintain current page)
            // This also ensures we get any server-side computed fields
            const cursor = this.pagination.cursorForCurrentPage();
            await this.fetchGroups(this.pagination.pageSize, cursor);
        } catch (error) {
            // Categorize errors: validation (400s) vs network/server errors
            this.errorManager.handleApiError(error);
            throw error;
        } finally {
            // Remove from updating set
            const newUpdatingIds = new Set(this.#updatingGroupIdsSignal.value);
            newUpdatingIds.delete(id);
            this.#updatingGroupIdsSignal.value = newUpdatingIds;
        }
    }

    async archiveGroup(groupId: GroupId): Promise<void> {
        await this.updateMembershipStatus(groupId, () => apiClient.archiveGroupForUser(groupId));
    }

    async unarchiveGroup(groupId: GroupId): Promise<void> {
        await this.updateMembershipStatus(groupId, () => apiClient.unarchiveGroupForUser(groupId));
    }

    async setShowArchived(showArchived: boolean): Promise<void> {
        if (this.#showArchivedSignal.value === showArchived && this.#initializedSignal.value) {
            return;
        }

        this.#showArchivedSignal.value = showArchived;
        this.pagination.reset();
        this.errorManager.clearAll();

        await this.fetchGroups(this.pagination.pageSize);
    }

    async toggleShowArchived(): Promise<void> {
        await this.setShowArchived(!this.#showArchivedSignal.value);
    }

    async refreshGroups(): Promise<void> {
        await this.realtime.refresh();
    }

    /**
     * Register a component to use the groups store
     * Uses reference counting to manage subscriptions
     */
    registerComponent(componentId: string, userId: UserId): void {
        this.realtime.registerComponent(componentId, userId);
    }

    /**
     * Deregister a component from the groups store
     * Only disposes subscription when last component deregisters
     */
    deregisterComponent(componentId: string): void {
        this.realtime.deregisterComponent(componentId);
    }

    private handleGroupRemoval = (groupId: GroupId, groupNameHint?: string): void => {
        const currentGroups = this.#groupsSignal.value;
        const removedGroup = currentGroups.find((group) => group.id === groupId);
        const groupName = groupNameHint || removedGroup?.name || 'Unknown Group';

        logInfo('Group removed - removing from list without refresh', {
            groupId,
            groupName,
            currentGroupCount: currentGroups.length,
        });

        const filteredGroups = currentGroups.filter((group) => group.id !== groupId);

        if (filteredGroups.length === currentGroups.length) {
            return;
        }

        this.#groupsSignal.value = filteredGroups;

        console.info(`📨 You've been removed from "${groupName}"`);
        console.info('🔄 Signal value updated after group removal', {
            groupId,
            groupName,
            oldCount: currentGroups.length,
            newCount: filteredGroups.length,
            oldGroupIds: currentGroups.map((g) => g.id),
            newGroupIds: filteredGroups.map((g) => g.id),
            signalValueLength: this.#groupsSignal.value.length,
            signalPeek: this.#groupsSignal.peek().length,
        });

        logInfo('Group removed from dashboard', {
            groupId,
            groupName,
            oldCount: currentGroups.length,
            newCount: filteredGroups.length,
        });
    };

    /**
     * Legacy API - subscribes without reference counting
     * @deprecated Use registerComponent/deregisterComponent instead
     */
    subscribeToChanges(userId: UserId): void {
        this.realtime.subscribeToChanges(userId);
    }

    clearError(): void {
        this.errorManager.clearAll();
    }

    clearValidationError(): void {
        this.errorManager.clearValidationError();
    }

    reset(): void {
        // Clear any pending refresh operations and reset helpers
        this.realtime.clearRefreshState();
        this.pagination.reset({ pageSize: 8 });
        this.errorManager.clearAll();

        batch(() => {
            this.#groupsSignal.value = [];
            this.#loadingSignal.value = false;
            this.#initializedSignal.value = false;
            this.#isRefreshingSignal.value = false;
            this.#lastRefreshSignal.value = 0;
            this.#updatingGroupIdsSignal.value = new Set();
            this.#isCreatingGroupSignal.value = false;
            this.#showArchivedSignal.value = false;
        });

        // Mimic legacy behaviour: only dispose subscription when idle
        this.realtime.disposeIfIdle();
    }

    /**
     * Legacy API - disposes without reference counting
     * @deprecated Use registerComponent/deregisterComponent instead
     */
    dispose(): void {
        this.realtime.disposeIfIdle();
    }

    private resolveStatusFilter(): MemberStatus {
        return this.#showArchivedSignal.value ? MemberStatuses.ARCHIVED : MemberStatuses.ACTIVE;
    }

    private async updateMembershipStatus(groupId: GroupId, operation: () => Promise<unknown>): Promise<void> {
        const updatingIds = new Set(this.#updatingGroupIdsSignal.value);
        updatingIds.add(groupId);
        this.#updatingGroupIdsSignal.value = updatingIds;
        this.errorManager.clearNetworkError();

        const cursor = this.pagination.cursorForCurrentPage();

        try {
            await operation();
            await this.fetchGroups(this.pagination.pageSize, cursor);
        } catch (error) {
            this.errorManager.setNetworkError(this.errorManager.getErrorMessage(error));
            throw error;
        } finally {
            const updatedIds = new Set(this.#updatingGroupIdsSignal.value);
            updatedIds.delete(groupId);
            this.#updatingGroupIdsSignal.value = updatedIds;
        }
    }
}

// Export singleton instance with environment-aware debounce delay
// Use 10ms in test environments for fast unit tests, 300ms in production
const debounceDelay = import.meta.env.MODE === 'test' ? 10 : 300;
export const enhancedGroupsStore = new EnhancedGroupsStoreImpl(activityFeedRealtimeService, debounceDelay);
