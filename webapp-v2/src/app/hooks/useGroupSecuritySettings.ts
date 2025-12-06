import { apiClient } from '@/app/apiClient.ts';
import { useSuccessMessage } from '@/app/hooks/useSuccessMessage.ts';
import { logError } from '@/utils/browser-logger.ts';
import { GroupDTO, GroupMember, GroupMembershipDTO, GroupPermissions, MemberRole, PermissionLevels, SecurityPreset, UserId } from '@billsplit-wl/shared';
import { ReadonlySignal, signal } from '@preact/signals';
import { TFunction } from 'i18next';
import { useCallback, useEffect, useMemo, useState } from 'preact/hooks';

const PRESET_PERMISSIONS: Record<Exclude<SecurityPreset, 'custom'>, GroupPermissions> = {
    open: {
        expenseEditing: PermissionLevels.ANYONE,
        expenseDeletion: PermissionLevels.ANYONE,
        memberInvitation: PermissionLevels.ANYONE,
        memberApproval: 'automatic',
        settingsManagement: PermissionLevels.ANYONE,
    },
    managed: {
        expenseEditing: PermissionLevels.OWNER_AND_ADMIN,
        expenseDeletion: PermissionLevels.OWNER_AND_ADMIN,
        memberInvitation: PermissionLevels.ADMIN_ONLY,
        memberApproval: 'admin-required',
        settingsManagement: PermissionLevels.ADMIN_ONLY,
    },
};

type ManagedPreset = keyof typeof PRESET_PERMISSIONS;

export const permissionOrder: Array<keyof GroupPermissions> = [
    'expenseEditing',
    'expenseDeletion',
    'memberInvitation',
    'memberApproval',
    'settingsManagement',
];

export const permissionOptions: Record<keyof GroupPermissions, string[]> = {
    expenseEditing: [PermissionLevels.ANYONE, PermissionLevels.OWNER_AND_ADMIN, PermissionLevels.ADMIN_ONLY],
    expenseDeletion: [PermissionLevels.ANYONE, PermissionLevels.OWNER_AND_ADMIN, PermissionLevels.ADMIN_ONLY],
    memberInvitation: [PermissionLevels.ANYONE, PermissionLevels.ADMIN_ONLY],
    memberApproval: ['automatic', 'admin-required'],
    settingsManagement: [PermissionLevels.ANYONE, PermissionLevels.ADMIN_ONLY],
};

function determinePreset(permissions: GroupPermissions): ManagedPreset | 'custom' {
    const managedKeys = Object.keys(PRESET_PERMISSIONS) as ManagedPreset[];
    for (const preset of managedKeys) {
        const defaults = PRESET_PERMISSIONS[preset];
        const matches = permissionOrder.every((key) => defaults[key] === permissions[key]);
        if (matches) {
            return preset;
        }
    }
    return 'custom';
}

interface UseGroupSecuritySettingsOptions {
    group: GroupDTO;
    members: GroupMember[];
    isOpen: boolean;
    securityTabAvailable: boolean;
    canManageMembers: boolean;
    canApproveMembers: boolean;
    t: TFunction;
    onGroupUpdated?: () => Promise<void> | void;
}

interface UseGroupSecuritySettingsResult {
    // Permission state
    permissionDraft: GroupPermissions;
    selectedPreset: ManagedPreset | 'custom';
    isSaving: boolean;
    hasPermissionChanges: boolean;
    hasRoleChanges: boolean;
    hasSecurityChanges: boolean;
    successMessage: ReadonlySignal<string | null>;
    actionError: string | null;

    // Member roles
    memberRoleDrafts: Record<string, MemberRole>;

    // Pending members
    pendingMembers: GroupMembershipDTO[];
    loadingPending: boolean;
    pendingError: string | null;
    pendingActionMember: string | null;

    // Actions
    applyPreset: (preset: ManagedPreset) => void;
    saveSecuritySettings: () => Promise<void>;
    handlePermissionChange: (key: keyof GroupPermissions, value: string) => void;
    updateMemberRoleDraft: (memberId: string, newRole: MemberRole) => void;
    handlePendingAction: (memberId: UserId, action: 'approve' | 'reject') => Promise<void>;

