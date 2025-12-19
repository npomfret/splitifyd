import { useAuthRequired } from '@/app/hooks/useAuthRequired.ts';
import { useGroupDisplayName } from '@/app/hooks/useGroupDisplayName.ts';
import { useGroupGeneralTabSettings } from '@/app/hooks/useGroupGeneralTabSettings.ts';
import { useGroupSecuritySettings } from '@/app/hooks/useGroupSecuritySettings.ts';
import { useModalOpen } from '@/app/hooks/useModalOpen';
import { translateGroupSettingsTab } from '@/app/i18n/dynamic-translations';
import { enhancedGroupDetailStore } from '@/app/stores/group-detail-store-enhanced.ts';
import { Clickable } from '@/components/ui/Clickable';
import { XIcon } from '@/components/ui/icons';
import { Modal } from '@/components/ui/Modal';
import { GroupDTO, GroupMember } from '@billsplit-wl/shared';
import { signal } from '@preact/signals';
import { useComputed } from '@preact/signals';
import { useCallback, useMemo, useState } from 'preact/hooks';
import { useTranslation } from 'react-i18next';
import { Tooltip } from '../ui';
import { DeleteGroupConfirmationModal } from './DeleteGroupConfirmationModal';
import { GroupGeneralTabContent } from './settings/GroupGeneralTabContent';
import { GroupIdentityTabContent } from './settings/GroupIdentityTabContent';
import { GroupSecurityTabContent } from './settings/security/GroupSecurityTabContent';

type GroupSettingsTab = 'identity' | 'general' | 'security';

interface GroupSettingsModalProps {
    isOpen: boolean;
    group: GroupDTO;
    members: GroupMember[];
    canManageMembers: boolean;
    canApproveMembers: boolean;
    canManageSettings: boolean;
    onClose: () => void;
    onGroupUpdated?: () => Promise<void> | void;
    onDelete?: () => void;
    initialTab?: GroupSettingsTab;
}

