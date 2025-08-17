import { signal, batch } from '@preact/signals';
import type { Group, CreateGroupRequest } from '../../../../firebase/functions/src/shared/shared-types';
import { apiClient, ApiError } from '../apiClient';
import { logWarning } from '../../utils/browser-logger';
import { ChangeDetector } from '../../utils/change-detector';

export interface EnhancedGroupsStore {
    groups: Group[];
    loading: boolean;
    error: string | null;
    initialized: boolean;
    isRefreshing: boolean;
    lastRefresh: number;

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

    async fetchGroups(): Promise<void> {
        loadingSignal.value = true;
        errorSignal.value = null;

        try {
            const response = await apiClient.getGroups();

            // Simple timestamp check - only update if we get newer data
            const currentGroups = groupsSignal.value;
            const hasNewerData = response.groups.some((newGroup: Group) => {
                const existing = currentGroups.find((g) => g.id === newGroup.id);
                if (!existing) return true;
                if (!existing.updatedAt || !newGroup.updatedAt) return true;
                return new Date(newGroup.updatedAt) > new Date(existing.updatedAt);
            });

            if (hasNewerData || currentGroups.length === 0) {
                groupsSignal.value = response.groups;
                lastRefreshSignal.value = Date.now();
            }

            initializedSignal.value = true;
        } catch (error) {
            errorSignal.value = this.getErrorMessage(error);
            throw error;
        } finally {
            loadingSignal.value = false;
        }
    }

    async createGroup(data: CreateGroupRequest): Promise<Group> {
        loadingSignal.value = true;
        errorSignal.value = null;

        try {
            const newGroup = await apiClient.createGroup(data);

            // Add to list
            groupsSignal.value = [newGroup, ...groupsSignal.value];
            lastRefreshSignal.value = Date.now();

            return newGroup;
        } catch (error) {
            errorSignal.value = this.getErrorMessage(error);
            throw error;
        } finally {
            loadingSignal.value = false;
        }
    }

    async updateGroup(id: string, updates: Partial<Group>): Promise<void> {
        // For now, just refresh to get server state
        await this.refreshGroups();
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
        this.changeUnsubscribe = this.changeDetector.subscribeToGroupChanges(userId, () => {
            // Any change = refresh immediately
            logWarning('Group change detected, refreshing', {});
            this.refreshGroups().catch((error) => logWarning('Failed to refresh groups', { error }));
        });
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
