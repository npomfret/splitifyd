/**
 * Join GroupDTO Store
 *
 * Manages the state for joining a group via share link
 */

import { ReadonlySignal, signal } from '@preact/signals';
import { GroupDTO, JoinGroupResponse, MemberStatus } from '@splitifyd/shared';
import { DisplayName } from '@splitifyd/shared';
import { apiClient } from '../apiClient';
import {toGroupId} from "@splitifyd/shared";

class JoinGroupStore {
    // Private signals - encapsulated within the class
    readonly #groupSignal = signal<GroupDTO | null>(null);
    readonly #memberCountSignal = signal<number>(0);
    readonly #loadingPreviewSignal = signal<boolean>(false);
    readonly #joiningSignal = signal<boolean>(false);
    readonly #joinSuccessSignal = signal<boolean>(false);
    readonly #errorSignal = signal<string | null>(null);
    readonly #linkIdSignal = signal<string | null>(null);
    readonly #isAlreadyMemberSignal = signal<boolean>(false);
    readonly #displayNameConflictSignal = signal<boolean>(false);
    readonly #joinedGroupIdSignal = signal<string | null>(null);
    readonly #updatingDisplayNameSignal = signal<boolean>(false);
    readonly #displayNameUpdateErrorSignal = signal<string | null>(null);
    readonly #memberStatusSignal = signal<MemberStatus | null>(null);

    // State getters - readonly values for external consumers
    get group() {
        return this.#groupSignal.value;
    }
    get memberCount() {
        return this.#memberCountSignal.value;
    }
    get loadingPreview() {
        return this.#loadingPreviewSignal.value;
    }
    get joining() {
        return this.#joiningSignal.value;
    }
    get joinSuccess() {
        return this.#joinSuccessSignal.value;
    }
    get error() {
        return this.#errorSignal.value;
    }
    get linkId() {
        return this.#linkIdSignal.value;
    }
    get isAlreadyMember() {
        return this.#isAlreadyMemberSignal.value;
    }
    get displayNameConflict() {
        return this.#displayNameConflictSignal.value;
    }
    get joinedGroupId() {
        return this.#joinedGroupIdSignal.value;
    }
    get updatingDisplayName() {
        return this.#updatingDisplayNameSignal.value;
    }
    get displayNameUpdateError() {
        return this.#displayNameUpdateErrorSignal.value;
    }
    get memberStatus() {
        return this.#memberStatusSignal.value;
    }

    get errorSignal(): ReadonlySignal<string | null> {
        return this.#errorSignal;
    }

    async loadGroupPreview(linkId: string) {
        this.#loadingPreviewSignal.value = true;
        this.#errorSignal.value = null;
        this.#linkIdSignal.value = linkId;

        try {
            // Load preview data without joining the group
            const preview = await apiClient.previewGroupByLink(linkId);

            // Transform preview data to GroupDTO interface
            const group: GroupDTO = {
                id: preview.groupId,
                name: preview.groupName,
                description: preview.groupDescription,
                createdBy: '', // Will be populated from server
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                permissions: {
                    expenseEditing: 'anyone' as const,
                    expenseDeletion: 'anyone' as const,
                    memberInvitation: 'anyone' as const,
                    memberApproval: 'automatic' as const,
                    settingsManagement: 'anyone' as const,
                },
                balance: {
                    balancesByCurrency: {},
                },
                lastActivity: 'Never',
                deletedAt: null,
            };

            this.#groupSignal.value = group;
            this.#memberCountSignal.value = preview.memberCount;
            this.#isAlreadyMemberSignal.value = preview.isAlreadyMember;
            this.#loadingPreviewSignal.value = false;
            this.#memberStatusSignal.value = null;

            // Don't auto-redirect if user is already a member - let them see the UI and click "Go to Group"
        } catch (error: any) {
            this.#loadingPreviewSignal.value = false;

            if (error.code === 'INVALID_LINK' || error.code === 'LINK_EXPIRED') {
                this.#errorSignal.value = 'This invitation link is invalid or has expired';
            } else if (error.code === 'GROUP_NOT_FOUND') {
                this.#errorSignal.value = 'This group no longer exists';
            } else {
                this.#errorSignal.value = error.message || 'Failed to load group information';
            }
        }
    }

