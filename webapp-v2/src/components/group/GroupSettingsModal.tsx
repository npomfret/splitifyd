import { apiClient, ApiError } from '@/app/apiClient.ts';
import { useAuthRequired } from '@/app/hooks/useAuthRequired.ts';
import { enhancedGroupDetailStore } from '@/app/stores/group-detail-store-enhanced.ts';
import { Clickable } from '@/components/ui/Clickable';
import { Modal } from '@/components/ui/Modal';
import { logError } from '@/utils/browser-logger.ts';
import { translateApiError } from '@/utils/error-translation';
import { GroupDTO, GroupMember, GroupMembershipDTO, GroupPermissions, MemberRole, PermissionLevels, SecurityPreset, toDisplayName, toGroupName, UserId } from '@billsplit-wl/shared';
import { signal } from '@preact/signals';
import { useComputed } from '@preact/signals';
import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { useTranslation } from 'react-i18next';
import { Button, Form, Input, LoadingSpinner, Tooltip } from '../ui';

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

const permissionOrder: Array<keyof GroupPermissions> = [
    'expenseEditing',
    'expenseDeletion',
    'memberInvitation',
    'memberApproval',
    'settingsManagement',
];

const permissionOptions: Record<keyof GroupPermissions, string[]> = {
    expenseEditing: [PermissionLevels.ANYONE, PermissionLevels.OWNER_AND_ADMIN, PermissionLevels.ADMIN_ONLY],
    expenseDeletion: [PermissionLevels.ANYONE, PermissionLevels.OWNER_AND_ADMIN, PermissionLevels.ADMIN_ONLY],
    memberInvitation: [PermissionLevels.ANYONE, PermissionLevels.ADMIN_ONLY],
    memberApproval: ['automatic', 'admin-required'],
    settingsManagement: [PermissionLevels.ANYONE, PermissionLevels.ADMIN_ONLY],
};

type GroupSettingsTab = 'identity' | 'general' | 'security';

interface GroupSettingsModalProps {
    isOpen: boolean;
    group: GroupDTO;
    members: GroupMember[];
    canManageMembers: boolean;
    canApproveMembers: boolean;
    isGroupOwner: boolean;
    onClose: () => void;
    onGroupUpdated?: () => Promise<void> | void;
    onDelete?: () => void;
    initialTab?: GroupSettingsTab;
}

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