export function GroupSettingsModal({
    isOpen,
    group,
    members,
    canManageMembers,
    canApproveMembers,
    canManageSettings,
    onClose,
    onGroupUpdated,
    onDelete,
    initialTab = 'general',
}: GroupSettingsModalProps) {
    const { t } = useTranslation();

    const authStore = useAuthRequired();
    const currentUser = useComputed(() => authStore.user);
    const loadingMembers = useComputed(() => enhancedGroupDetailStore.loadingMembers);

    const displayNameState = useGroupDisplayName({
        groupId: group.id,
        members,
        currentUserUid: currentUser.value?.uid,
        isOpen,
        t,
        onGroupUpdated,
    });

    // Check if current user is admin - needed to show general tab even when locked
    const currentUserMember = members.find((m) => m.uid === currentUser.value?.uid);
    const isCurrentUserAdmin = currentUserMember?.memberRole === 'admin';

    // Admins can access general settings, OR access general tab when locked (to unlock)
    const canManageGeneralSettings = canManageSettings || (group.locked && isCurrentUserAdmin);

    const generalTabState = useGroupGeneralTabSettings({
        group,
        isOpen,
        canManageGeneralSettings,
        t,
        onGroupUpdated,
        onClose,
        onDelete,
    });

    const generalTabAvailable = canManageGeneralSettings;
    const identityTabAvailable = true;
    const securityTabAvailable = canManageSettings || canManageMembers || canApproveMembers;

    const securitySettingsState = useGroupSecuritySettings({
        group,
        members,
        isOpen,
        securityTabAvailable,
        canManageMembers,
        canApproveMembers,
        t,
        onGroupUpdated,
    });

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

    // Component-local signals
    const [activeTabSignal] = useState(() => signal<GroupSettingsTab | null>(defaultTab));
    const activeTab = activeTabSignal.value;

    // Reset to default tab when modal opens
    useModalOpen(isOpen, {
        onOpen: useCallback(() => {
            activeTabSignal.value = defaultTab;
        }, [defaultTab]),
    });

    const renderIdentityTab = () => {
        const user = currentUser.value;
        if (!user) {
            return null;
        }

        const groupMember = members.find((member) => member.uid === user.uid);
        if (!groupMember && !loadingMembers.value) {
            return null;
        }

        return (
            <GroupIdentityTabContent
                displayName={displayNameState.displayName}
                validationError={displayNameState.validationError}
                serverError={displayNameState.serverError}
                successMessage={displayNameState.successMessage}
                isSaving={displayNameState.isSaving}
                isDirty={displayNameState.isDirty}
                isLoading={loadingMembers.value}
                onDisplayNameChange={displayNameState.handleChange}
                onSubmit={displayNameState.handleSubmit}
            />
        );
    };

    const renderGeneralTab = () => {
        if (!canManageGeneralSettings) {
            return null;
        }

        return (
            <GroupGeneralTabContent
                groupName={generalTabState.groupName}
                groupDescription={generalTabState.groupDescription}
                onGroupNameChange={generalTabState.setGroupName}
                onGroupDescriptionChange={generalTabState.setGroupDescription}
                currencyEnabled={generalTabState.currencyEnabled}
                permittedCurrencies={generalTabState.permittedCurrencies}
                defaultCurrency={generalTabState.defaultCurrency}
                onToggleCurrencyEnabled={generalTabState.toggleCurrencyEnabled}
                onAddCurrency={generalTabState.addCurrency}
                onRemoveCurrency={generalTabState.removeCurrency}
                onSetDefaultCurrency={generalTabState.setDefaultCurrency}
                locked={generalTabState.locked}
                onToggleLocked={generalTabState.toggleLocked}
                isSubmitting={generalTabState.isSubmitting}
                validationError={generalTabState.validationError}
                successMessage={generalTabState.successMessage}
                hasChanges={generalTabState.hasChanges}
                isFormValid={generalTabState.isFormValid}
                onSave={generalTabState.handleSave}
                onCancel={generalTabState.handleCancel}
                onDeleteClick={generalTabState.handleDeleteClick}
            />
        );
    };

    const renderSecurityTab = () => (
        <GroupSecurityTabContent
            permissionDraft={securitySettingsState.permissionDraft}
            selectedPreset={securitySettingsState.selectedPreset}
            isSaving={securitySettingsState.isSaving}
            hasPermissionChanges={securitySettingsState.hasPermissionChanges}
            hasSecurityChanges={securitySettingsState.hasSecurityChanges}
            successMessage={securitySettingsState.successMessage}
            actionError={securitySettingsState.actionError}
            presetKeys={securitySettingsState.presetKeys}
            members={members}
            memberRoleDrafts={securitySettingsState.memberRoleDrafts}
            canManageMembers={canManageMembers}
            pendingMembers={securitySettingsState.pendingMembers}
            loadingPending={securitySettingsState.loadingPending}
            pendingError={securitySettingsState.pendingError}
            pendingActionMember={securitySettingsState.pendingActionMember}
            canApproveMembers={canApproveMembers}
            onApplyPreset={securitySettingsState.applyPreset}
            onSave={securitySettingsState.saveSecuritySettings}
            onClose={onClose}
            onPermissionChange={securitySettingsState.handlePermissionChange}
            onRoleChange={securitySettingsState.updateMemberRoleDraft}
            onApprovePending={(memberId) => securitySettingsState.handlePendingAction(memberId, 'approve')}
            onRejectPending={(memberId) => securitySettingsState.handlePendingAction(memberId, 'reject')}
        />
    );

    return (
        <>
            <Modal
                open={isOpen}
                onClose={generalTabState.deleteState.showConfirm ? undefined : onClose}
                size='lg'
                className='max-w-3xl'
                labelledBy='group-settings-modal-title'
            >
                <div className='flex items-center justify-between px-6 py-4 border-b border-border-default'>
                    <div>
                        <h2 id='group-settings-modal-title' className='text-lg font-semibold text-text-primary'>
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
                            eventName='modal_close'
                            eventProps={{ modalName: 'group_settings', method: 'x_button' }}
                        >
                            <XIcon size={20} />
                        </Clickable>
                    </Tooltip>
                </div>

                {availableTabs.length > 1 && (
                    <div className='px-6 pt-4 border-b border-border-default'>
                        <nav className='flex gap-4' role='tablist' aria-label={t('groupSettingsModal.title')}>
                            {availableTabs.map((tab) => {
                                const isActive = tab === activeTab;
                                return (
                                    <Clickable
                                        as='button'
                                        key={tab}
                                        type='button'
                                        role='tab'
                                        aria-selected={isActive}
                                        onClick={() => {
                                            activeTabSignal.value = tab;
                                        }}
                                        className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
                                            isActive
                                                ? 'border-interactive-primary text-interactive-primary'
                                                : 'border-transparent text-text-muted hover:text-text-primary hover:border-border-default'
                                        }`}
                                        eventName='modal_tab_change'
                                        eventProps={{ modalName: 'group_settings', tab }}
                                    >
                                        {translateGroupSettingsTab(tab, t)}
                                    </Clickable>
                                );
                            })}
                        </nav>
                    </div>
                )}

                <div className='max-h-[70vh] overflow-y-auto px-6 py-5'>
                    {activeTab === 'identity' && identityTabAvailable && renderIdentityTab()}
                    {activeTab === 'general' && generalTabAvailable && renderGeneralTab()}
                    {activeTab === 'security' && securityTabAvailable && renderSecurityTab()}
                </div>
            </Modal>

            <DeleteGroupConfirmationModal
                isOpen={generalTabState.deleteState.showConfirm}
                groupName={group.name}
                confirmationText={generalTabState.deleteState.confirmationText}
                onConfirmationTextChange={generalTabState.setConfirmationText}
                onConfirm={generalTabState.handleDeleteConfirm}
                onCancel={generalTabState.handleDeleteCancel}
                isDeleting={generalTabState.deleteState.isDeleting}
                error={generalTabState.deleteState.error}
            />
        </>
    );
}
