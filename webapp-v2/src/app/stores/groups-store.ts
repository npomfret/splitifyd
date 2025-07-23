import { signal } from '@preact/signals';
import type { TransformedGroup, CreateGroupRequest, GroupDetail } from '@shared/apiTypes';
import type { ListGroupsResponse } from '@shared/apiContract';
import { apiClient } from '../apiClient';

export interface GroupsStore {
  groups: TransformedGroup[];
  loading: boolean;
  error: string | null;
  initialized: boolean;
  
  fetchGroups(): Promise<void>;
  createGroup(data: CreateGroupRequest): Promise<TransformedGroup>;
  refreshGroups(): Promise<void>;
  clearError(): void;
  reset(): void; // For testing
}

// Signals for groups state
const groupsSignal = signal<TransformedGroup[]>([]);
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
      errorSignal.value = error instanceof Error ? error.message : 'Failed to fetch groups';
    } finally {
      loadingSignal.value = false;
    }
  }

  async createGroup(data: CreateGroupRequest): Promise<TransformedGroup> {
    loadingSignal.value = true;
    errorSignal.value = null;

    try {
      const newGroup = await apiClient.createGroup(data) as GroupDetail;
      
      // Convert GroupDetail to TransformedGroup for consistent display
      const transformedGroup: TransformedGroup = {
        id: newGroup.id,
        name: newGroup.name,
        memberCount: newGroup.members.length,
        yourBalance: 0, // New group has no expenses yet
        lastActivity: 'Just created',
        lastActivityRaw: newGroup.createdAt,
        lastExpense: null, // No expenses yet
        members: newGroup.members,
        expenseCount: 0,
        lastExpenseTime: null
      };

      // Optimistically update the groups list
      groupsSignal.value = [transformedGroup, ...groupsSignal.value];
      
      return transformedGroup;
    } catch (error) {
      errorSignal.value = error instanceof Error ? error.message : 'Failed to create group';
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
}

export const groupsStore = new GroupsStoreImpl();