    async joinGroup(linkId: string): Promise<JoinGroupResponse | null> {
        this.#joiningSignal.value = true;
        this.#errorSignal.value = null;
        this.#displayNameConflictSignal.value = false;
        this.#displayNameUpdateErrorSignal.value = null;

        try {
            const response = await apiClient.joinGroupByLink(linkId);
            this.#joinedGroupIdSignal.value = response.groupId;
            this.#displayNameConflictSignal.value = response.displayNameConflict;
            this.#joiningSignal.value = false;
            this.#memberStatusSignal.value = response.memberStatus;
            if (response.displayNameConflict) {
                // Conflict will be handled by UI prompting for a new name
                this.#joinSuccessSignal.value = false;
                return response;
            }

            // Preserve existing preview details but ensure IDs/names match response
            if (this.#groupSignal.value) {
                this.#groupSignal.value = {
                    ...this.#groupSignal.value,
                    id: response.groupId,
                    name: response.groupName,
                };
            } else {
                this.#groupSignal.value = {
                    id: response.groupId,
                    name: response.groupName,
                    description: '',
                    createdBy: '',
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    permissions: {
                        expenseEditing: 'anyone',
                        expenseDeletion: 'anyone',
                        memberInvitation: 'anyone',
                        memberApproval: 'automatic',
                        settingsManagement: 'anyone',
                    },
                    balance: {
                        balancesByCurrency: {},
                    },
                    lastActivity: 'Never',
                    deletedAt: null,
                };
            }

            this.#joinSuccessSignal.value = response.success;
            return response;
        } catch (error: any) {
            let errorMessage = 'Failed to join group';

            if (error.code === 'ALREADY_MEMBER') {
                errorMessage = 'You are already a member of this group';
            } else if (error.code === 'INVALID_LINK' || error.code === 'LINK_EXPIRED') {
                errorMessage = 'This invitation link is invalid or has expired';
            } else if (error.code === 'GROUP_NOT_FOUND') {
                errorMessage = 'This group no longer exists';
            } else if (error.code === 'CONCURRENT_UPDATE') {
                errorMessage = 'The group was being updated by another user. Please try again.';
            } else if (error.message) {
                errorMessage = error.message;
            }

            this.#joiningSignal.value = false;
            this.#errorSignal.value = errorMessage;
            this.#memberStatusSignal.value = null;
            return null;
        }
    }

    reset() {
        this.#groupSignal.value = null;
        this.#memberCountSignal.value = 0;
        this.#loadingPreviewSignal.value = false;
        this.#joiningSignal.value = false;
        this.#joinSuccessSignal.value = false;
        this.#errorSignal.value = null;
        this.#linkIdSignal.value = null;
        this.#isAlreadyMemberSignal.value = false;
        this.#displayNameConflictSignal.value = false;
        this.#joinedGroupIdSignal.value = null;
        this.#updatingDisplayNameSignal.value = false;
        this.#displayNameUpdateErrorSignal.value = null;
        this.#memberStatusSignal.value = null;
    }

    clearError() {
        this.#errorSignal.value = null;
    }

    async resolveDisplayNameConflict(displayName: DisplayName): Promise<void> {
        if (!this.#joinedGroupIdSignal.value) {
            throw new Error('No group joined yet');
        }

        this.#updatingDisplayNameSignal.value = true;
        this.#displayNameUpdateErrorSignal.value = null;

        try {
            await apiClient.updateGroupMemberDisplayName(toGroupId(this.#joinedGroupIdSignal.value), displayName);

            this.#displayNameConflictSignal.value = false;
            this.#joinSuccessSignal.value = true;
            this.#memberStatusSignal.value = 'active';
        } catch (error: any) {
            this.#displayNameUpdateErrorSignal.value = error?.message || 'Failed to update display name';
            throw error;
        } finally {
            this.#updatingDisplayNameSignal.value = false;
        }
    }

    markConflictCancelled() {
        this.#displayNameConflictSignal.value = false;
        this.#joinSuccessSignal.value = true;
        this.#updatingDisplayNameSignal.value = false;
        this.#displayNameUpdateErrorSignal.value = null;
        this.#memberStatusSignal.value = 'active';
    }

    clearDisplayNameError() {
        this.#displayNameUpdateErrorSignal.value = null;
    }
}

// Export a singleton instance
export const joinGroupStore = new JoinGroupStore();