    // Constants for rendering
    presetKeys: ManagedPreset[];
}

export function useGroupSecuritySettings({
    group,
    members,
    isOpen,
    securityTabAvailable,
    canManageMembers,
    canApproveMembers,
    t,
    onGroupUpdated,
}: UseGroupSecuritySettingsOptions): UseGroupSecuritySettingsResult {
    const [permissionDraftSignal] = useState(() => signal<GroupPermissions>({ ...group.permissions }));
    const [selectedPresetSignal] = useState(() => signal<ManagedPreset | 'custom'>(determinePreset(group.permissions)));
    const [isSavingSecuritySignal] = useState(() => signal(false));
    const [pendingMembersSignal] = useState(() => signal<GroupMembershipDTO[]>([]));
    const [loadingPendingSignal] = useState(() => signal(false));
    const [pendingErrorSignal] = useState(() => signal<string | null>(null));
    const [actionErrorSignal] = useState(() => signal<string | null>(null));
    const [pendingActionMemberSignal] = useState(() => signal<string | null>(null));
    const [initialPermissionsSignal] = useState(() => signal<GroupPermissions>({ ...group.permissions }));
    const [memberRoleDraftsSignal] = useState(() => signal<Record<string, MemberRole>>({}));
    const [initialMemberRolesSignal] = useState(() => signal<Record<string, MemberRole>>({}));
    const permissionsSuccess = useSuccessMessage();

    const loadPendingMembers = useCallback(async () => {
        if (!canApproveMembers) {
            return;
        }

        loadingPendingSignal.value = true;
        pendingErrorSignal.value = null;
        try {
            const results = await apiClient.getPendingMembers(group.id);
            pendingMembersSignal.value = results;
        } catch (error) {
            logError('Failed to load pending members', error, { groupId: group.id });
            pendingErrorSignal.value = t('securitySettingsModal.errors.loadPending');
        } finally {
            loadingPendingSignal.value = false;
        }
    }, [canApproveMembers, group.id, t]);

    // Initialize security state when modal opens
    useEffect(() => {
        if (!isOpen || !securityTabAvailable) {
            return;
        }

        const roleMap: Record<string, MemberRole> = {};
        members.forEach((member) => {
            roleMap[member.uid] = member.memberRole;
        });

        permissionDraftSignal.value = { ...group.permissions };
        initialPermissionsSignal.value = { ...group.permissions };
        selectedPresetSignal.value = determinePreset(group.permissions);
        actionErrorSignal.value = null;
        memberRoleDraftsSignal.value = roleMap;
        initialMemberRolesSignal.value = roleMap;

        if (canApproveMembers) {
            loadPendingMembers();
        } else {
            pendingMembersSignal.value = [];
        }
    }, [isOpen, securityTabAvailable, group.permissions, members, canApproveMembers, loadPendingMembers]);

    // Clear success message when modal closes
    useEffect(() => {
        if (!isOpen) {
            permissionsSuccess.clearMessage();
        }
    }, [isOpen, permissionsSuccess]);

    const hasPermissionChanges = useMemo(() => {
        return permissionOrder.some((key) => permissionDraftSignal.value[key] !== initialPermissionsSignal.value[key]);
    }, [permissionDraftSignal.value, initialPermissionsSignal.value]);

    const hasRoleChanges = useMemo(() => {
        return members.some(
            (member) =>
                memberRoleDraftsSignal.value[member.uid] !== undefined
                && memberRoleDraftsSignal.value[member.uid] !== initialMemberRolesSignal.value[member.uid],
        );
    }, [members, memberRoleDraftsSignal.value, initialMemberRolesSignal.value]);

    const hasSecurityChanges = hasPermissionChanges || hasRoleChanges;

    const applyPreset = useCallback((preset: ManagedPreset) => {
        permissionsSuccess.clearMessage();
        actionErrorSignal.value = null;
        const updatedPermissions = { ...PRESET_PERMISSIONS[preset] };
        permissionDraftSignal.value = updatedPermissions;
        selectedPresetSignal.value = preset;
    }, [permissionsSuccess]);

    const saveSecuritySettings = useCallback(async () => {
        if (!hasSecurityChanges) {
            return;
        }

        isSavingSecuritySignal.value = true;
        actionErrorSignal.value = null;
        try {
            const updatedPermissions = { ...permissionDraftSignal.value };
            if (hasPermissionChanges) {
                await apiClient.updateGroupPermissions(group.id, updatedPermissions);
            }

            if (hasRoleChanges) {
                for (const member of members) {
                    const draftRole = memberRoleDraftsSignal.value[member.uid];
                    if (draftRole && draftRole !== initialMemberRolesSignal.value[member.uid]) {
                        await apiClient.updateMemberRole(group.id, member.uid, draftRole);
                    }
                }
            }

            await onGroupUpdated?.();

            initialPermissionsSignal.value = updatedPermissions;
            selectedPresetSignal.value = determinePreset(updatedPermissions);

            const nextRoleState: Record<string, MemberRole> = {};
            members.forEach((member) => {
                const draftRole = memberRoleDraftsSignal.value[member.uid];
                nextRoleState[member.uid] = draftRole ?? member.memberRole;
            });
            initialMemberRolesSignal.value = nextRoleState;
            memberRoleDraftsSignal.value = nextRoleState;

            permissionsSuccess.showSuccess(t('securitySettingsModal.success.updated'));
        } catch (error) {
            logError('Failed to update security settings', error, { groupId: group.id });
            actionErrorSignal.value = t('securitySettingsModal.errors.updatePermissions');
        } finally {
            isSavingSecuritySignal.value = false;
        }
    }, [hasSecurityChanges, hasPermissionChanges, hasRoleChanges, group.id, members, t, onGroupUpdated, permissionsSuccess]);

    const handlePermissionChange = useCallback((key: keyof GroupPermissions, value: string) => {
        permissionsSuccess.clearMessage();
        permissionDraftSignal.value = {
            ...permissionDraftSignal.value,
            [key]: value,
        };
        selectedPresetSignal.value = 'custom';
    }, [permissionsSuccess]);

    const updateMemberRoleDraft = useCallback((memberId: string, newRole: MemberRole) => {
        permissionsSuccess.clearMessage();
        memberRoleDraftsSignal.value = {
            ...memberRoleDraftsSignal.value,
            [memberId]: newRole,
        };
    }, [permissionsSuccess]);

    const handlePendingAction = useCallback(async (memberId: UserId, action: 'approve' | 'reject') => {
        pendingActionMemberSignal.value = memberId;
        actionErrorSignal.value = null;
        try {
            if (action === 'approve') {
                await apiClient.approveMember(group.id, memberId);
            } else {
                await apiClient.rejectMember(group.id, memberId);
            }
            await loadPendingMembers();
            await onGroupUpdated?.();
        } catch (error) {
            logError('Failed to process pending member', error, { memberId, action, groupId: group.id });
            actionErrorSignal.value = t('securitySettingsModal.errors.pendingAction');
        } finally {
            pendingActionMemberSignal.value = null;
        }
    }, [group.id, t, loadPendingMembers, onGroupUpdated]);

    return {
        permissionDraft: permissionDraftSignal.value,
        selectedPreset: selectedPresetSignal.value,
        isSaving: isSavingSecuritySignal.value,
        hasPermissionChanges,
        hasRoleChanges,
        hasSecurityChanges,
        successMessage: permissionsSuccess.message,
        actionError: actionErrorSignal.value,
        memberRoleDrafts: memberRoleDraftsSignal.value,
        pendingMembers: pendingMembersSignal.value,
        loadingPending: loadingPendingSignal.value,
        pendingError: pendingErrorSignal.value,
        pendingActionMember: pendingActionMemberSignal.value,
        applyPreset,
        saveSecuritySettings,
        handlePermissionChange,
        updateMemberRoleDraft,
        handlePendingAction,
        presetKeys: Object.keys(PRESET_PERMISSIONS) as ManagedPreset[],
    };
}
