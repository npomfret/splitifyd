import { apiClient } from '@/app/apiClient.ts';
import { logError } from '@/utils/browser-logger.ts';
import { useEffect, useMemo, useState } from 'preact/hooks';
import { useTranslation } from 'react-i18next';
import {
    GroupDTO,
    GroupMember,
    GroupMembershipDTO,
    GroupPermissions,
    MemberRole,
    PermissionLevels,
    SecurityPreset,
} from '@splitifyd/shared';
import { Button } from '../ui/Button';
import { LoadingSpinner } from '../ui/LoadingSpinner';

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

interface SecuritySettingsModalProps {
    isOpen: boolean;
    group: GroupDTO;
    members: GroupMember[];
    canManageMembers: boolean;
    canApproveMembers: boolean;
    onClose: () => void;
    onRefresh?: () => Promise<void>;
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

export function SecuritySettingsModal({
    isOpen,
    group,
    members,
    canManageMembers,
    canApproveMembers,
    onClose,
    onRefresh,
}: SecuritySettingsModalProps) {
    const { t } = useTranslation();
    const [permissionDraft, setPermissionDraft] = useState<GroupPermissions>(group.permissions);
    const [selectedPreset, setSelectedPreset] = useState<ManagedPreset | 'custom'>(determinePreset(group.permissions));
    const [savingPermissions, setSavingPermissions] = useState(false);
    const [presetApplying, setPresetApplying] = useState<ManagedPreset | null>(null);
    const [pendingMembers, setPendingMembers] = useState<GroupMembershipDTO[]>([]);
    const [loadingPending, setLoadingPending] = useState(false);
    const [pendingError, setPendingError] = useState<string | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);
    const [updatingMemberId, setUpdatingMemberId] = useState<string | null>(null);
    const [pendingActionMember, setPendingActionMember] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        setPermissionDraft(group.permissions);
        setSelectedPreset(determinePreset(group.permissions));
        setActionError(null);

