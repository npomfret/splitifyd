/**
 * Join GroupDTO Store
 *
 * Manages the state for joining a group via share link
 */

import i18n from '@/i18n';
import { translateApiError } from '@/utils/error-translation';
import { GroupDTO, JoinGroupResponse, MemberStatus } from '@billsplit-wl/shared';
import { DisplayName } from '@billsplit-wl/shared';
import { toISOString } from '@billsplit-wl/shared';
import { toUserId } from '@billsplit-wl/shared';
import { ReadonlySignal, signal } from '@preact/signals';
import { apiClient } from '../apiClient';

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
    get joinedGroupId() {
        return this.#joinedGroupIdSignal.value;
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
                createdBy: toUserId(''), // Will be populated from server
                createdAt: toISOString(new Date().toISOString()),
                updatedAt: toISOString(new Date().toISOString()),
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
        } catch (error: unknown) {
            this.#loadingPreviewSignal.value = false;
            const t = i18n.t.bind(i18n);
            const errorWithCode = error as { code?: string; };

            if (errorWithCode.code === 'INVALID_LINK' || errorWithCode.code === 'LINK_EXPIRED') {
                this.#errorSignal.value = t('joinGroupPage.errors.invalidLink');
            } else if (errorWithCode.code === 'GROUP_NOT_FOUND') {
                this.#errorSignal.value = t('joinGroupPage.errors.groupNotFound');
            } else {
                this.#errorSignal.value = translateApiError(error, t, t('joinGroupPage.errors.loadFailed'));
            }
        }
    }

    async joinGroup(linkId: string, groupDisplayName: DisplayName): Promise<JoinGroupResponse | null> {
        this.#joiningSignal.value = true;
        this.#errorSignal.value = null;
        this.#displayNameConflictSignal.value = false;
        this.#displayNameUpdateErrorSignal.value = null;

        try {
            const response = await apiClient.joinGroupByLink(linkId, groupDisplayName);
            this.#joinedGroupIdSignal.value = response.groupId;
            this.#joiningSignal.value = false;
            this.#memberStatusSignal.value = response.memberStatus;

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
                    createdBy: toUserId(''),
                    createdAt: toISOString(new Date().toISOString()),
                    updatedAt: toISOString(new Date().toISOString()),
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

            this.#joinSuccessSignal.value = response.memberStatus === 'active';
            return response;
        } catch (error: unknown) {
            const t = i18n.t.bind(i18n);
            const errorWithCode = error as { code?: string; message?: string; };
            let errorMessage: string;

            if (errorWithCode.code === 'DISPLAY_NAME_CONFLICT') {
                // Re-throw conflict errors so the UI can handle them specially
                this.#joiningSignal.value = false;
                throw error;
            } else if (errorWithCode.code === 'ALREADY_MEMBER') {
                errorMessage = t('joinGroupPage.errors.alreadyMember');
            } else if (errorWithCode.code === 'INVALID_LINK' || errorWithCode.code === 'LINK_EXPIRED') {
                errorMessage = t('joinGroupPage.errors.invalidLink');
            } else if (errorWithCode.code === 'GROUP_NOT_FOUND') {
                errorMessage = t('joinGroupPage.errors.groupNotFound');
            } else if (errorWithCode.code === 'CONCURRENT_UPDATE') {
                errorMessage = t('apiErrors.CONFLICT');
            } else {
                errorMessage = translateApiError(error, t, t('joinGroupPage.errors.joinFailed'));
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
}

// Export a singleton instance
export const joinGroupStore = new JoinGroupStore();
