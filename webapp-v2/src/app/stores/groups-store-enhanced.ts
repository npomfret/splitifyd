import { signal, batch } from '@preact/signals';
import type { Group, CreateGroupRequest, ListGroupsResponse } from '../../../../firebase/functions/src/shared/shared-types';
import { apiClient, ApiError } from '../apiClient';
import { logWarning } from '../../utils/browser-logger';
import { ConnectionManager } from '../../utils/connection-manager';
import { ChangeDetector } from '../../utils/change-detector';

export interface EnhancedGroupsStore {
  groups: Group[];
  loading: boolean;
  error: string | null;
  initialized: boolean;
  isRefreshing: boolean;
  lastRefresh: number;
  hasRecentChanges: boolean;
  
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
const hasRecentChangesSignal = signal<boolean>(false);

// User context preservation
interface UserContext {
  scrollPosition: number;
  selectedGroupIds: Set<string>;
  expandedGroupIds: Set<string>;
  focusedElementId: string | null;
  formData: Map<string, any>;
}

class EnhancedGroupsStoreImpl implements EnhancedGroupsStore {
  private connectionManager = ConnectionManager.getInstance();
  private changeDetector = ChangeDetector.getInstance();
  private changeUnsubscribe: (() => void) | null = null;
  private refreshTimeout: NodeJS.Timeout | null = null;
  private lastChangeTimestamp = 0;
  private userContext: UserContext | null = null;
  private optimisticUpdates = new Map<string, { data: Partial<Group>; version: number }>();
  private minRefreshInterval = 2000; // Minimum 2 seconds between refreshes
  
  // State getters
  get groups() { return groupsSignal.value; }
  get loading() { return loadingSignal.value; }
  get error() { return errorSignal.value; }
  get initialized() { return initializedSignal.value; }
  get isRefreshing() { return isRefreshingSignal.value; }
  get lastRefresh() { return lastRefreshSignal.value; }
  get hasRecentChanges() { return hasRecentChangesSignal.value; }

  async fetchGroups(): Promise<void> {
    if (loadingSignal.value) return; // Prevent concurrent requests
    
    loadingSignal.value = true;
    errorSignal.value = null;

    try {
      const response = await apiClient.getGroups() as ListGroupsResponse & { 
        metadata?: { 
          lastChangeTimestamp: number;
          changeCount: number;
          serverTime: number;
          hasRecentChanges: boolean;
        } 
      };
      
      batch(() => {
        // Merge with optimistic updates
        groupsSignal.value = this.mergeWithOptimisticUpdates(response.groups);
        initializedSignal.value = true;
        lastRefreshSignal.value = Date.now();
        
        // Update change status from metadata
        if (response.metadata) {
          hasRecentChangesSignal.value = response.metadata.hasRecentChanges;
          this.lastChangeTimestamp = response.metadata.lastChangeTimestamp;
        }
      });
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
      batch(() => {
        groupsSignal.value = [newGroup, ...groupsSignal.value];
        lastRefreshSignal.value = Date.now();
      });
      
      // Schedule a background refresh to ensure consistency
      this.scheduleBackgroundRefresh(500);
      
      return newGroup;
    } catch (error) {
      errorSignal.value = this.getErrorMessage(error);
      throw error;
    } finally {
      loadingSignal.value = false;
    }
  }

  async updateGroup(id: string, updates: Partial<Group>): Promise<void> {
    // Apply optimistic update immediately
    const optimisticVersion = Date.now();
    this.optimisticUpdates.set(id, {
      data: updates,
      version: optimisticVersion
    });
    
    // Update UI immediately
    batch(() => {
      groupsSignal.value = groupsSignal.value.map(g => 
        g.id === id ? { ...g, ...updates } : g
      );
    });
    
    try {
      // For now, just schedule a refresh since updateGroup is not implemented in apiClient
      // In production, we would call: await apiClient.updateGroup(id, updates);
      
      // Schedule refresh to get server state
      this.scheduleBackgroundRefresh(1000);
    } catch (error) {
      // Revert optimistic update on failure
      this.optimisticUpdates.delete(id);
      
      // Refresh to restore server state
      await this.refreshWithContext();
      
      errorSignal.value = this.getErrorMessage(error);
      throw error;
    }
  }

  async refreshGroups(): Promise<void> {
    // Force refresh regardless of current state
    return this.refreshWithContext();
  }