        if (canApproveMembers) {
            loadPendingMembers();
        } else {
            setPendingMembers([]);
        }
    }, [isOpen, group.id]);

    useEffect(() => {
        if (!isOpen) return;

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                onClose();
            }
        };

        window.addEventListener('keydown', handleEscape, { capture: true });
        return () => window.removeEventListener('keydown', handleEscape, { capture: true });
    }, [isOpen, onClose]);

    const hasPermissionChanges = useMemo(() => {
        return permissionOrder.some((key) => permissionDraft[key] !== group.permissions[key]);
    }, [permissionDraft, group.permissions]);

    const handleBackdropClick = (event: Event) => {
        if (event.target === event.currentTarget) {
            onClose();
        }
    };

    const loadPendingMembers = async () => {
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
    };

    const applyPreset = async (preset: ManagedPreset) => {
        setPresetApplying(preset);
        setActionError(null);
        try {
            await apiClient.applySecurityPreset(group.id, preset);
            setPermissionDraft(PRESET_PERMISSIONS[preset]);
            setSelectedPreset(preset);
            if (onRefresh) {
                await onRefresh();
            }
        } catch (error) {
            logError('Failed to apply security preset', error, { preset, groupId: group.id });
            setActionError(t('securitySettingsModal.errors.updatePermissions'));
        } finally {
            setPresetApplying(null);
        }
    };

    const saveCustomPermissions = async () => {
        setSavingPermissions(true);
        setActionError(null);
        try {
            await apiClient.updateGroupPermissions(group.id, permissionDraft);
            if (onRefresh) {
                await onRefresh();
            }
            setSelectedPreset(determinePreset(permissionDraft));
        } catch (error) {
            logError('Failed to update group permissions', error, { groupId: group.id });
            setActionError(t('securitySettingsModal.errors.updatePermissions'));
        } finally {
            setSavingPermissions(false);
        }
    };

    const handlePermissionChange = (key: keyof GroupPermissions, value: string) => {
        setPermissionDraft((prev) => ({
            ...prev,
            [key]: value,
        }));
        setSelectedPreset('custom');
    };

    const updateMemberRole = async (memberId: string, newRole: MemberRole) => {
        setUpdatingMemberId(memberId);
        setActionError(null);
        try {
            await apiClient.updateMemberRole(group.id, memberId, newRole);
            if (onRefresh) {
                await onRefresh();
            }
        } catch (error) {
            logError('Failed to update member role', error, { memberId, groupId: group.id });
            setActionError(t('securitySettingsModal.errors.updateRole'));
        } finally {
            setUpdatingMemberId(null);
        }
    };

    const handlePendingAction = async (memberId: string, action: 'approve' | 'reject') => {
        setPendingActionMember(memberId);
        setActionError(null);
        try {
            if (action === 'approve') {
                await apiClient.approvePendingMember(group.id, memberId);
            } else {
                await apiClient.rejectPendingMember(group.id, memberId);
            }
            await loadPendingMembers();
            if (onRefresh) {
                await onRefresh();
            }
        } catch (error) {
            logError('Failed to process pending member', error, { memberId, action, groupId: group.id });
            setActionError(t('securitySettingsModal.errors.pendingAction'));
        } finally {
            setPendingActionMember(null);
        }
    };

    if (!isOpen) return null;

    return (
        <div className='fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50' onClick={handleBackdropClick} role='presentation'>
            <div className='relative top-12 mx-auto w-full max-w-3xl bg-white rounded-xl shadow-xl border border-gray-200' role='dialog' aria-modal='true'>
                <div className='flex items-center justify-between px-6 py-4 border-b border-gray-200'>
                    <div>
                        <h2 className='text-lg font-semibold text-gray-900'>{t('securitySettingsModal.title')}</h2>
                        <p className='text-sm text-gray-600 mt-1'>{t('securitySettingsModal.description')}</p>
                    </div>
                    <button onClick={onClose} className='text-gray-400 hover:text-gray-600 rounded-full p-1 hover:bg-gray-100' data-testid='close-security-modal-button'>
                        <svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                            <path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M6 18L18 6M6 6l12 12' />
                        </svg>
                    </button>
                </div>

                <div className='max-h-[70vh] overflow-y-auto px-6 py-5 space-y-6'>
                    {actionError && (
                        <div className='bg-red-50 border border-red-200 text-red-700 text-sm rounded-md p-3' role='alert'>
                            {actionError}
                        </div>
                    )}

                    <section>
                        <h3 className='text-base font-semibold text-gray-900 mb-2'>{t('securitySettingsModal.presets.heading')}</h3>
                        <p className='text-sm text-gray-600 mb-4'>{t('securitySettingsModal.presets.description')}</p>
                        <div className='grid grid-cols-1 md:grid-cols-2 gap-3'>
                            {(Object.keys(PRESET_PERMISSIONS) as ManagedPreset[]).map((preset) => {
                                const isActive = selectedPreset === preset;
                                return (
                                    <button
                                        key={preset}
                                        type='button'
                                        onClick={() => applyPreset(preset)}
                                        className={`border rounded-lg px-4 py-3 text-left transition ${isActive ? 'border-purple-500 bg-purple-50 shadow-sm' : 'border-gray-200 hover:border-purple-300 hover:bg-purple-50/40'}`}
                                        disabled={presetApplying === preset}
                                        data-testid={`preset-button-${preset}`}
                                    >
                                        <div className='flex items-center justify-between'>
                                            <span className='font-medium text-gray-900'>{t(`securitySettingsModal.presets.${preset}.label`)}</span>
                                            {presetApplying === preset && <LoadingSpinner size='sm' />}
                                        </div>
                                        <p className='text-sm text-gray-600 mt-1'>{t(`securitySettingsModal.presets.${preset}.description`)}</p>
                                        {isActive && <span className='text-xs text-purple-600 font-medium mt-2 block'>{t('securitySettingsModal.presets.activeBadge')}</span>}
                                    </button>
                                );
                            })}
                        </div>
                    </section>

                    <section>
                        <div className='flex items-center justify-between mb-2'>
                            <h3 className='text-base font-semibold text-gray-900'>{t('securitySettingsModal.custom.heading')}</h3>
                            {selectedPreset === 'custom' && hasPermissionChanges && (
                                <span className='text-xs text-amber-600 font-medium'>{t('securitySettingsModal.custom.unsaved')}</span>
                            )}
                        </div>
                        <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                            {permissionOrder.map((key) => (
                                <label key={key} className='flex flex-col text-sm text-gray-700 gap-2'>
                                    <span className='font-medium'>{t(`securitySettingsModal.permissions.${key}.label`)}</span>
                                    <select
                                        className='border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm'
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
                                    <span className='text-xs text-gray-500'>{t(`securitySettingsModal.permissions.${key}.description`)}</span>
                                </label>
                            ))}
                        </div>
                        <div className='mt-3 flex justify-end'>
                            <Button
                                variant='primary'
                                onClick={saveCustomPermissions}
                                disabled={!hasPermissionChanges || savingPermissions}
                                data-testid='save-permissions-button'
                            >
                                {savingPermissions ? t('securitySettingsModal.custom.saving') : t('securitySettingsModal.custom.save')}
                            </Button>
                        </div>
                    </section>

                    {canManageMembers && (
                        <section>
                            <h3 className='text-base font-semibold text-gray-900 mb-3'>{t('securitySettingsModal.memberRoles.heading')}</h3>
                            <div className='space-y-3'>
                                {members.map((member) => (
                                    <div key={member.uid} className='flex items-center justify-between border border-gray-200 rounded-lg px-4 py-2'>
                                        <div>
                                            <div className='font-medium text-gray-900 text-sm'>{member.groupDisplayName || member.displayName || member.uid}</div>
                                            <div className='text-xs text-gray-500'>{t(`securitySettingsModal.memberRoles.${member.memberRole}`)}</div>
                                        </div>
                                        <select
                                            className='border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500'
                                            value={member.memberRole}
                                            onChange={(event) => updateMemberRole(member.uid, event.currentTarget.value as MemberRole)}
                                            disabled={updatingMemberId === member.uid || member.uid === group.createdBy}
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
                            <h3 className='text-base font-semibold text-gray-900 mb-3'>{t('securitySettingsModal.pendingMembers.heading')}</h3>
                            {pendingError && (
                                <div className='bg-red-50 border border-red-200 text-red-700 text-sm rounded-md p-3 mb-3'>{pendingError}</div>
                            )}
                            {loadingPending && (
                                <div className='flex justify-center py-6'>
                                    <LoadingSpinner />
                                </div>
                            )}
                            {!loadingPending && pendingMembers.length === 0 && (
                                <p className='text-sm text-gray-600'>{t('securitySettingsModal.pendingMembers.empty')}</p>
                            )}
                            <div className='space-y-3'>
                                {pendingMembers.map((member) => (
                                    <div key={member.uid} className='flex items-center justify-between border border-gray-200 rounded-lg px-4 py-2'>
                                        <div>
                                            <div className='font-medium text-gray-900 text-sm'>{member.groupDisplayName || member.uid}</div>
                                            <div className='text-xs text-gray-500'>{t('securitySettingsModal.pendingMembers.requested')}</div>
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
                </div>

                <div className='px-6 py-4 border-t border-gray-200 flex justify-end gap-2'>
                    <Button variant='secondary' onClick={onClose} data-testid='security-close-button'>
                        {t('common.close')}
                    </Button>
                </div>
            </div>
        </div>
    );
}
