import { logInfo, logWarning } from '@/utils/browser-logger.ts';
import { streamingMetrics } from '@/utils/streaming-metrics';
import { UserNotificationDetector, userNotificationDetector } from '@/utils/user-notification-detector.ts';
import { batch, computed, ReadonlySignal, signal } from '@preact/signals';
import { CreateGroupRequest, GroupDTO, MemberStatus, MemberStatuses } from '@splitifyd/shared';
import type { GroupId } from '@splitifyd/shared';
import { apiClient, ApiError } from '../apiClient';

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
    registerComponent(componentId: string, userId: string): void;
    deregisterComponent(componentId: string): void;
    // Legacy API - kept for backward compatibility
    subscribeToChanges(userId: string): void;
    dispose(): void;
}

class EnhancedGroupsStoreImpl implements EnhancedGroupsStore {
    // Private signals - encapsulated within the class
    readonly #groupsSignal = signal<GroupDTO[]>([]);
    readonly #loadingSignal = signal<boolean>(false);
    readonly #validationErrorSignal = signal<string | null>(null); // Persists through refreshes
    readonly #networkErrorSignal = signal<string | null>(null); // Cleared on successful refresh
    readonly #initializedSignal = signal<boolean>(false);
    readonly #isRefreshingSignal = signal<boolean>(false);
    readonly #lastRefreshSignal = signal<number>(0);
    readonly #updatingGroupIdsSignal = signal<Set<string>>(new Set());
    readonly #isCreatingGroupSignal = signal<boolean>(false);
    readonly #currentPageSignal = signal<number>(1);
    readonly #hasMoreSignal = signal<boolean>(false);
    readonly #pageSizeSignal = signal<number>(8);
    readonly #showArchivedSignal = signal<boolean>(false);

    private notificationUnsubscribe: (() => void) | null = null;
    private nextCursor: string | null = null;
    private previousCursors: string[] = []; // Stack of cursors for previous pages

    // Reference counting for subscription management
    private subscriberCount = 0;
    private subscriberIds = new Set<string>();
    private currentUserId: string | null = null;

    // Debouncing for refresh operations
    private refreshDebounceTimer: NodeJS.Timeout | null = null;
    private refreshDebounceDelay: number;
    private pendingRefresh = false;

    constructor(
        private notificationDetector: UserNotificationDetector,
        debounceDelay: number = 300,
    ) {
        this.refreshDebounceDelay = debounceDelay;
    }

