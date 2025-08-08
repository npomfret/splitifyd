import { signal } from '@preact/signals';
import type { Group, CreateGroupRequest, ListGroupsResponse } from '@shared/types/webapp-shared-types';
import { apiClient, ApiError } from '../apiClient';
import { logWarning } from '../../utils/browser-logger';

export interface GroupsStore {
  groups: Group[];
  loading: boolean;
  error: string | null;
  initialized: boolean;
  
  fetchGroups(): Promise<void>;
  createGroup(data: CreateGroupRequest): Promise<Group>;
  refreshGroups(): Promise<void>;
  clearError(): void;
  reset(): void; // For testing
}

// Signals for groups state
const groupsSignal = signal<Group[]>([]);
const loadingSignal = signal<boolean>(false);
const errorSignal = signal<string | null>(null);
const initializedSignal = signal<boolean>(false);

class GroupsStoreImpl implements GroupsStore {
  // State getters
  get groups() { return groupsSignal.value; }
  get loading() { return loadingSignal.value; }
  get error() { return errorSignal.value; }
  get initialized() { return initializedSignal.value; }

  async fetchGroups(): Promise<void> {
    if (loadingSignal.value) return; // Prevent concurrent requests
    
    loadingSignal.value = true;
    errorSignal.value = null;

    try {
      const response = await apiClient.getGroups() as ListGroupsResponse;
      groupsSignal.value = response.groups;
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
      const newGroup = await apiClient.createGroup(data) as Group;
      
      // Optimistically update the groups list
      groupsSignal.value = [newGroup, ...groupsSignal.value];
      
      // Also refresh to ensure we have the latest server data
      try {
        await this.refreshGroups();
      } catch (refreshError) {
        // Log refresh error but don't fail the group creation
        logWarning('Failed to refresh groups after creating group', { error: refreshError });
      }
      
      return newGroup;
    } catch (error) {
      errorSignal.value = this.getErrorMessage(error);
      throw error;
    } finally {
      loadingSignal.value = false;
    }
  }

  async refreshGroups(): Promise<void> {
    // Force refresh regardless of current state
    return this.fetchGroups();
  }

  clearError(): void {
    errorSignal.value = null;
  }

  reset(): void {
    groupsSignal.value = [];
    loadingSignal.value = false;
    errorSignal.value = null;
    initializedSignal.value = false;
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof ApiError) {
      switch (error.code) {
        case 'PERMISSION_DENIED':
          return 'You do not have permission to access groups.';
        case 'UNAUTHORIZED':
          return 'Please sign in to view groups.';
        case 'GROUP_NOT_FOUND':
          return 'The requested group could not be found.';
        case 'NETWORK_ERROR':
          return 'Network error. Please check your connection.';
        default:
          return error.message || 'Failed to access groups.';
      }
    }
    
    if (error instanceof Error) {
      return error.message;
    }
    
    return 'An unexpected error occurred.';
  }
}

export const groupsStore = new GroupsStoreImpl();