/**
 * Join Group Store
 *
 * Manages the state for joining a group via share link
 */

import { signal, ReadonlySignal } from '@preact/signals';
import { apiClient } from '../apiClient';
import type { Group } from '@splitifyd/shared';

class JoinGroupStore {
    // Private signals - encapsulated within the class
    readonly #groupSignal = signal<Group | null>(null);
    readonly #memberCountSignal = signal<number>(0);
    readonly #loadingPreviewSignal = signal<boolean>(false);
    readonly #joiningSignal = signal<boolean>(false);
    readonly #joinSuccessSignal = signal<boolean>(false);
    readonly #errorSignal = signal<string | null>(null);
    readonly #linkIdSignal = signal<string | null>(null);

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

    // Signal accessors for reactive components - return readonly signals
    get groupSignal(): ReadonlySignal<Group | null> {
        return this.#groupSignal;
    }
    get memberCountSignal(): ReadonlySignal<number> {
        return this.#memberCountSignal;
    }
    get loadingPreviewSignal(): ReadonlySignal<boolean> {
        return this.#loadingPreviewSignal;
    }
    get joiningSignal(): ReadonlySignal<boolean> {
        return this.#joiningSignal;
    }
    get joinSuccessSignal(): ReadonlySignal<boolean> {
        return this.#joinSuccessSignal;
    }
    get errorSignal(): ReadonlySignal<string | null> {
        return this.#errorSignal;
    }
    get linkIdSignal(): ReadonlySignal<string | null> {
        return this.#linkIdSignal;
    }

    async loadGroupPreview(linkId: string) {
        this.#loadingPreviewSignal.value = true;
        this.#errorSignal.value = null;
        this.#linkIdSignal.value = linkId;

        try {
            // Load preview data without joining the group
            const preview = await apiClient.previewGroupByLink(linkId);

            // Transform preview data to Group interface
            const group: Group = {
                id: preview.groupId,
                name: preview.groupName,
                description: preview.groupDescription,
                createdBy: '', // Will be populated from server
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                securityPreset: 'open' as const,
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
                lastActivityRaw: new Date().toISOString(),
            };

            this.#groupSignal.value = group;
            this.#memberCountSignal.value = preview.memberCount;
            this.#loadingPreviewSignal.value = false;

            // If user is already a member, redirect them to the group
            if (preview.isAlreadyMember) {
                this.#joinSuccessSignal.value = true;
            }
        } catch (error: any) {
            this.#loadingPreviewSignal.value = false;

            if (error.code === 'INVALID_LINK') {
                this.#errorSignal.value = 'This invitation link is invalid or has expired';
            } else if (error.code === 'GROUP_NOT_FOUND') {
                this.#errorSignal.value = 'This group no longer exists';
            } else {
                this.#errorSignal.value = error.message || 'Failed to load group information';
            }
        }
    }

    async joinGroup(linkId: string): Promise<Group | null> {
        this.#joiningSignal.value = true;
        this.#errorSignal.value = null;

        try {
            const group = await apiClient.joinGroupByLink(linkId);
            this.#groupSignal.value = group;
            this.#joiningSignal.value = false;
            this.#joinSuccessSignal.value = true;
            return group;
        } catch (error: any) {
            let errorMessage = 'Failed to join group';

            if (error.code === 'ALREADY_MEMBER') {
                errorMessage = 'You are already a member of this group';
            } else if (error.code === 'INVALID_LINK') {
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
    }

    clearError() {
        this.#errorSignal.value = null;
    }
}

// Export a singleton instance
export const joinGroupStore = new JoinGroupStore();