    // State getters - readonly values for external consumers
    get groups() {
        return this.#groupsSignal.value;
    }
    get loading() {
        return this.#loadingSignal.value;
    }
    get error() {
        return this.#validationErrorSignal.value || this.#networkErrorSignal.value;
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
        // Create a computed signal that combines both error types
        return computed(() => this.#validationErrorSignal.value || this.#networkErrorSignal.value);
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
        this.#networkErrorSignal.value = null; // Only clear network errors, not validation errors

        const startTime = Date.now();
        const pageSize = limit || this.#pageSizeSignal.value;

        try {
            // Include metadata to get change information and pagination params
            const response = await apiClient.getGroups({
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
            this.#hasMoreSignal.value = response.hasMore;
            this.nextCursor = response.nextCursor || null;
            this.#lastRefreshSignal.value = response.metadata?.serverTime || Date.now();
            this.#initializedSignal.value = true;
        } catch (error: any) {
            // Handle 404 or empty response gracefully - this might mean all groups were deleted
            if (error?.status === 404 || error?.message?.includes('404')) {
                logInfo('fetchGroups: No groups found (404), clearing list', { error: error?.message });
                this.#groupsSignal.value = [];
                this.#hasMoreSignal.value = false;
                this.nextCursor = null;
                this.#lastRefreshSignal.value = Date.now();
                this.#initializedSignal.value = true;
            } else {
                this.#networkErrorSignal.value = this.getErrorMessage(error);
                throw error;
            }
        } finally {
            this.#loadingSignal.value = false;
        }
    }

    async loadNextPage(): Promise<void> {
        if (!this.#hasMoreSignal.value || !this.nextCursor) {
            logInfo('loadNextPage: No more pages available');
            return;
        }

        // Save current cursor for previous page navigation
        if (this.nextCursor) {
            this.previousCursors.push(this.nextCursor);
        }

        this.#currentPageSignal.value += 1;
        await this.fetchGroups(this.#pageSizeSignal.value, this.nextCursor);
    }

    async loadPreviousPage(): Promise<void> {
        if (this.#currentPageSignal.value <= 1) {
            logInfo('loadPreviousPage: Already on first page');
            return;
        }

        this.#currentPageSignal.value -= 1;

        // Pop the last cursor and use the one before it (or undefined for page 1)
        this.previousCursors.pop();
        const previousCursor = this.previousCursors[this.previousCursors.length - 1];

        // If we're going back to page 1, clear the cursor
        const cursor = this.#currentPageSignal.value === 1 ? undefined : previousCursor;
        await this.fetchGroups(this.#pageSizeSignal.value, cursor);
    }

    async setPageSize(size: number): Promise<void> {
        if (size < 1) {
            throw new Error('Page size must be at least 1');
        }

        this.#pageSizeSignal.value = size;
        this.#currentPageSignal.value = 1;
        this.previousCursors = [];
        this.nextCursor = null;
        await this.fetchGroups(size);
    }

    async createGroup(data: CreateGroupRequest): Promise<GroupDTO> {
        this.#isCreatingGroupSignal.value = true;
        // Clear both error types when starting a new operation
        this.#validationErrorSignal.value = null;
        this.#networkErrorSignal.value = null;

        try {
            const newGroup = await apiClient.createGroup(data);

            // Reset to first page and fetch fresh data from server to ensure consistency
            this.#currentPageSignal.value = 1;
            this.previousCursors = [];
            this.nextCursor = null;
            await this.fetchGroups(this.#pageSizeSignal.value);

            return newGroup;
        } catch (error) {
            // Categorize errors: validation (400s) vs network/server errors
            if (error instanceof ApiError && (error.code?.startsWith('VALIDATION_') || error.requestContext?.status === 400)) {
                this.#validationErrorSignal.value = this.getErrorMessage(error);
            } else {
                this.#networkErrorSignal.value = this.getErrorMessage(error);
            }
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
            const updateData: { name?: string; description?: string; } = {};
            if (updates.name !== undefined) updateData.name = updates.name;
            if (updates.description !== undefined) updateData.description = updates.description;

            if (Object.keys(updateData).length > 0) {
                await apiClient.updateGroup(id, updateData);
            }

            // Fetch fresh data from server to ensure consistency (maintain current page)
            // This also ensures we get any server-side computed fields
            const cursor = this.#currentPageSignal.value > 1 ? this.previousCursors[this.previousCursors.length - 1] : undefined;
            await this.fetchGroups(this.#pageSizeSignal.value, cursor);
        } catch (error) {
            // Categorize errors: validation (400s) vs network/server errors
            if (error instanceof ApiError && (error.code?.startsWith('VALIDATION_') || error.requestContext?.status === 400)) {
                this.#validationErrorSignal.value = this.getErrorMessage(error);
            } else {
                this.#networkErrorSignal.value = this.getErrorMessage(error);
            }
            throw error;
        } finally {
            // Remove from updating set
            const newUpdatingIds = new Set(this.#updatingGroupIdsSignal.value);
            newUpdatingIds.delete(id);
            this.#updatingGroupIdsSignal.value = newUpdatingIds;
        }
    }

    async archiveGroup(groupId: GroupId): Promise<void> {
        await this.updateMembershipStatus(groupId, () => apiClient.archiveGroup(groupId));
    }

    async unarchiveGroup(groupId: GroupId): Promise<void> {
        await this.updateMembershipStatus(groupId, () => apiClient.unarchiveGroup(groupId));
    }

    async setShowArchived(showArchived: boolean): Promise<void> {
        if (this.#showArchivedSignal.value === showArchived && this.#initializedSignal.value) {
            return;
        }

        this.#showArchivedSignal.value = showArchived;
        this.#currentPageSignal.value = 1;
        this.previousCursors = [];
        this.nextCursor = null;
        this.#validationErrorSignal.value = null;
        this.#networkErrorSignal.value = null;

        await this.fetchGroups(this.#pageSizeSignal.value);
    }

    async toggleShowArchived(): Promise<void> {
        await this.setShowArchived(!this.#showArchivedSignal.value);
    }

    async refreshGroups(): Promise<void> {
        // If a refresh is already pending, just wait for it
        if (this.pendingRefresh) {
            logInfo('refreshGroups: Refresh already pending, skipping duplicate request');
            return;
        }

        // Clear any existing debounce timer
        if (this.refreshDebounceTimer) {
            clearTimeout(this.refreshDebounceTimer);
        }

        // Return a promise that resolves when the debounced refresh completes
        return new Promise<void>((resolve, reject) => {
            this.refreshDebounceTimer = setTimeout(async () => {
                this.pendingRefresh = true;
                this.#isRefreshingSignal.value = true;

                logInfo('refreshGroups: Starting debounced refresh');

                try {
                    await this.fetchGroups();
                    resolve();
                } catch (error) {
                    reject(error);
                } finally {
                    this.#isRefreshingSignal.value = false;
                    this.pendingRefresh = false;
                    this.refreshDebounceTimer = null;
                }
            }, this.refreshDebounceDelay);
        });
    }

    /**
     * Register a component to use the groups store
     * Uses reference counting to manage subscriptions
     */
    registerComponent(componentId: string, userId: string): void {
        // Add to subscriber tracking
        this.subscriberIds.add(componentId);
        this.subscriberCount++;

        // If this is the first subscriber or user changed, set up subscription
        if (this.subscriberCount === 1 || this.currentUserId !== userId) {
            this.currentUserId = userId;
            this.setupSubscription(userId);
        }

        // Component registered (routine)
    }

    /**
     * Deregister a component from the groups store
     * Only disposes subscription when last component deregisters
     */
    deregisterComponent(componentId: string): void {
        if (!this.subscriberIds.has(componentId)) {
            return;
        }

        this.subscriberIds.delete(componentId);
        this.subscriberCount--;

        // Component deregistered (routine)

        // Only dispose if this was the last subscriber
        if (this.subscriberCount === 0) {
            this.disposeSubscription();
            this.currentUserId = null;
        }
    }

    /**
     * Internal method to set up subscription
     */
    private setupSubscription(userId: string): void {
        // Unsubscribe from any existing listener
        if (this.notificationUnsubscribe) {
            this.notificationUnsubscribe();
        }

        // Subscribe to user notifications - group changes trigger refresh
        this.notificationUnsubscribe = this.notificationDetector.subscribe(
            {
                onGroupChange: (groupId) => {
                    logInfo('Group change detected, triggering refresh', {
                        userId,
                        groupId,
                        currentGroupCount: this.#groupsSignal.value.length,
                        timestamp: new Date().toISOString(),
                    });

                    // NO OPTIMISTIC UPDATES - just refresh from server
                    // This ensures the dashboard accurately reflects server state
                    this
                        .refreshGroups()
                        .then(() => {
                            logInfo('Groups refresh completed after change detection', {
                                userId,
                                groupId,
                                newGroupCount: this.#groupsSignal.value.length,
                            });
                        })
                        .catch((error) =>
                            logWarning('Failed to refresh groups after change detection', {
                                error: error instanceof Error ? error.message : String(error),
                                userId,
                                groupId,
                            })
                        );
                },
                onGroupRemoved: (groupId) => {
                    // Find the group name before removing it
                    const currentGroups = this.#groupsSignal.value;
                    const removedGroup = currentGroups.find((group) => group.id === groupId);
                    const groupName = removedGroup?.name || 'Unknown Group';

                    logInfo('Group removed - removing from list without refresh', {
                        userId,
                        groupId,
                        groupName,
                        currentGroupCount: currentGroups.length,
                    });

                    // Remove the group from the list immediately without fetching
                    const filteredGroups = currentGroups.filter((group) => group.id !== groupId);

                    if (filteredGroups.length !== currentGroups.length) {
                        this.#groupsSignal.value = filteredGroups;

                        // Show user-friendly notification about removal
                        console.info(`📨 You've been removed from "${groupName}"`);

                        // DEBUG: Log signal value change for UI reactivity debugging
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
                    }
                },
            },
            {
                maxRetries: 3,
                retryDelay: 2000,
                onError: (error) => {
                    logWarning('Notification subscription error, notifications may be delayed', {
                        error: error.message,
                        userId,
                    });
                },
            },
        );

        // Immediately refresh to get current data after setting up subscription
        // This ensures we don't miss any changes that happened before the subscription was active
        this.refreshGroups().catch((error) =>
            logWarning('Failed to refresh groups after subscription setup', {
                error: error instanceof Error ? error.message : String(error),
                userId,
            })
        );
    }

    /**
     * Internal method to dispose subscription
     */
    private disposeSubscription(): void {
        if (this.notificationUnsubscribe) {
            this.notificationUnsubscribe();
            this.notificationUnsubscribe = null;
        }
    }

    /**
     * Legacy API - subscribes without reference counting
     * @deprecated Use registerComponent/deregisterComponent instead
     */
    subscribeToChanges(userId: string): void {
        this.setupSubscription(userId);
    }

    clearError(): void {
        this.#validationErrorSignal.value = null;
        this.#networkErrorSignal.value = null;
    }

    clearValidationError(): void {
        this.#validationErrorSignal.value = null;
    }

    reset(): void {
        // Clear any pending refresh operations
        if (this.refreshDebounceTimer) {
            clearTimeout(this.refreshDebounceTimer);
            this.refreshDebounceTimer = null;
        }
        this.pendingRefresh = false;

        // Reset pagination state
        this.nextCursor = null;
        this.previousCursors = [];

        batch(() => {
            this.#groupsSignal.value = [];
            this.#loadingSignal.value = false;
            this.#validationErrorSignal.value = null;
            this.#networkErrorSignal.value = null;
            this.#initializedSignal.value = false;
            this.#isRefreshingSignal.value = false;
            this.#lastRefreshSignal.value = 0;
            this.#updatingGroupIdsSignal.value = new Set();
            this.#isCreatingGroupSignal.value = false;
            this.#currentPageSignal.value = 1;
            this.#hasMoreSignal.value = false;
            this.#pageSizeSignal.value = 8;
            this.#showArchivedSignal.value = false;
        });

        this.dispose();
    }

    /**
     * Legacy API - disposes without reference counting
     * @deprecated Use registerComponent/deregisterComponent instead
     */
    dispose(): void {
        // Only dispose if no components are registered (legacy behavior)
        if (this.subscriberCount === 0) {
            this.disposeSubscription();
        }
    }

    private getErrorMessage(error: unknown): string {
        if (error instanceof ApiError) {
            return error.message;
        }
        if (error instanceof Error) {
            return error.message;
        }
        return 'An unexpected error occurred';
    }

    private resolveStatusFilter(): MemberStatus {
        return this.#showArchivedSignal.value ? MemberStatuses.ARCHIVED : MemberStatuses.ACTIVE;
    }

    private async updateMembershipStatus(groupId: GroupId, operation: () => Promise<unknown>): Promise<void> {
        const updatingIds = new Set(this.#updatingGroupIdsSignal.value);
        updatingIds.add(groupId);
        this.#updatingGroupIdsSignal.value = updatingIds;
        this.#networkErrorSignal.value = null;

        const cursor = this.#currentPageSignal.value > 1 ? this.previousCursors[this.previousCursors.length - 1] : undefined;

        try {
            await operation();
            await this.fetchGroups(this.#pageSizeSignal.value, cursor);
        } catch (error) {
            this.#networkErrorSignal.value = this.getErrorMessage(error);
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
export const enhancedGroupsStore = new EnhancedGroupsStoreImpl(userNotificationDetector, debounceDelay);
