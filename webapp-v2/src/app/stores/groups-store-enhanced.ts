import { signal, batch, ReadonlySignal } from '@preact/signals';
import type { Group, CreateGroupRequest } from '@splitifyd/shared';
import { apiClient, ApiError } from '../apiClient';
import { logWarning } from '@/utils/browser-logger.ts';
import { ChangeDetector } from '@/utils/change-detector.ts';
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
    reset(): void;
    subscribeToChanges(userId: string): void;
    dispose(): void;
}

class EnhancedGroupsStoreImpl implements EnhancedGroupsStore {
    // Private signals - encapsulated within the class
    readonly #groupsSignal = signal<Group[]>([]);
    readonly #loadingSignal = signal<boolean>(false);
    readonly #errorSignal = signal<string | null>(null);
    readonly #initializedSignal = signal<boolean>(false);
    readonly #isRefreshingSignal = signal<boolean>(false);
    readonly #lastRefreshSignal = signal<number>(0);
    readonly #updatingGroupIdsSignal = signal<Set<string>>(new Set());
    readonly #isCreatingGroupSignal = signal<boolean>(false);

    private changeDetector = new ChangeDetector();
    private changeUnsubscribe: (() => void) | null = null;

    // State getters - readonly values for external consumers
    get groups() {
        return this.#groupsSignal.value;
    }
    get loading() {
        return this.#loadingSignal.value;
    }
    get error() {
        return this.#errorSignal.value;
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
        return this.#errorSignal;
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
        this.#errorSignal.value = null;

        const startTime = Date.now();

        try {
            // Include metadata to get change information
            const response = await apiClient.getGroups({ includeMetadata: true });

            // Track REST refresh metrics
            const latency = Date.now() - startTime;
            streamingMetrics.trackRestRefresh(latency);

            // Use metadata if available to check for newer data
            if (response.metadata) {
                const hasNewerData = response.metadata.lastChangeTimestamp > this.#lastRefreshSignal.value;
                if (!hasNewerData && this.#groupsSignal.value.length > 0) {
                    // No new changes, skip update
                    this.#initializedSignal.value = true;
                    return;
                }
            } else {
                // Fallback to timestamp check if no metadata
                const currentGroups = this.#groupsSignal.value;
                const hasNewerData = response.groups.some((newGroup: Group) => {
                    const existing = currentGroups.find((g) => g.id === newGroup.id);
                    if (!existing) return true;
                    if (!existing.updatedAt || !newGroup.updatedAt) return true;
                    return new Date(newGroup.updatedAt) > new Date(existing.updatedAt);
                });

                if (!hasNewerData && currentGroups.length > 0) {
                    this.#initializedSignal.value = true;
                    return;
                }
            }

            this.#groupsSignal.value = response.groups;
            this.#lastRefreshSignal.value = response.metadata?.serverTime || Date.now();
            this.#initializedSignal.value = true;
        } catch (error) {
            this.#errorSignal.value = this.getErrorMessage(error);
            throw error;
        } finally {
            this.#loadingSignal.value = false;
        }
    }

    async createGroup(data: CreateGroupRequest): Promise<Group> {
        this.#isCreatingGroupSignal.value = true;
        this.#errorSignal.value = null;

        try {
            const newGroup = await apiClient.createGroup(data);

            // Fetch fresh data from server to ensure consistency
            await this.fetchGroups();

            return newGroup;
        } catch (error) {
            this.#errorSignal.value = this.getErrorMessage(error);
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
            this.#errorSignal.value = this.getErrorMessage(error);
            throw error;
        } finally {
            // Remove from updating set
            const newUpdatingIds = new Set(this.#updatingGroupIdsSignal.value);
            newUpdatingIds.delete(id);
            this.#updatingGroupIdsSignal.value = newUpdatingIds;
        }
    }

    async refreshGroups(): Promise<void> {
        this.#isRefreshingSignal.value = true;

        try {
            await this.fetchGroups();
        } finally {
            this.#isRefreshingSignal.value = false;
        }
    }

    subscribeToChanges(userId: string): void {
        // Unsubscribe from any existing listener
        if (this.changeUnsubscribe) {
            this.changeUnsubscribe();
        }

        // Subscribe to group changes - any change triggers refresh
        this.changeUnsubscribe = this.changeDetector.subscribeToGroupChanges(
            userId,
            () => {
                // Any change = refresh immediately
                logWarning('Group change detected, refreshing groups', { 
                    userId,
                    currentGroupCount: this.#groupsSignal.value.length,
                    timestamp: new Date().toISOString()
                });
                this.refreshGroups().catch((error) => logWarning('Failed to refresh groups after change detection', { 
                    error: error instanceof Error ? error.message : String(error),
                    userId 
                }));
            },
            {
                maxRetries: 3,
                retryDelay: 2000,
                onError: (error) => {
                    logWarning('Change subscription error, notifications may be delayed', {
                        error: error.message,
                        userId,
                    });
                },
            },
        );
    }

    clearError(): void {
        this.#errorSignal.value = null;
    }

    reset(): void {
        batch(() => {
            this.#groupsSignal.value = [];
            this.#loadingSignal.value = false;
            this.#errorSignal.value = null;
            this.#initializedSignal.value = false;
            this.#isRefreshingSignal.value = false;
            this.#lastRefreshSignal.value = 0;
            this.#updatingGroupIdsSignal.value = new Set();
            this.#isCreatingGroupSignal.value = false;
        });

        this.dispose();
    }

    dispose(): void {
        if (this.changeUnsubscribe) {
            this.changeUnsubscribe();
            this.changeUnsubscribe = null;
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
export const enhancedGroupsStore = new EnhancedGroupsStoreImpl();
