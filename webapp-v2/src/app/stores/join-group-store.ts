/**
 * Join Group Store
 * 
 * Manages the state for joining a group via share link
 */

import { signal } from '@preact/signals';
import { apiClient } from '../apiClient';
import type { Group } from '../../types/webapp-shared-types';

// Signals for join group state
const groupSignal = signal<Group | null>(null);
const loadingPreviewSignal = signal<boolean>(false);
const joiningSignal = signal<boolean>(false);
const joinSuccessSignal = signal<boolean>(false);
const errorSignal = signal<string | null>(null);
const linkIdSignal = signal<string | null>(null);

class JoinGroupStore {
  // State getters
  get group() { return groupSignal.value; }
  get loadingPreview() { return loadingPreviewSignal.value; }
  get joining() { return joiningSignal.value; }
  get joinSuccess() { return joinSuccessSignal.value; }
  get error() { return errorSignal.value; }
  get linkId() { return linkIdSignal.value; }

  async loadGroupPreview(linkId: string) {
    loadingPreviewSignal.value = true;
    errorSignal.value = null;
    linkIdSignal.value = linkId;
    
    try {
      // Since there's no preview endpoint, we'll attempt to join and handle the ALREADY_MEMBER case
      // This will validate the link and give us group info
      const group = await apiClient.joinGroupByLink(linkId);
      groupSignal.value = group;
      loadingPreviewSignal.value = false;
      joinSuccessSignal.value = true;
    } catch (error: any) {
      // Handle different error cases
      if (error.code === 'ALREADY_MEMBER') {
        // User is already a member - we can still show the group preview
        // We need to get group info another way. For now, show error but allow join flow
        loadingPreviewSignal.value = false;
        errorSignal.value = 'You are already a member of this group';
      } else if (error.code === 'INVALID_LINK') {
        loadingPreviewSignal.value = false;
        errorSignal.value = 'This invitation link is invalid or has expired';
      } else if (error.code === 'GROUP_NOT_FOUND') {
        loadingPreviewSignal.value = false;
        errorSignal.value = 'This group no longer exists';
      } else {
        loadingPreviewSignal.value = false;
        errorSignal.value = error.message || 'Failed to load group information';
      }
    }
  }

  async joinGroup(linkId: string): Promise<Group | null> {
    joiningSignal.value = true;
    errorSignal.value = null;
    
    try {
      const group = await apiClient.joinGroupByLink(linkId);
      groupSignal.value = group;
      joiningSignal.value = false;
      joinSuccessSignal.value = true;
      return group;
    } catch (error: any) {
      let errorMessage = 'Failed to join group';
      
      if (error.code === 'ALREADY_MEMBER') {
        errorMessage = 'You are already a member of this group';
      } else if (error.code === 'INVALID_LINK') {
        errorMessage = 'This invitation link is invalid or has expired';
      } else if (error.code === 'GROUP_NOT_FOUND') {
        errorMessage = 'This group no longer exists';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      joiningSignal.value = false;
      errorSignal.value = errorMessage;
      return null;
    }
  }

  reset() {
    groupSignal.value = null;
    loadingPreviewSignal.value = false;
    joiningSignal.value = false;
    joinSuccessSignal.value = false;
    errorSignal.value = null;
    linkIdSignal.value = null;
  }

  clearError() {
    errorSignal.value = null;
  }
}

// Export a singleton instance
export const joinGroupStore = new JoinGroupStore();