  subscribeToChanges(userId: string): void {
    // Unsubscribe from any existing listener
    if (this.changeUnsubscribe) {
      this.changeUnsubscribe();
    }
    
    // Subscribe to group changes
    this.changeUnsubscribe = this.changeDetector.subscribeToGroupChanges(
      userId,
      (change) => {
        // Update UI to show there are changes
        hasRecentChangesSignal.value = true;
        
        // Schedule smart refresh based on priority
        const delay = this.getRefreshDelay(change.metadata.priority);
        this.scheduleBackgroundRefresh(delay);
      }
    );
  }

  private async refreshWithContext(): Promise<void> {
    // Check minimum refresh interval
    const now = Date.now();
    if (now - lastRefreshSignal.value < this.minRefreshInterval) {
      return;
    }
    
    // Save user context before refresh
    this.saveUserContext();
    
    isRefreshingSignal.value = true;
    
    try {
      const response = await apiClient.getGroups() as ListGroupsResponse & { 
        metadata?: { 
          lastChangeTimestamp: number;
          changeCount: number;
          serverTime: number;
          hasRecentChanges: boolean;
        } 
      };
      
      batch(() => {
        // Check for conflicts with optimistic updates
        const conflicts = this.detectConflicts(response.groups);
        if (conflicts.length > 0) {
          this.handleConflicts(conflicts);
        }
        
        // Merge with optimistic updates
        const mergedGroups = this.mergeWithOptimisticUpdates(response.groups);
        
        // Check if there are visible changes
        const hasVisibleChanges = this.detectVisibleChanges(groupsSignal.value, mergedGroups);
        
        // Update groups
        groupsSignal.value = mergedGroups;
        lastRefreshSignal.value = now;
        
        // Update metadata
        if (response.metadata) {
          hasRecentChangesSignal.value = response.metadata.hasRecentChanges;
          this.lastChangeTimestamp = response.metadata.lastChangeTimestamp;
        }
        
        // Show subtle notification if there were visible changes
        if (hasVisibleChanges && this.userContext) {
          this.showSubtleUpdateNotification();
        }
      });
      
      // Restore user context after update
      this.restoreUserContext();
    } catch (error) {
      // Silent degradation for background refresh
      console.debug('Background refresh failed, will retry:', error);
      
      // Retry with exponential backoff if online
      if (this.connectionManager.isOnline.value) {
        this.connectionManager.reconnectWithBackoff(() => this.refreshWithContext());
      }
    } finally {
      isRefreshingSignal.value = false;
    }
  }

  private scheduleBackgroundRefresh(delay: number): void {
    // Cancel any pending refresh
    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout);
    }
    
    // Adjust delay based on connection quality
    const quality = this.connectionManager.connectionQuality.value;
    if (quality === 'poor') {
      delay = Math.max(delay * 2, 5000);
    } else if (quality === 'offline') {
      return; // Don't schedule refresh when offline
    }
    