export function GroupSettingsModal({
    isOpen,
    group,
    members,
    canManageMembers,
    canApproveMembers,
    isGroupOwner,
    onClose,
    onGroupUpdated,
    onDelete,
    initialTab = 'general',
}: GroupSettingsModalProps) {
    const { t } = useTranslation();

    const authStore = useAuthRequired();
    const currentUser = useComputed(() => authStore.user);
    const loadingMembers = useComputed(() => enhancedGroupDetailStore.loadingMembers);

    const canManageGeneralSettings = isGroupOwner;
    const generalTabAvailable = canManageGeneralSettings;
    const identityTabAvailable = true;
    const securityTabAvailable = isGroupOwner || canManageMembers || canApproveMembers;

    const availableTabs = useMemo(() => {
        const tabs: GroupSettingsTab[] = [];
        if (identityTabAvailable) {
            tabs.push('identity');
        }
        if (generalTabAvailable) {
            tabs.push('general');
        }
        if (securityTabAvailable) {
            tabs.push('security');
        }
        return tabs;
    }, [identityTabAvailable, generalTabAvailable, securityTabAvailable]);

    const defaultTab = useMemo(() => {
        if (initialTab && availableTabs.includes(initialTab)) {
            return initialTab;
        }
        return availableTabs[0] ?? null;
    }, [availableTabs, initialTab]);

    // Component-local signals - initialized within useState to avoid stale state across instances
    const [activeTabSignal] = useState(() => signal<GroupSettingsTab | null>(defaultTab));

    // General settings state signals
    const [groupNameSignal] = useState(() => signal(''));
    const [groupDescriptionSignal] = useState(() => signal(''));
    const [initialNameSignal] = useState(() => signal(''));
    const [initialDescriptionSignal] = useState(() => signal(''));
    const [isSubmittingSignal] = useState(() => signal(false));
    const [validationErrorSignal] = useState(() => signal<string | null>(null));
    const [showDeleteConfirmSignal] = useState(() => signal(false));
    const [deleteErrorSignal] = useState(() => signal<string | null>(null));
    const [confirmationTextSignal] = useState(() => signal(''));
    const [isDeletingSignal] = useState(() => signal(false));
    const [generalSuccessMessageSignal] = useState(() => signal<string | null>(null));
    const generalSuccessTimerRef = useRef<number | null>(null);

    // Display name settings state signals
    const [displayNameSignal] = useState(() => signal(''));
    const [initialDisplayNameSignal] = useState(() => signal(''));
    const [displayNameValidationErrorSignal] = useState(() => signal<string | null>(null));
    const [displayNameServerErrorSignal] = useState(() => signal<string | null>(null));
    const [displayNameSuccessMessageSignal] = useState(() => signal<string | null>(null));
    const [isSavingDisplayNameSignal] = useState(() => signal(false));
    const displayNameSuccessTimerRef = useRef<number | null>(null);

    // Security settings state signals
    const [permissionDraftSignal] = useState(() => signal<GroupPermissions>({ ...group.permissions }));
    const [selectedPresetSignal] = useState(() => signal<ManagedPreset | 'custom'>(determinePreset(group.permissions)));
    const [isSavingSecuritySignal] = useState(() => signal(false));
    const [pendingMembersSignal] = useState(() => signal<GroupMembershipDTO[]>([]));
    const [loadingPendingSignal] = useState(() => signal(false));
    const [pendingErrorSignal] = useState(() => signal<string | null>(null));
    const [actionErrorSignal] = useState(() => signal<string | null>(null));
    const [pendingActionMemberSignal] = useState(() => signal<string | null>(null));
    const [initialPermissionsSignal] = useState(() => signal<GroupPermissions>({ ...group.permissions }));
    const [permissionsSuccessMessageSignal] = useState(() => signal<string | null>(null));
    const permissionsSuccessTimerRef = useRef<number | null>(null);
    const [memberRoleDraftsSignal] = useState(() => signal<Record<string, MemberRole>>({}));
    const [initialMemberRolesSignal] = useState(() => signal<Record<string, MemberRole>>({}));

    // Extract signal values for use in render
    const activeTab = activeTabSignal.value;
    const groupName = groupNameSignal.value;
    const groupDescription = groupDescriptionSignal.value;
    const initialName = initialNameSignal.value;
    const initialDescription = initialDescriptionSignal.value;
    const isSubmitting = isSubmittingSignal.value;
    const validationError = validationErrorSignal.value;
    const showDeleteConfirm = showDeleteConfirmSignal.value;
    const deleteError = deleteErrorSignal.value;
    const confirmationText = confirmationTextSignal.value;
    const isDeleting = isDeletingSignal.value;
    const generalSuccessMessage = generalSuccessMessageSignal.value;
    const displayName = displayNameSignal.value;
    const initialDisplayName = initialDisplayNameSignal.value;
    const displayNameValidationError = displayNameValidationErrorSignal.value;
    const displayNameServerError = displayNameServerErrorSignal.value;
    const displayNameSuccessMessage = displayNameSuccessMessageSignal.value;
    const isSavingDisplayName = isSavingDisplayNameSignal.value;
    const permissionDraft = permissionDraftSignal.value;
    const selectedPreset = selectedPresetSignal.value;
    const isSavingSecurity = isSavingSecuritySignal.value;
    const pendingMembers = pendingMembersSignal.value;
    const loadingPending = loadingPendingSignal.value;
    const pendingError = pendingErrorSignal.value;
    const actionError = actionErrorSignal.value;
    const pendingActionMember = pendingActionMemberSignal.value;
    const initialPermissions = initialPermissionsSignal.value;
    const permissionsSuccessMessage = permissionsSuccessMessageSignal.value;
    const memberRoleDrafts = memberRoleDraftsSignal.value;
    const initialMemberRoles = initialMemberRolesSignal.value;

    const clearGeneralSuccessMessage = useCallback(() => {
        if (generalSuccessTimerRef.current) {
            window.clearTimeout(generalSuccessTimerRef.current);
            generalSuccessTimerRef.current = null;
        }
        generalSuccessMessageSignal.value = null;
    }, []);

    const showGeneralSuccess = useCallback(
        (message: string) => {
            clearGeneralSuccessMessage();
            generalSuccessMessageSignal.value = message;
            generalSuccessTimerRef.current = window.setTimeout(() => {
                generalSuccessMessageSignal.value = null;
                generalSuccessTimerRef.current = null;
            }, 4000);
        },
        [clearGeneralSuccessMessage],
    );

    const clearPermissionsSuccessMessage = useCallback(() => {
        if (permissionsSuccessTimerRef.current) {
            window.clearTimeout(permissionsSuccessTimerRef.current);
            permissionsSuccessTimerRef.current = null;
        }
        permissionsSuccessMessageSignal.value = null;
    }, []);

    const showPermissionsSuccess = useCallback(
        (message: string) => {
            clearPermissionsSuccessMessage();
            permissionsSuccessMessageSignal.value = message;
            permissionsSuccessTimerRef.current = window.setTimeout(() => {
                permissionsSuccessMessageSignal.value = null;
                permissionsSuccessTimerRef.current = null;
            }, 4000);
        },
        [clearPermissionsSuccessMessage],
    );

    useEffect(() => {
        if (isOpen) {
            activeTabSignal.value = defaultTab;
        }
    }, [isOpen, defaultTab]);

    useEffect(() => {
        return () => {
            if (displayNameSuccessTimerRef.current) {
                window.clearTimeout(displayNameSuccessTimerRef.current);
                displayNameSuccessTimerRef.current = null;
            }
            if (generalSuccessTimerRef.current) {
                window.clearTimeout(generalSuccessTimerRef.current);
                generalSuccessTimerRef.current = null;
            }
            if (permissionsSuccessTimerRef.current) {
                window.clearTimeout(permissionsSuccessTimerRef.current);
                permissionsSuccessTimerRef.current = null;
            }
        };
    }, []);

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        const uid = currentUser.value?.uid;
        if (!uid) {
            return;
        }

        const member = members.find((m) => m.uid === uid);
        if (!member) {
            return;
        }

        const fallbackName = member.groupDisplayName.trim() || currentUser.value?.displayName || '';

        displayNameSignal.value = fallbackName;
        initialDisplayNameSignal.value = fallbackName;
        displayNameValidationErrorSignal.value = null;
        displayNameServerErrorSignal.value = null;
    }, [isOpen, members, currentUser.value]);

    useEffect(() => {
        if (!isOpen) {
            if (displayNameSuccessTimerRef.current) {
                window.clearTimeout(displayNameSuccessTimerRef.current);
                displayNameSuccessTimerRef.current = null;
            }
            clearGeneralSuccessMessage();
            clearPermissionsSuccessMessage();
            return;
        }
    }, [isOpen, clearGeneralSuccessMessage, clearPermissionsSuccessMessage]);

    useEffect(() => {
        if (!isOpen || !canManageGeneralSettings) {
            return;
        }

        // Don't clear success message - let it auto-dismiss via timer
        // This prevents race condition where group refresh clears the message

        initialNameSignal.value = group.name;
        initialDescriptionSignal.value = group.description || '';
        groupNameSignal.value = group.name;
        groupDescriptionSignal.value = group.description || '';
        validationErrorSignal.value = null;
        deleteErrorSignal.value = null;
        showDeleteConfirmSignal.value = false;
        confirmationTextSignal.value = '';
        isDeletingSignal.value = false;
    }, [isOpen, canManageGeneralSettings, group.name, group.description]);

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

    useEffect(() => {
        if (!isOpen || !securityTabAvailable) {
            return;
        }

        // Don't clear success message - let it auto-dismiss via timer
        // This prevents race condition where group refresh clears the message

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

    const validateGeneralForm = (): string | null => {
        const name = groupName.trim();

        if (!name) {
            return t('editGroupModal.validation.nameRequired');
        }

        if (name.length < 2) {
            return t('editGroupModal.validation.nameTooShort');
        }

        if (name.length > 50) {
            return t('editGroupModal.validation.nameTooLong');
        }

        return null;
    };

    const hasGeneralChanges = groupName !== initialName || groupDescription !== initialDescription;
    const isGeneralFormValid = groupName.trim().length >= 2;
    const handleDisplayNameChange = (value: string) => {
        displayNameSignal.value = value;
        if (displayNameValidationError) {
            displayNameValidationErrorSignal.value = null;
        }
        if (displayNameServerError) {
            displayNameServerErrorSignal.value = null;
        }
        if (displayNameSuccessMessage) {
            displayNameSuccessMessageSignal.value = null;
        }
    };

    const handleDisplayNameSubmit = async (event: Event) => {
        event.preventDefault();

        const trimmedName = displayName.trim();

        if (!trimmedName) {
            displayNameValidationErrorSignal.value = t('groupDisplayNameSettings.errors.required');
            return;
        }

        if (trimmedName.length > 50) {
            displayNameValidationErrorSignal.value = t('groupDisplayNameSettings.errors.tooLong');
            return;
        }

        if (trimmedName === initialDisplayName) {
            displayNameValidationErrorSignal.value = t('groupDisplayNameSettings.errors.notChanged');
            return;
        }

        isSavingDisplayNameSignal.value = true;
        displayNameValidationErrorSignal.value = null;
        displayNameServerErrorSignal.value = null;
        displayNameSuccessMessageSignal.value = null;

        try {
            await apiClient.updateGroupMemberDisplayName(group.id, toDisplayName(trimmedName));
            await enhancedGroupDetailStore.refreshAll();
            await onGroupUpdated?.();

            initialDisplayNameSignal.value = trimmedName;
            displayNameSuccessMessageSignal.value = t('groupDisplayNameSettings.success');

            if (displayNameSuccessTimerRef.current) {
                window.clearTimeout(displayNameSuccessTimerRef.current);
            }

            displayNameSuccessTimerRef.current = window.setTimeout(() => {
                displayNameSuccessMessageSignal.value = null;
                displayNameSuccessTimerRef.current = null;
            }, 4000);
        } catch (error: unknown) {
            if (error instanceof ApiError && error.code === 'DISPLAY_NAME_TAKEN') {
                displayNameServerErrorSignal.value = t('groupDisplayNameSettings.errors.taken');
            } else {
                displayNameServerErrorSignal.value = translateApiError(error, t, t('groupDisplayNameSettings.errors.unknown'));
            }
        } finally {
            isSavingDisplayNameSignal.value = false;
        }
    };

    const handleGeneralSubmit = async (event: Event) => {
        event.preventDefault();

        const errorMessage = validateGeneralForm();
        if (errorMessage) {
            validationErrorSignal.value = errorMessage;
            return;
        }

        if (!hasGeneralChanges) {
            return;
        }

        isSubmittingSignal.value = true;
        validationErrorSignal.value = null;

        try {
            const trimmedName = toGroupName(groupName.trim());
            const trimmedDescription = groupDescription.trim();

            await apiClient.updateGroup(group.id, {
                name: trimmedName,
                description: trimmedDescription ? trimmedDescription : undefined,
            });

            initialNameSignal.value = trimmedName;
            initialDescriptionSignal.value = trimmedDescription;
            groupNameSignal.value = trimmedName;
            groupDescriptionSignal.value = trimmedDescription;
            showGeneralSuccess(t('editGroupModal.success.updated'));
            await onGroupUpdated?.();
        } catch (error: unknown) {
            validationErrorSignal.value = translateApiError(error, t, t('editGroupModal.validation.updateFailed'));
        } finally {
            isSubmittingSignal.value = false;
        }
    };

    const handleDeleteClick = () => {
        showDeleteConfirmSignal.value = true;
        deleteErrorSignal.value = null;
        confirmationTextSignal.value = '';
    };

    const handleDeleteConfirm = async () => {
        isDeletingSignal.value = true;
        deleteErrorSignal.value = null;

        try {
            enhancedGroupDetailStore.setDeletingGroup(true);
            showDeleteConfirmSignal.value = false;
            onDelete?.();
            onClose();

            apiClient.deleteGroup(group.id).catch((error) => {
                logError('Group deletion failed after redirect', error, { groupId: group.id });
            });
        } catch (error: unknown) {
            deleteErrorSignal.value = translateApiError(error, t, t('editGroupModal.deleteConfirmDialog.deleteFailed'));
            enhancedGroupDetailStore.setDeletingGroup(false);
            isDeletingSignal.value = false;
        }
    };

    const handleDeleteCancel = () => {
        showDeleteConfirmSignal.value = false;
        deleteErrorSignal.value = null;
        confirmationTextSignal.value = '';
    };

    const hasPermissionChanges = useMemo(() => {
        return permissionOrder.some((key) => permissionDraft[key] !== initialPermissions[key]);
    }, [permissionDraft, initialPermissions]);

    const hasRoleChanges = useMemo(() => {
        return members.some((member) => memberRoleDrafts[member.uid] !== undefined && memberRoleDrafts[member.uid] !== initialMemberRoles[member.uid]);
    }, [members, memberRoleDrafts, initialMemberRoles]);

    const hasSecurityChanges = hasPermissionChanges || hasRoleChanges;

    const applyPreset = (preset: ManagedPreset) => {
        clearPermissionsSuccessMessage();
        actionErrorSignal.value = null;
        const updatedPermissions = { ...PRESET_PERMISSIONS[preset] };
        permissionDraftSignal.value = updatedPermissions;
        selectedPresetSignal.value = preset;
    };

    const saveSecuritySettings = async () => {
        if (!hasSecurityChanges) {
            return;
        }

        isSavingSecuritySignal.value = true;
        actionErrorSignal.value = null;
        try {
            const updatedPermissions = { ...permissionDraft };
            if (hasPermissionChanges) {
                await apiClient.updateGroupPermissions(group.id, updatedPermissions);
            }

            if (hasRoleChanges) {
                for (const member of members) {
                    const draftRole = memberRoleDrafts[member.uid];
                    if (draftRole && draftRole !== initialMemberRoles[member.uid]) {
                        await apiClient.updateMemberRole(group.id, member.uid, draftRole);
                    }
                }
            }

            await onGroupUpdated?.();

            initialPermissionsSignal.value = updatedPermissions;
            selectedPresetSignal.value = determinePreset(updatedPermissions);

            const nextRoleState: Record<string, MemberRole> = {};
            members.forEach((member) => {
                const draftRole = memberRoleDrafts[member.uid];
                nextRoleState[member.uid] = draftRole ?? member.memberRole;
            });
            initialMemberRolesSignal.value = nextRoleState;
            memberRoleDraftsSignal.value = nextRoleState;

            showPermissionsSuccess(t('securitySettingsModal.success.updated'));
        } catch (error) {
            logError('Failed to update security settings', error, { groupId: group.id });
            actionErrorSignal.value = t('securitySettingsModal.errors.updatePermissions');
        } finally {
            isSavingSecuritySignal.value = false;
        }
    };

    const handlePermissionChange = (key: keyof GroupPermissions, value: string) => {
        clearPermissionsSuccessMessage();
        permissionDraftSignal.value = {
            ...permissionDraftSignal.value,
            [key]: value,
        };
        selectedPresetSignal.value = 'custom';
    };

    const updateMemberRoleDraft = (memberId: string, newRole: MemberRole) => {
        clearPermissionsSuccessMessage();
        memberRoleDraftsSignal.value = {
            ...memberRoleDraftsSignal.value,
            [memberId]: newRole,
        };
    };

    const handlePendingAction = async (memberId: UserId, action: 'approve' | 'reject') => {
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
    };

    const renderIdentityTab = () => {
        const user = currentUser.value;
        if (!user) {
            return null;
        }

        const groupMember = members.find((member) => member.uid === user.uid);
        if (!groupMember) {
            if (loadingMembers.value) {
                return (
                    <section className='border border-border-default rounded-lg p-5 space-y-3 bg-surface-muted/60' data-testid='group-display-name-settings'>
                        <div className='h-4 bg-surface-muted animate-pulse rounded' aria-hidden='true'></div>
                        <div className='h-10 bg-surface-muted animate-pulse rounded' aria-hidden='true'></div>
                    </section>
                );
            }
            return null;
        }

        const isDirty = displayName.trim() !== initialDisplayName;

        return (
            <div className='space-y-4'>
                <section className='border border-border-default rounded-lg p-5 space-y-4 bg-surface-muted/60' data-testid='group-display-name-settings'>
                    <div>
                        <h3 className='text-sm font-semibold text-text-primary'>{t('groupDisplayNameSettings.title')}</h3>
                        <p className='text-sm text-text-primary/70 mt-1'>{t('groupDisplayNameSettings.description')}</p>
                    </div>

                    <form onSubmit={handleDisplayNameSubmit} className='space-y-4'>
                        <Input
                            label={t('groupDisplayNameSettings.inputLabel')}
                            placeholder={t('groupDisplayNameSettings.inputPlaceholder')}
                            value={displayName}
                            onChange={handleDisplayNameChange}
                            disabled={isSavingDisplayName}
                            error={displayNameValidationError || undefined}
                            data-testid='group-display-name-input'
                        />

                        {displayNameServerError && (
                            <div className='bg-surface-error border border-border-error rounded-md px-3 py-2 text-sm text-semantic-error' role='alert' data-testid='group-display-name-error'>
                                {displayNameServerError}
                            </div>
                        )}

                        {displayNameSuccessMessage && (
                            <div
                                className='bg-interactive-accent/10 border border-semantic-success/40 rounded-md px-3 py-2 text-sm text-semantic-success'
                                role='status'
                                data-testid='group-display-name-success'
                            >
                                {displayNameSuccessMessage}
                            </div>
                        )}

                        <Button type='submit' loading={isSavingDisplayName} disabled={isSavingDisplayName || !isDirty} fullWidth data-testid='group-display-name-save-button'>
                            {isSavingDisplayName ? t('groupDisplayNameSettings.saving') : t('common.save')}
                        </Button>
                    </form>
                </section>
            </div>
        );
    };

    const renderGeneralTab = () => {
        if (!canManageGeneralSettings) {
            return null;
        }

        return (
            <div className='space-y-8'>
                <Form onSubmit={handleGeneralSubmit}>
                    <div className='space-y-4'>
                        {generalSuccessMessage && (
                            <div
                                className='bg-interactive-accent/10 border border-semantic-success/40 rounded-md px-3 py-2 text-sm text-semantic-success'
                                role='status'
                                data-testid='group-general-success'
                            >
                                {generalSuccessMessage}
                            </div>
                        )}
                        <Input
                            label={t('editGroupModal.groupNameLabel')}
                            type='text'
                            placeholder={t('editGroupModal.groupNamePlaceholder')}
                            value={groupName}
                            onChange={(value) => {
                                groupNameSignal.value = value;
                                validationErrorSignal.value = null;
                                clearGeneralSuccessMessage();
                            }}
                            required
                            disabled={isSubmitting}
                            error={validationError || undefined}
                            data-testid='group-name-input'
                        />

                        <div>
                            <label className='block text-sm font-medium text-text-primary mb-2'>{t('editGroupModal.descriptionLabel')}</label>
                            <textarea
                                className='w-full px-3 py-2 border border-border-default bg-surface-raised backdrop-blur-sm text-text-primary placeholder:text-text-muted/70 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-interactive-primary focus:border-interactive-primary resize-none transition-colors duration-200'
                                rows={3}
                                placeholder={t('editGroupModal.descriptionPlaceholder')}
                                value={groupDescription}
                                onInput={(event) => {
                                    groupDescriptionSignal.value = (event.target as HTMLTextAreaElement).value;
                                    validationErrorSignal.value = null;
                                    clearGeneralSuccessMessage();
                                }}
                                disabled={isSubmitting}
                                maxLength={200}
                                data-testid='group-description-input'
                            />
                        </div>

                        {validationError && (
                            <div className='bg-surface-error border border-border-error rounded-md p-3'>
                                <div className='flex'>
                                    <div className='flex-shrink-0'>
                                        <svg className='h-5 w-5 text-semantic-error/80' fill='currentColor' viewBox='0 0 20 20' aria-hidden='true' focusable='false'>
                                            <path
                                                fill-rule='evenodd'
                                                d='M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z'
                                                clip-rule='evenodd'
                                            />
                                        </svg>
                                    </div>
                                    <div className='ml-3'>
                                        <p className='text-sm text-semantic-error' role='alert' data-testid='edit-group-validation-error'>
                                            {validationError}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className='flex items-center justify-between mt-6 pt-4 border-t border-border-default'>
                        <Button type='button' variant='danger' onClick={handleDeleteClick} disabled={isSubmitting} data-testid='delete-group-button'>
                            {t('editGroupModal.deleteGroupButton')}
                        </Button>
                        <div className='flex items-center space-x-3'>
                            <Button type='button' variant='secondary' onClick={onClose} disabled={isSubmitting} data-testid='cancel-edit-group-button'>
                                {t('editGroupModal.cancelButton')}
                            </Button>
                            <Button type='submit' loading={isSubmitting} disabled={!isGeneralFormValid || !hasGeneralChanges} data-testid='save-changes-button'>
                                {t('common.save')}
                            </Button>
                        </div>
                    </div>
                </Form>
            </div>
        );
    };

    const renderSecurityTab = () => (
        <div className='space-y-6'>
            {hasSecurityChanges && !permissionsSuccessMessage && (
                <div className='bg-interactive-primary/10 border border-interactive-primary/20 text-interactive-primary text-sm rounded-md p-3' role='status' data-testid='security-unsaved-banner'>
                    {t('securitySettingsModal.unsavedChanges')}
                </div>
            )}
            {permissionsSuccessMessage && (
                <div className='bg-interactive-accent/10 border border-semantic-success/40 text-semantic-success text-sm rounded-md p-3' role='status' data-testid='security-permissions-success'>
                    {permissionsSuccessMessage}
                </div>
            )}
            {actionError && (
                <div className='bg-surface-error border border-border-error text-semantic-error text-sm rounded-md p-3' role='alert'>
                    {actionError}
                </div>
            )}

            <section>
                <div className='grid grid-cols-1 md:grid-cols-2 gap-3 items-start'>
                    {(Object.keys(PRESET_PERMISSIONS) as ManagedPreset[]).map((preset) => {
                        const isActive = selectedPreset === preset;
                        return (
                            <Button
                                key={preset}
                                type='button'
                                onClick={() => applyPreset(preset)}
                                variant='ghost'
                                className={`h-full flex-col items-start border rounded-lg px-4 py-3 text-left transition ${
                                    isActive
                                        ? 'border-interactive-primary bg-interactive-primary/10 shadow-sm'
                                        : 'border-border-default hover:border-interactive-primary/40 hover:bg-interactive-primary/10/40'
                                }`}
                                data-testid={`preset-button-${preset}`}
                            >
                                <span className='font-medium text-text-primary'>{t(`securitySettingsModal.presets.${preset}.label`)}</span>
                                <p className='text-sm text-text-primary/70 mt-1'>{t(`securitySettingsModal.presets.${preset}.description`)}</p>
                                {isActive && <span className='text-xs text-interactive-primary font-medium mt-2 block'>{t('securitySettingsModal.presets.activeBadge')}</span>}
                            </Button>
                        );
                    })}
                </div>
            </section>

            <section>
                <div className='flex items-center justify-between mb-2'>
                    <h3 className='text-base font-semibold text-text-primary'>{t('securitySettingsModal.custom.heading')}</h3>
                    {selectedPreset === 'custom' && hasPermissionChanges && <span className='text-xs text-interactive-primary font-medium'>{t('securitySettingsModal.custom.unsaved')}</span>}
                </div>
                <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                    {permissionOrder.map((key) => (
                        <label key={key} className='flex flex-col text-sm text-text-primary gap-2 border border-border-default rounded-lg px-4 py-3'>
                            <span className='font-medium text-text-primary'>{t(`securitySettingsModal.permissions.${key}.label`)}</span>
                            <select
                                className='border border-border-default bg-surface-raised backdrop-blur-sm text-text-primary rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-interactive-primary focus:border-interactive-primary text-sm transition-colors duration-200'
                                value={permissionDraft[key]}
                                onChange={(event) => handlePermissionChange(key, event.currentTarget.value)}
                                data-testid={`permission-select-${key}`}
                            >
                                {permissionOptions[key].map((option) => (
                                    <option key={option} value={option}>
                                        {t(`securitySettingsModal.permissions.options.${option}`)}
                                    </option>
                                ))}
                            </select>
                            <span className='text-xs text-text-primary/60'>{t(`securitySettingsModal.permissions.${key}.description`)}</span>
                        </label>
                    ))}
                </div>
                <p className='text-xs text-text-primary/60 text-right mt-2'>{t('securitySettingsModal.custom.saveHelper')}</p>
            </section>

            {canManageMembers && (
                <section>
                    <h3 className='text-base font-semibold text-text-primary mb-3'>{t('securitySettingsModal.memberRoles.heading')}</h3>
                    <div className='space-y-3'>
                        {members.map((member) => (
                            <div key={member.uid} className='flex items-center justify-between border border-border-default rounded-lg px-4 py-2'>
                                <div>
                                    <div className='font-medium text-text-primary text-sm'>{member.groupDisplayName || member.uid}</div>
                                    <div className='text-xs text-text-primary/60'>{t(`securitySettingsModal.memberRoles.${memberRoleDrafts[member.uid] ?? member.memberRole}`)}</div>
                                </div>
                                <select
                                    className='border border-border-default bg-surface-raised backdrop-blur-sm text-text-primary rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-interactive-primary focus:border-interactive-primary transition-colors duration-200'
                                    value={memberRoleDrafts[member.uid] ?? member.memberRole}
                                    onChange={(event) => updateMemberRoleDraft(member.uid, event.currentTarget.value as MemberRole)}
                                    disabled={member.uid === group.createdBy}
                                    data-testid={`member-role-select-${member.uid}`}
                                >
                                    {(['admin', 'member', 'viewer'] as MemberRole[]).map((role) => (
                                        <option key={role} value={role}>
                                            {t(`securitySettingsModal.memberRoles.${role}`)}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {canApproveMembers && (
                <section>
                    <h3 className='text-base font-semibold text-text-primary mb-3'>{t('securitySettingsModal.pendingMembers.heading')}</h3>
                    {pendingError && <div className='bg-surface-error border border-border-error text-semantic-error text-sm rounded-md p-3 mb-3'>{pendingError}</div>}
                    {loadingPending && (
                        <div className='flex justify-center py-6'>
                            <LoadingSpinner />
                        </div>
                    )}
                    {!loadingPending && pendingMembers.length === 0 && <p className='text-sm text-text-primary/70'>{t('securitySettingsModal.pendingMembers.empty')}</p>}
                    <div className='space-y-3'>
                        {pendingMembers.map((member) => (
                            <div key={member.uid} className='flex items-center justify-between border border-border-default rounded-lg px-4 py-2'>
                                <div>
                                    <div className='font-medium text-text-primary text-sm'>{member.groupDisplayName || member.uid}</div>
                                    <div className='text-xs text-text-primary/60'>{t('securitySettingsModal.pendingMembers.requested')}</div>
                                </div>
                                <div className='flex gap-2'>
                                    <Button
                                        variant='primary'
                                        size='sm'
                                        onClick={() => handlePendingAction(member.uid, 'approve')}
                                        disabled={pendingActionMember === member.uid}
                                        data-testid={`pending-approve-${member.uid}`}
                                    >
                                        {t('securitySettingsModal.pendingMembers.approve')}
                                    </Button>
                                    <Button
                                        variant='secondary'
                                        size='sm'
                                        onClick={() => handlePendingAction(member.uid, 'reject')}
                                        disabled={pendingActionMember === member.uid}
                                        data-testid={`pending-reject-${member.uid}`}
                                    >
                                        {t('securitySettingsModal.pendingMembers.reject')}
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            <div className='border-t border-border-default pt-4 flex justify-end gap-3'>
                <Button variant='secondary' onClick={onClose} data-testid='group-settings-close-button'>
                    {t('common.close')}
                </Button>
                <Button variant='primary' onClick={saveSecuritySettings} disabled={!hasSecurityChanges || isSavingSecurity} loading={isSavingSecurity} data-testid='save-security-button'>
                    {t('common.save')}
                </Button>
            </div>
        </div>
    );

    return (
        <>
            <Modal
                open={isOpen}
                onClose={showDeleteConfirm ? undefined : onClose}
                size='lg'
                className='max-w-3xl'
                labelledBy='group-settings-modal-title'
            >
                    <div className='flex items-center justify-between px-6 py-4 border-b border-border-default'>
                        <div>
                            <h2 id='group-settings-modal-title' className='text-lg font-semibold text-text-primary' data-testid='group-settings-modal-title'>
                                {t('groupSettingsModal.title')}
                            </h2>
                        </div>
                        <Tooltip content={t('groupHeader.groupSettingsAriaLabel')}>
                            <Clickable
                                as='button'
                                type='button'
                                onClick={onClose}
                                className='text-text-muted/80 hover:text-text-muted rounded-full p-1 hover:bg-surface-muted'
                                aria-label={t('groupHeader.groupSettingsAriaLabel')}
                                data-testid='close-group-settings-button'
                                eventName='modal_close'
                                eventProps={{ modalName: 'group_settings', method: 'x_button' }}
                            >
                                <svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24' aria-hidden='true' focusable='false'>
                                    <path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M6 18L18 6M6 6l12 12' />
                                </svg>
                            </Clickable>
                        </Tooltip>
                    </div>

                    {availableTabs.length > 1 && (
                        <div className='px-6 pt-4 border-b border-border-default'>
                            <div className='flex gap-4'>
                                {availableTabs.map((tab) => {
                                    const isActive = tab === activeTab;
                                    return (
                                        <Clickable
                                            as='button'
                                            key={tab}
                                            type='button'
                                            onClick={() => { activeTabSignal.value = tab; }}
                                            className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
                                                isActive
                                                    ? 'border-interactive-primary text-interactive-primary'
                                                    : 'border-transparent text-text-muted hover:text-text-primary hover:border-border-default'
                                            }`}
                                            data-testid={`group-settings-tab-${tab}`}
                                            aria-label={`Switch to ${tab} tab`}
                                            eventName='modal_tab_change'
                                            eventProps={{ modalName: 'group_settings', tab }}
                                        >
                                            {t(`groupSettingsModal.tabs.${tab}`)}
                                        </Clickable>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    <div className='max-h-[70vh] overflow-y-auto px-6 py-5'>
                        {activeTab === 'identity' && identityTabAvailable && renderIdentityTab()}
                        {activeTab === 'general' && generalTabAvailable && renderGeneralTab()}
                        {activeTab === 'security' && securityTabAvailable && renderSecurityTab()}
                    </div>
            </Modal>

            <Modal
                open={showDeleteConfirm}
                onClose={isDeleting ? undefined : handleDeleteCancel}
                size='sm'
                className='max-w-md'
            >
                    <div data-testid='delete-group-dialog'>
                        <div className='px-6 py-4 border-b border-border-default'>
                            <h3 className='text-lg font-semibold text-semantic-error flex items-center'>
                                <span className='mr-2'>⚠️</span>
                                {t('editGroupModal.deleteConfirmDialog.title')}
                            </h3>
                        </div>

                        <div className='px-6 py-4'>
                            <div className='bg-surface-error border border-border-error rounded-md p-4 mb-4'>
                                <h4 className='text-semantic-error font-semibold mb-2'>{t('editGroupModal.deleteConfirmDialog.warningTitle')}</h4>
                                <p className='text-semantic-error text-sm mb-3'>{t('editGroupModal.deleteConfirmDialog.warningMessage')}</p>
                                <ul className='text-semantic-error text-sm list-disc list-inside space-y-1'>
                                    <li>{t('editGroupModal.deleteConfirmDialog.warningList.expenses')}</li>
                                    <li>{t('editGroupModal.deleteConfirmDialog.warningList.settlements')}</li>
                                    <li>{t('editGroupModal.deleteConfirmDialog.warningList.members')}</li>
                                    <li>{t('editGroupModal.deleteConfirmDialog.warningList.history')}</li>
                                </ul>
                                <p className='text-semantic-error font-semibold text-sm mt-3'>{t('editGroupModal.deleteConfirmDialog.cannotUndo')}</p>
                            </div>

                            <div className='mb-4'>
                                <label className='block text-sm font-medium text-text-primary mb-2'>{t('editGroupModal.deleteConfirmDialog.typeToConfirm', { groupName: group.name })}</label>
                                <Input type='text' placeholder={group.name} value={confirmationText} onChange={(value) => { confirmationTextSignal.value = value; }} className='w-full' disabled={isDeleting} />
                            </div>

                            {deleteError && (
                                <div className='bg-surface-error border border-border-error rounded-md p-3 mb-4'>
                                    <p className='text-sm text-semantic-error' role='alert'>
                                        {deleteError}
                                    </p>
                                </div>
                            )}

                            {isDeleting && (
                                <div className='text-center text-text-muted mb-4'>
                                    <div className='mx-auto mb-2'>
                                        <LoadingSpinner size='sm' color='text-semantic-error' />
                                    </div>
                                    <p className='text-sm'>{t('editGroupModal.deleteConfirmDialog.deletingMessage')}</p>
                                </div>
                            )}
                        </div>

                        <div className='px-6 py-4 border-t border-border-default flex justify-end space-x-3'>
                            <Button type='button' variant='secondary' onClick={handleDeleteCancel} disabled={isDeleting}>
                                {t('editGroupModal.deleteConfirmDialog.cancelText')}
                            </Button>
                            <Button type='button' variant='danger' onClick={handleDeleteConfirm} disabled={isDeleting || confirmationText !== group.name} loading={isDeleting}>
                                {isDeleting ? t('editGroupModal.deleteConfirmDialog.deletingText') : t('editGroupModal.deleteConfirmDialog.confirmText')}
                            </Button>
                        </div>
                    </div>
            </Modal>
        </>
    );
}
