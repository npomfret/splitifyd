import { GroupMember, GroupMembershipDTO, GroupPermissions, MemberRole, UserId } from '@billsplit-wl/shared';
import { ReadonlySignal } from '@preact/signals';
import { useTranslation } from 'react-i18next';
import { Alert, Button } from '../../../ui';
import { CustomPermissionsSection } from './CustomPermissionsSection';
import { MemberRolesSection } from './MemberRolesSection';
import { PendingMembersSection } from './PendingMembersSection';
import { PermissionPresetsSection } from './PermissionPresetsSection';

type ManagedPreset = 'open' | 'managed';

interface GroupSecurityTabContentProps {
    // Permission state
    permissionDraft: GroupPermissions;
    selectedPreset: ManagedPreset | 'custom';
    isSaving: boolean;
    hasPermissionChanges: boolean;
    hasSecurityChanges: boolean;
    successMessage: ReadonlySignal<string | null>;
    actionError: string | null;
    presetKeys: ManagedPreset[];

    // Member roles
    members: GroupMember[];
    memberRoleDrafts: Record<string, MemberRole>;
    canManageMembers: boolean;

    // Pending members
    pendingMembers: GroupMembershipDTO[];
    loadingPending: boolean;
    pendingError: string | null;
    pendingActionMember: string | null;
    canApproveMembers: boolean;

    // Actions
    onApplyPreset: (preset: ManagedPreset) => void;
    onSave: () => void;
    onClose: () => void;
    onPermissionChange: (key: keyof GroupPermissions, value: string) => void;
    onRoleChange: (memberId: string, newRole: MemberRole) => void;
    onApprovePending: (memberId: UserId) => void;
    onRejectPending: (memberId: UserId) => void;
}

export function GroupSecurityTabContent({
    permissionDraft,
    selectedPreset,
    isSaving,
    hasPermissionChanges,
    hasSecurityChanges,
    successMessage,
    actionError,
    presetKeys,
    members,
    memberRoleDrafts,
    canManageMembers,
    pendingMembers,
    loadingPending,
    pendingError,
    pendingActionMember,
    canApproveMembers,
    onApplyPreset,
    onSave,
    onClose,
    onPermissionChange,
    onRoleChange,
    onApprovePending,
    onRejectPending,
}: GroupSecurityTabContentProps) {
    const { t } = useTranslation();

    return (
        <div className='space-y-6'>
            {hasSecurityChanges && !successMessage.value && (
                <div
                    className='bg-interactive-primary/10 border border-interactive-primary/20 text-interactive-primary text-sm rounded-md p-3'
                    role='status'
                    aria-label={t('groupSettingsModal.securityTab.unsavedChangesAriaLabel')}
                >
                    {t('securitySettingsModal.unsavedChanges')}
                </div>
            )}
            {successMessage.value && (
                <div
                    className='bg-interactive-accent/10 border border-semantic-success/40 text-semantic-success text-sm rounded-md p-3'
                    role='status'
                    aria-label={t('groupSettingsModal.securityTab.successAriaLabel')}
                >
                    {successMessage.value}
                </div>
            )}
            {actionError && <Alert type='error' message={actionError} />}

            <PermissionPresetsSection
                selectedPreset={selectedPreset}
                presetKeys={presetKeys}
                onApplyPreset={onApplyPreset}
            />

            <CustomPermissionsSection
                permissionDraft={permissionDraft}
                selectedPreset={selectedPreset}
                hasPermissionChanges={hasPermissionChanges}
                onPermissionChange={onPermissionChange}
            />

            {canManageMembers && (
                <MemberRolesSection
                    members={members}
                    memberRoleDrafts={memberRoleDrafts}
                    onRoleChange={onRoleChange}
                />
            )}

            {canApproveMembers && (
                <PendingMembersSection
                    pendingMembers={pendingMembers}
                    loadingPending={loadingPending}
                    pendingError={pendingError}
                    pendingActionMember={pendingActionMember}
                    onApprove={onApprovePending}
                    onReject={onRejectPending}
                />
            )}

            <div className='border-t border-border-default pt-4 flex justify-end gap-3'>
                <Button variant='secondary' onClick={onClose} data-testid='group-settings-close-button'>
                    {t('common.close')}
                </Button>
                <Button variant='primary' onClick={onSave} disabled={!hasSecurityChanges || isSaving} loading={isSaving} data-testid='save-security-button'>
                    {t('common.save')}
                </Button>
            </div>
        </div>
    );
}