    this.refreshTimeout = setTimeout(() => {
      this.refreshWithContext();
    }, delay);
  }

  private getRefreshDelay(priority: 'high' | 'medium' | 'low'): number {
    const quality = this.connectionManager.connectionQuality.value;
    
    if (priority === 'high') {
      return quality === 'poor' ? 500 : 100;
    } else if (priority === 'medium') {
      return quality === 'poor' ? 2000 : 500;
    } else {
      return quality === 'poor' ? 5000 : 1000;
    }
  }

  private saveUserContext(): void {
    const selectedGroups = new Set<string>();
    const expandedGroups = new Set<string>();
    
    // Save selections (would be tracked by UI components)
    document.querySelectorAll('[data-selected="true"]').forEach(el => {
      const groupId = el.getAttribute('data-group-id');
      if (groupId) selectedGroups.add(groupId);
    });
    
    // Save expanded state
    document.querySelectorAll('[data-expanded="true"]').forEach(el => {
      const groupId = el.getAttribute('data-group-id');
      if (groupId) expandedGroups.add(groupId);
    });
    
    this.userContext = {
      scrollPosition: window.scrollY,
      selectedGroupIds: selectedGroups,
      expandedGroupIds: expandedGroups,
      focusedElementId: document.activeElement?.id || null,
      formData: this.captureFormData()
    };
  }

  private restoreUserContext(): void {
    if (!this.userContext) return;
    
    // Restore scroll position
    requestAnimationFrame(() => {
      window.scrollTo({
        top: this.userContext!.scrollPosition,
        behavior: 'instant'
      });
    });
    
    // Restore selections
    this.userContext.selectedGroupIds.forEach(groupId => {
      const el = document.querySelector(`[data-group-id="${groupId}"]`);
      if (el) el.setAttribute('data-selected', 'true');
    });
    
    // Restore expanded state
    this.userContext.expandedGroupIds.forEach(groupId => {
      const el = document.querySelector(`[data-group-id="${groupId}"]`);
      if (el) el.setAttribute('data-expanded', 'true');
    });
    
    // Restore focus
    if (this.userContext.focusedElementId) {
      const el = document.getElementById(this.userContext.focusedElementId);
      if (el && el instanceof HTMLElement) {
        el.focus();
      }
    }
    
    // Restore form data
    this.restoreFormData(this.userContext.formData);
  }

  private captureFormData(): Map<string, any> {
    const formData = new Map<string, any>();
    
    document.querySelectorAll('input, textarea, select').forEach(el => {
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
        if (el.name || el.id) {
          formData.set(el.name || el.id, el.value);
        }
      }
    });
    
    return formData;
  }

  private restoreFormData(formData: Map<string, any>): void {
    formData.forEach((value, key) => {
      const el = document.querySelector(`[name="${key}"], #${key}`) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
      if (el && el.value !== value) {
        el.value = value;
        // Trigger input event for Preact signals
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
  }

  private mergeWithOptimisticUpdates(serverData: Group[]): Group[] {
    return serverData.map(group => {
      const optimistic = this.optimisticUpdates.get(group.id);
      if (optimistic) {
        // Merge optimistic updates with server data
        return { ...group, ...optimistic.data };
      }
      return group;
    });
  }

  private detectConflicts(serverData: Group[]): Array<{ groupId: string; serverData: Group; localData: Partial<Group> }> {
    const conflicts: Array<{ groupId: string; serverData: Group; localData: Partial<Group> }> = [];
    
    serverData.forEach(serverGroup => {
      const optimistic = this.optimisticUpdates.get(serverGroup.id);
      if (optimistic) {
        // Check if server has different values for optimistically updated fields
        let hasConflict = false;
        Object.keys(optimistic.data).forEach(key => {
          if (serverGroup[key as keyof Group] !== optimistic.data[key as keyof Group]) {
            hasConflict = true;
          }
        });
        
        if (hasConflict) {
          conflicts.push({
            groupId: serverGroup.id,
            serverData: serverGroup,
            localData: optimistic.data
          });
        }
      }
    });
    
    return conflicts;
  }

  private handleConflicts(conflicts: Array<{ groupId: string; serverData: Group; localData: Partial<Group> }>): void {
    conflicts.forEach(conflict => {
      // For now, server wins - clear optimistic update
      this.optimisticUpdates.delete(conflict.groupId);
      
      // In a production app, we might show a conflict resolution dialog
      console.warn('Conflict detected for group', conflict.groupId, 'Server data will be used');
    });
  }

  private detectVisibleChanges(oldGroups: Group[], newGroups: Group[]): boolean {
    // Check if groups were added or removed
    if (oldGroups.length !== newGroups.length) {
      return true;
    }
    
    // Check for significant field changes
    const significantFields = ['name', 'balance', 'memberIds', 'lastActivity'];
    
    for (let i = 0; i < oldGroups.length; i++) {
      const oldGroup = oldGroups[i];
      const newGroup = newGroups.find(g => g.id === oldGroup.id);
      
      if (!newGroup) {
        return true; // Group was removed
      }
      
      for (const field of significantFields) {
        if (JSON.stringify(oldGroup[field as keyof Group]) !== JSON.stringify(newGroup[field as keyof Group])) {
          return true;
        }
      }
    }
    
    return false;
  }

  private showSubtleUpdateNotification(): void {
    // Create a subtle notification element
    const notification = document.createElement('div');
    notification.className = 'fixed bottom-4 right-4 bg-blue-50 text-blue-700 px-4 py-2 rounded-lg shadow-md z-50 animate-slide-up';
    notification.textContent = 'Content updated';
    
    document.body.appendChild(notification);
    
    // Remove after 3 seconds
    setTimeout(() => {
      notification.classList.add('animate-fade-out');
      setTimeout(() => {
        document.body.removeChild(notification);
      }, 300);
    }, 3000);
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
      hasRecentChangesSignal.value = false;
    });
    
    this.optimisticUpdates.clear();
    this.userContext = null;
    this.dispose();
  }

  dispose(): void {
    if (this.changeUnsubscribe) {
      this.changeUnsubscribe();
      this.changeUnsubscribe = null;
    }
    
    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout);
      this.refreshTimeout = null;
    }
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

export const enhancedGroupsStore = new EnhancedGroupsStoreImpl();