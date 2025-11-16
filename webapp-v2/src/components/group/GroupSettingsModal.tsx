import { apiClient, ApiError } from '@/app/apiClient.ts';
import { useAuthRequired } from '@/app/hooks/useAuthRequired.ts';
import { enhancedGroupDetailStore } from '@/app/stores/group-detail-store-enhanced.ts';
import { logError } from '@/utils/browser-logger.ts';
import { useComputed } from '@preact/signals';
import { GroupDTO, GroupMember, GroupMembershipDTO, GroupPermissions, MemberRole, PermissionLevels, SecurityPreset, toGroupName } from '@splitifyd/shared';
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

    const [activeTab, setActiveTab] = useState<GroupSettingsTab | null>(defaultTab);

    // General settings state
    const [groupName, setGroupName] = useState('');
    const [groupDescription, setGroupDescription] = useState('');
    const [initialName, setInitialName] = useState('');
    const [initialDescription, setInitialDescription] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [validationError, setValidationError] = useState<string | null>(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleteError, setDeleteError] = useState<string | null>(null);
    const [confirmationText, setConfirmationText] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);
    const [generalSuccessMessage, setGeneralSuccessMessage] = useState<string | null>(null);
    const generalSuccessTimerRef = useRef<number | null>(null);

    // Display name settings state
    const [displayName, setDisplayName] = useState('');
    const [initialDisplayName, setInitialDisplayName] = useState('');
    const [displayNameValidationError, setDisplayNameValidationError] = useState<string | null>(null);
    const [displayNameServerError, setDisplayNameServerError] = useState<string | null>(null);
    const [displayNameSuccessMessage, setDisplayNameSuccessMessage] = useState<string | null>(null);
    const [isSavingDisplayName, setIsSavingDisplayName] = useState(false);
    const displayNameSuccessTimerRef = useRef<number | null>(null);

    // Security settings state
    const [permissionDraft, setPermissionDraft] = useState<GroupPermissions>({ ...group.permissions });
    const [selectedPreset, setSelectedPreset] = useState<ManagedPreset | 'custom'>(determinePreset(group.permissions));
    const [isSavingSecurity, setIsSavingSecurity] = useState(false);
    const [pendingMembers, setPendingMembers] = useState<GroupMembershipDTO[]>([]);
    const [loadingPending, setLoadingPending] = useState(false);
    const [pendingError, setPendingError] = useState<string | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);
    const [pendingActionMember, setPendingActionMember] = useState<string | null>(null);
    const [initialPermissions, setInitialPermissions] = useState<GroupPermissions>({ ...group.permissions });
    const [permissionsSuccessMessage, setPermissionsSuccessMessage] = useState<string | null>(null);
    const permissionsSuccessTimerRef = useRef<number | null>(null);
    const [memberRoleDrafts, setMemberRoleDrafts] = useState<Record<string, MemberRole>>({});
    const [initialMemberRoles, setInitialMemberRoles] = useState<Record<string, MemberRole>>({});

    const clearGeneralSuccessMessage = useCallback(() => {
        if (generalSuccessTimerRef.current) {
            window.clearTimeout(generalSuccessTimerRef.current);
            generalSuccessTimerRef.current = null;
        }
        setGeneralSuccessMessage(null);
    }, []);

    const showGeneralSuccess = useCallback(
        (message: string) => {
            clearGeneralSuccessMessage();
            setGeneralSuccessMessage(message);
            generalSuccessTimerRef.current = window.setTimeout(() => {
                setGeneralSuccessMessage(null);
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
        setPermissionsSuccessMessage(null);
    }, []);

    const showPermissionsSuccess = useCallback(
        (message: string) => {
            clearPermissionsSuccessMessage();
            setPermissionsSuccessMessage(message);
            permissionsSuccessTimerRef.current = window.setTimeout(() => {
                setPermissionsSuccessMessage(null);
                permissionsSuccessTimerRef.current = null;
            }, 4000);
        },
        [clearPermissionsSuccessMessage],
    );

    useEffect(() => {
        if (isOpen) {
            setActiveTab(defaultTab);
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

        setDisplayName(fallbackName);
        setInitialDisplayName(fallbackName);
        setDisplayNameValidationError(null);
        setDisplayNameServerError(null);
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

        setInitialName(group.name);
        setInitialDescription(group.description || '');
        setGroupName(group.name);
        setGroupDescription(group.description || '');
        setValidationError(null);
        setDeleteError(null);
        setShowDeleteConfirm(false);
        setConfirmationText('');
        setIsDeleting(false);
    }, [isOpen, canManageGeneralSettings, group.name, group.description]);

    const loadPendingMembers = useCallback(async () => {
        if (!canApproveMembers) {
            return;
        }

        setLoadingPending(true);
        setPendingError(null);
        try {
            const results = await apiClient.getPendingMembers(group.id);
            setPendingMembers(results);
        } catch (error) {
            logError('Failed to load pending members', error, { groupId: group.id });
            setPendingError(t('securitySettingsModal.errors.loadPending'));
        } finally {
            setLoadingPending(false);
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

        setPermissionDraft({ ...group.permissions });
        setInitialPermissions({ ...group.permissions });
        setSelectedPreset(determinePreset(group.permissions));
        setActionError(null);
        setMemberRoleDrafts(roleMap);
        setInitialMemberRoles(roleMap);

        if (canApproveMembers) {
            loadPendingMembers();
        } else {
            setPendingMembers([]);
        }
    }, [isOpen, securityTabAvailable, group.permissions, members, canApproveMembers, loadPendingMembers]);

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && !showDeleteConfirm) {
                event.preventDefault();
                onClose();
            }
        };

        window.addEventListener('keydown', handleEscape, { capture: true });
        return () => window.removeEventListener('keydown', handleEscape, { capture: true });
    }, [isOpen, onClose, showDeleteConfirm]);

    if (!isOpen) {
        return null;
    }

    const handleBackdropClick = (event: Event) => {
        if (event.target === event.currentTarget && !showDeleteConfirm) {
            onClose();
        }
    };

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
        setDisplayName(value);
        if (displayNameValidationError) {
            setDisplayNameValidationError(null);
        }
        if (displayNameServerError) {
            setDisplayNameServerError(null);
        }
        if (displayNameSuccessMessage) {
            setDisplayNameSuccessMessage(null);
        }
    };

    const handleDisplayNameSubmit = async (event: Event) => {
        event.preventDefault();

        const trimmedName = displayName.trim();

        if (!trimmedName) {
            setDisplayNameValidationError(t('groupDisplayNameSettings.errors.required'));
            return;
        }

        if (trimmedName.length > 50) {
            setDisplayNameValidationError(t('groupDisplayNameSettings.errors.tooLong'));
            return;
        }

        if (trimmedName === initialDisplayName) {
            setDisplayNameValidationError(t('groupDisplayNameSettings.errors.notChanged'));
            return;
        }

        setIsSavingDisplayName(true);
        setDisplayNameValidationError(null);
        setDisplayNameServerError(null);
        setDisplayNameSuccessMessage(null);

        try {
            await apiClient.updateGroupMemberDisplayName(group.id, trimmedName);
            await enhancedGroupDetailStore.refreshAll();
            await onGroupUpdated?.();

            setInitialDisplayName(trimmedName);
            setDisplayNameSuccessMessage(t('groupDisplayNameSettings.success'));

            if (displayNameSuccessTimerRef.current) {
                window.clearTimeout(displayNameSuccessTimerRef.current);
            }

            displayNameSuccessTimerRef.current = window.setTimeout(() => {
                setDisplayNameSuccessMessage(null);
                displayNameSuccessTimerRef.current = null;
            }, 4000);
        } catch (error: unknown) {
            if (error instanceof ApiError && error.code === 'DISPLAY_NAME_TAKEN') {
                setDisplayNameServerError(t('groupDisplayNameSettings.errors.taken'));
            } else if (error instanceof ApiError) {
                setDisplayNameServerError(error.message || t('groupDisplayNameSettings.errors.unknown'));
            } else {
                setDisplayNameServerError(t('groupDisplayNameSettings.errors.unknown'));
            }
        } finally {
            setIsSavingDisplayName(false);
        }
    };

    const handleGeneralSubmit = async (event: Event) => {
        event.preventDefault();

        const errorMessage = validateGeneralForm();
        if (errorMessage) {
            setValidationError(errorMessage);
            return;
        }

        if (!hasGeneralChanges) {
            return;
        }

        setIsSubmitting(true);
        setValidationError(null);

        try {
            const trimmedName = toGroupName(groupName.trim());
            const trimmedDescription = groupDescription.trim();

            await apiClient.updateGroup(group.id, {
                name: trimmedName,
                description: trimmedDescription ? trimmedDescription : undefined,
            });

            setInitialName(trimmedName);
            setInitialDescription(trimmedDescription);
            setGroupName(trimmedName);
            setGroupDescription(trimmedDescription);
            showGeneralSuccess(t('editGroupModal.success.updated'));
            await onGroupUpdated?.();
        } catch (error) {
            const message = error instanceof Error ? error.message : t('editGroupModal.validation.updateFailed');
            setValidationError(message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteClick = () => {
        setShowDeleteConfirm(true);
        setDeleteError(null);
        setConfirmationText('');
    };

    const handleDeleteConfirm = async () => {
        setIsDeleting(true);
        setDeleteError(null);

        try {
            enhancedGroupDetailStore.setDeletingGroup(true);
            setShowDeleteConfirm(false);
            onDelete?.();
            onClose();

            apiClient.deleteGroup(group.id).catch((error) => {
                logError('Group deletion failed after redirect', error, { groupId: group.id });
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : t('editGroupModal.deleteConfirmDialog.deleteFailed');
            setDeleteError(message);
            enhancedGroupDetailStore.setDeletingGroup(false);
            setIsDeleting(false);
        }
    };

    const handleDeleteCancel = () => {
        setShowDeleteConfirm(false);
        setDeleteError(null);
        setConfirmationText('');
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
        setActionError(null);
        const updatedPermissions = { ...PRESET_PERMISSIONS[preset] };
        setPermissionDraft(updatedPermissions);
        setSelectedPreset(preset);
    };

    const saveSecuritySettings = async () => {
        if (!hasSecurityChanges) {
            return;
        }

        setIsSavingSecurity(true);
        setActionError(null);
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

            setInitialPermissions(updatedPermissions);
            setSelectedPreset(determinePreset(updatedPermissions));

            const nextRoleState: Record<string, MemberRole> = {};
            members.forEach((member) => {
                const draftRole = memberRoleDrafts[member.uid];
                nextRoleState[member.uid] = draftRole ?? member.memberRole;
            });
            setInitialMemberRoles(nextRoleState);
            setMemberRoleDrafts(nextRoleState);

            showPermissionsSuccess(t('securitySettingsModal.success.updated'));
        } catch (error) {
            logError('Failed to update security settings', error, { groupId: group.id });
            setActionError(t('securitySettingsModal.errors.updatePermissions'));
        } finally {
            setIsSavingSecurity(false);
        }
    };

    const handlePermissionChange = (key: keyof GroupPermissions, value: string) => {
        clearPermissionsSuccessMessage();
        setPermissionDraft((previous) => ({
            ...previous,
            [key]: value,
        }));
        setSelectedPreset('custom');
    };

    const updateMemberRoleDraft = (memberId: string, newRole: MemberRole) => {
        clearPermissionsSuccessMessage();
        setMemberRoleDrafts((previous) => ({
            ...previous,
            [memberId]: newRole,
        }));
    };

    const handlePendingAction = async (memberId: string, action: 'approve' | 'reject') => {
        setPendingActionMember(memberId);
        setActionError(null);
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
            setActionError(t('securitySettingsModal.errors.pendingAction'));
        } finally {
            setPendingActionMember(null);
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
                            <div className='bg-interactive-accent/10 border border-semantic-success/40 rounded-md px-3 py-2 text-sm text-semantic-success' role='status' data-testid='group-display-name-success'>
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
                            <div className='bg-interactive-accent/10 border border-semantic-success/40 rounded-md px-3 py-2 text-sm text-semantic-success' role='status' data-testid='group-general-success'>
                                {generalSuccessMessage}
                            </div>
                        )}
                        <Input
                            label={t('editGroupModal.groupNameLabel')}
                            type='text'
                            placeholder={t('editGroupModal.groupNamePlaceholder')}
                            value={groupName}
                            onChange={(value) => {
                                setGroupName(value);
                                setValidationError(null);
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
                                    setGroupDescription((event.target as HTMLTextAreaElement).value);
                                    setValidationError(null);
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
                            <button
                                key={preset}
                                type='button'
                                onClick={() => applyPreset(preset)}
                                className={`h-full border rounded-lg px-4 py-3 text-left transition ${
                                    isActive ? 'border-interactive-primary bg-interactive-primary/10 shadow-sm' : 'border-border-default hover:border-interactive-primary/40 hover:bg-interactive-primary/10/40'
                                }`}
                                data-testid={`preset-button-${preset}`}
                            >
                                <div className='flex items-center justify-between'>
                                    <span className='font-medium text-text-primary'>{t(`securitySettingsModal.presets.${preset}.label`)}</span>
                                </div>
                                <p className='text-sm text-text-primary/70 mt-1'>{t(`securitySettingsModal.presets.${preset}.description`)}</p>
                                {isActive && <span className='text-xs text-interactive-primary font-medium mt-2 block'>{t('securitySettingsModal.presets.activeBadge')}</span>}
                            </button>
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
            <div className='fixed inset-0 bg-black/40 backdrop-blur-sm overflow-y-auto h-full w-full z-50' onClick={handleBackdropClick} role='presentation'>
                <div
                    className='relative top-12 mx-auto w-full max-w-3xl bg-surface-base border-border-default rounded-xl shadow-xl border border-border-default opacity-100'
                    role='dialog'
                    aria-modal='true'
                    aria-labelledby='group-settings-modal-title'
                >
                    <div className='flex items-center justify-between px-6 py-4 border-b border-border-default'>
                        <div>
                            <h2 id='group-settings-modal-title' className='text-lg font-semibold text-text-primary' data-testid='group-settings-modal-title'>
                                {t('groupSettingsModal.title')}
                            </h2>
                        </div>
                        <Tooltip content={t('groupHeader.groupSettingsAriaLabel')}>
                            <button
                                onClick={onClose}
                                className='text-text-muted/80 hover:text-text-muted rounded-full p-1 hover:bg-surface-muted'
                                aria-label={t('groupHeader.groupSettingsAriaLabel')}
                                data-testid='close-group-settings-button'
                            >
                                <svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24' aria-hidden='true' focusable='false'>
                                    <path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M6 18L18 6M6 6l12 12' />
                                </svg>
                            </button>
                        </Tooltip>
                    </div>

                    {availableTabs.length > 1 && (
                        <div className='px-6 pt-4 border-b border-border-default'>
                            <div className='flex gap-4'>
                                {availableTabs.map((tab) => {
                                    const isActive = tab === activeTab;
                                    return (
                                        <button
                                            key={tab}
                                            type='button'
                                            onClick={() => setActiveTab(tab)}
                                            className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
                                                isActive ? 'border-interactive-primary text-interactive-primary' : 'border-transparent text-text-muted hover:text-text-primary hover:border-border-default'
                                            }`}
                                            data-testid={`group-settings-tab-${tab}`}
                                        >
                                            {t(`groupSettingsModal.tabs.${tab}`)}
                                        </button>
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
                </div>
            </div>

            {showDeleteConfirm && (
                <div className='fixed inset-0 bg-black/40 backdrop-blur-sm overflow-y-auto h-full w-full z-50 flex items-center justify-center'>
                    <div className='relative bg-surface-base border-border-default rounded-lg shadow-lg max-w-md w-full mx-4 opacity-100' data-testid='delete-group-dialog'>
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
                                <Input type='text' placeholder={group.name} value={confirmationText} onChange={setConfirmationText} className='w-full' disabled={isDeleting} />
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
                </div>
            )}
        </>
    );
}
