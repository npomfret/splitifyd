import { signal, batch, computed, ReadonlySignal } from '@preact/signals';
import type { Group, CreateGroupRequest } from '@splitifyd/shared';
import { apiClient, ApiError } from '../apiClient';
import { logWarning, logInfo } from '@/utils/browser-logger.ts';
import {userNotificationDetector, UserNotificationDetector} from '@/utils/user-notification-detector.ts';
import { streamingMetrics } from '@/utils/streaming-metrics';

export interface EnhancedGroupsStore {
    groups: Group[];
    loading: boolean;
    error: string | null;
    initialized: boolean;
    isRefreshing: boolean;
    lastRefresh: number;
    updatingGroupIds: Set<string>;
    isCreatingGroup: boolean;

    // Readonly signal accessors for reactive components
    readonly groupsSignal: ReadonlySignal<Group[]>;
    readonly loadingSignal: ReadonlySignal<boolean>;
    readonly errorSignal: ReadonlySignal<string | null>;
    readonly initializedSignal: ReadonlySignal<boolean>;
    readonly isRefreshingSignal: ReadonlySignal<boolean>;
    readonly lastRefreshSignal: ReadonlySignal<number>;
    readonly updatingGroupIdsSignal: ReadonlySignal<Set<string>>;
    readonly isCreatingGroupSignal: ReadonlySignal<boolean>;

    fetchGroups(): Promise<void>;
    createGroup(data: CreateGroupRequest): Promise<Group>;
    updateGroup(id: string, updates: Partial<Group>): Promise<void>;
    refreshGroups(): Promise<void>;
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
    readonly #groupsSignal = signal<Group[]>([]);
    readonly #loadingSignal = signal<boolean>(false);
    readonly #validationErrorSignal = signal<string | null>(null); // Persists through refreshes
    readonly #networkErrorSignal = signal<string | null>(null); // Cleared on successful refresh
    readonly #initializedSignal = signal<boolean>(false);
    readonly #isRefreshingSignal = signal<boolean>(false);
    readonly #lastRefreshSignal = signal<number>(0);
    readonly #updatingGroupIdsSignal = signal<Set<string>>(new Set());
    readonly #isCreatingGroupSignal = signal<boolean>(false);

    private notificationUnsubscribe: (() => void) | null = null;

    // Reference counting for subscription management
    private subscriberCount = 0;
    private subscriberIds = new Set<string>();
    private currentUserId: string | null = null;

    // Debouncing for refresh operations
    private refreshDebounceTimer: NodeJS.Timeout | null = null;
    private refreshDebounceDelay = 300; // 300ms debounce
    private pendingRefresh = false;

    constructor(private notificationDetector: UserNotificationDetector) {
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

    // Signal accessors for reactive components - return readonly signals
    get groupsSignal(): ReadonlySignal<Group[]> {
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

    async fetchGroups(): Promise<void> {
        this.#loadingSignal.value = true;
        this.#networkErrorSignal.value = null; // Only clear network errors, not validation errors

        const startTime = Date.now();

        try {
            // Include metadata to get change information
            const response = await apiClient.getGroups({ includeMetadata: true });

            // Track REST refresh metrics
            const latency = Date.now() - startTime;
            streamingMetrics.trackRestRefresh(latency);

            // Log each group ID for debugging
            logInfo('fetchGroups: Groups received from server', {
                groupIds: response.groups.map((g) => g.id),
                groupCount: response.groups.length,
                groups: response.groups.map((g) => ({ id: g.id, name: g.name })),
            });

            // Always update with server data - removed optimization that could ignore deleted groups
            this.#groupsSignal.value = response.groups;
            this.#lastRefreshSignal.value = response.metadata?.serverTime || Date.now();
            this.#initializedSignal.value = true;
        } catch (error: any) {
            // Handle 404 or empty response gracefully - this might mean all groups were deleted
            if (error?.status === 404 || error?.message?.includes('404')) {
                logInfo('fetchGroups: No groups found (404), clearing list', { error: error?.message });
                this.#groupsSignal.value = [];
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

    async createGroup(data: CreateGroupRequest): Promise<Group> {
        this.#isCreatingGroupSignal.value = true;
        // Clear both error types when starting a new operation
        this.#validationErrorSignal.value = null;
        this.#networkErrorSignal.value = null;

        try {
            const newGroup = await apiClient.createGroup(data);

            // Fetch fresh data from server to ensure consistency - only on success
            await this.fetchGroups();

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

    async updateGroup(id: string, updates: Partial<Group>): Promise<void> {
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
            const updateData: { name?: string; description?: string } = {};
            if (updates.name !== undefined) updateData.name = updates.name;
            if (updates.description !== undefined) updateData.description = updates.description;

            if (Object.keys(updateData).length > 0) {
                await apiClient.updateGroup(id, updateData);
            }

            // Fetch fresh data from server to ensure consistency
            // This also ensures we get any server-side computed fields
            await this.fetchGroups();
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
        this.notificationUnsubscribe = this.notificationDetector.subscribe({
            onGroupChange: (groupId) => {
                logInfo('Group change detected, triggering refresh', {
                    userId,
                    groupId,
                    currentGroupCount: this.#groupsSignal.value.length,
                    timestamp: new Date().toISOString(),
                });

                // NO OPTIMISTIC UPDATES - just refresh from server
                // This ensures the dashboard accurately reflects server state
                this.refreshGroups()
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
                        }),
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
        }, {
            maxRetries: 3,
            retryDelay: 2000,
            onError: (error) => {
                logWarning('Notification subscription error, notifications may be delayed', {
                    error: error.message,
                    userId,
                });
            },
        });

        // Immediately refresh to get current data after setting up subscription
        // This ensures we don't miss any changes that happened before the subscription was active
        this.refreshGroups().catch((error) =>
            logWarning('Failed to refresh groups after subscription setup', {
                error: error instanceof Error ? error.message : String(error),
                userId,
            }),
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
}

// Export singleton instance
export const enhancedGroupsStore = new EnhancedGroupsStoreImpl(userNotificationDetector);
