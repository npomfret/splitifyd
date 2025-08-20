import { signal, batch } from '@preact/signals';
import type { Group, CreateGroupRequest } from '@shared/shared-types.ts';
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

    fetchGroups(): Promise<void>;
    createGroup(data: CreateGroupRequest): Promise<Group>;
    updateGroup(id: string, updates: Partial<Group>): Promise<void>;
    refreshGroups(): Promise<void>;
    clearError(): void;
    reset(): void;
    subscribeToChanges(userId: string): void;
    dispose(): void;
}

// Signals for groups state
const groupsSignal = signal<Group[]>([]);
const loadingSignal = signal<boolean>(false);
const errorSignal = signal<string | null>(null);
const initializedSignal = signal<boolean>(false);
const isRefreshingSignal = signal<boolean>(false);
const lastRefreshSignal = signal<number>(0);
const updatingGroupIdsSignal = signal<Set<string>>(new Set());
const isCreatingGroupSignal = signal<boolean>(false);

class EnhancedGroupsStoreImpl implements EnhancedGroupsStore {
    private changeDetector = new ChangeDetector();
    private changeUnsubscribe: (() => void) | null = null;

    // State getters
    get groups() {
        return groupsSignal.value;
    }
    get loading() {
        return loadingSignal.value;
    }
    get error() {
        return errorSignal.value;
    }
    get initialized() {
        return initializedSignal.value;
    }
    get isRefreshing() {
        return isRefreshingSignal.value;
    }
    get lastRefresh() {
        return lastRefreshSignal.value;
    }
    get updatingGroupIds() {
        return updatingGroupIdsSignal.value;
    }
    get isCreatingGroup() {
        return isCreatingGroupSignal.value;
    }

    async fetchGroups(): Promise<void> {
        loadingSignal.value = true;
        errorSignal.value = null;

        const startTime = Date.now();

        try {
            // Include metadata to get change information
            const response = await apiClient.getGroups({ includeMetadata: true });

            // Track REST refresh metrics
            const latency = Date.now() - startTime;
            streamingMetrics.trackRestRefresh(latency);

            // Use metadata if available to check for newer data
            if (response.metadata) {
                const hasNewerData = response.metadata.lastChangeTimestamp > lastRefreshSignal.value;
                if (!hasNewerData && groupsSignal.value.length > 0) {
                    // No new changes, skip update
                    initializedSignal.value = true;
                    return;
                }
            } else {
                // Fallback to timestamp check if no metadata
                const currentGroups = groupsSignal.value;
                const hasNewerData = response.groups.some((newGroup: Group) => {
                    const existing = currentGroups.find((g) => g.id === newGroup.id);
                    if (!existing) return true;
                    if (!existing.updatedAt || !newGroup.updatedAt) return true;
                    return new Date(newGroup.updatedAt) > new Date(existing.updatedAt);
                });

                if (!hasNewerData && currentGroups.length > 0) {
                    initializedSignal.value = true;
                    return;
                }
            }

            groupsSignal.value = response.groups;
            lastRefreshSignal.value = response.metadata?.serverTime || Date.now();
            initializedSignal.value = true;
        } catch (error) {
            errorSignal.value = this.getErrorMessage(error);
            throw error;
        } finally {
            loadingSignal.value = false;
        }
    }

    async createGroup(data: CreateGroupRequest): Promise<Group> {
        isCreatingGroupSignal.value = true;
        errorSignal.value = null;

        try {
            const newGroup = await apiClient.createGroup(data);

            // Fetch fresh data from server to ensure consistency
            await this.fetchGroups();

            return newGroup;
        } catch (error) {
            errorSignal.value = this.getErrorMessage(error);
            throw error;
        } finally {
            isCreatingGroupSignal.value = false;
        }
    }

    async updateGroup(id: string, updates: Partial<Group>): Promise<void> {
        const groupIndex = groupsSignal.value.findIndex(g => g.id === id);
        
        if (groupIndex === -1) {
            throw new Error(`Group with id ${id} not found`);
        }

        // Mark this group as updating
        const newUpdatingIds = new Set(updatingGroupIdsSignal.value);
        newUpdatingIds.add(id);
        updatingGroupIdsSignal.value = newUpdatingIds;

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
            errorSignal.value = this.getErrorMessage(error);
            throw error;
        } finally {
            // Remove from updating set
            const newUpdatingIds = new Set(updatingGroupIdsSignal.value);
            newUpdatingIds.delete(id);
            updatingGroupIdsSignal.value = newUpdatingIds;
        }
    }

    async refreshGroups(): Promise<void> {
        isRefreshingSignal.value = true;

        try {
            await this.fetchGroups();
        } finally {
            isRefreshingSignal.value = false;
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
                logWarning('Group change detected, refreshing', {});
                this.refreshGroups().catch((error) => logWarning('Failed to refresh groups', { error }));
            },
            {
                maxRetries: 3,
                retryDelay: 2000,
                onError: (error) => {
                    logWarning('Change subscription error, notifications may be delayed', { 
                        error: error.message,
                        userId 
                    });
                }
            }
        );
    }

    clearError(): void {
        errorSignal.value = null;
    }

    reset(): void {
        batch(() => {
            groupsSignal.value = [];
            loadingSignal.value = false;
            errorSignal.value = null;
            initializedSignal.value = false;
            isRefreshingSignal.value = false;
            lastRefreshSignal.value = 0;
            updatingGroupIdsSignal.value = new Set();
            isCreatingGroupSignal.value = false;
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
