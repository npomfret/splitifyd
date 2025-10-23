import { apiClient } from '@/app/apiClient';
import { useAuthRequired } from '@/app/hooks/useAuthRequired';
import { enhancedGroupDetailStore } from '@/app/stores/group-detail-store-enhanced';
import { Avatar, Button, Card, ConfirmDialog, LoadingSpinner, Tooltip } from '@/components/ui';
import { navigationService } from '@/services/navigation.service';
import { logError } from '@/utils/browser-logger';
import { getGroupDisplayName } from '@/utils/displayName';
import { UserMinusIcon, UserPlusIcon } from '@heroicons/react/24/outline';
import { useComputed, useSignal } from '@preact/signals';
import { GroupMember } from '@splitifyd/shared';
import { useEffect } from 'preact/hooks';
import { useTranslation } from 'react-i18next';

interface MembersListWithManagementProps {
    groupId: string;
    variant?: 'default' | 'sidebar';
    onInviteClick?: () => void;
    onMemberChange?: () => void;
    onLeaveGroupClick?: () => void;
}

export function MembersListWithManagement({ groupId, variant = 'default', onInviteClick, onMemberChange, onLeaveGroupClick }: MembersListWithManagementProps) {
    const { t } = useTranslation();
    const showLeaveConfirm = useSignal(false);
    const showRemoveConfirm = useSignal(false);
    const memberToRemove = useSignal<GroupMember | null>(null);
    const isProcessing = useSignal(false);

    // Auth store via hook
    const authStore = useAuthRequired();

    // Fetch data directly from stores
    const members = useComputed(() => enhancedGroupDetailStore.members);
    const group = useComputed(() => enhancedGroupDetailStore.group);
    const balances = useComputed(() => enhancedGroupDetailStore.balances);
    const loading = useComputed(() => enhancedGroupDetailStore.loadingMembers);
    const currentUser = useComputed(() => authStore.user);

    const currentUserId = currentUser.value?.uid || '';
    const createdBy = group.value?.createdBy || '';
    const isOwner = currentUserId === createdBy;

    // Note: Balance display removed - balances are properly handled by BalanceSummary component
    // which respects currency separation. Cross-currency arithmetic is not performed.

    // Check if current user has outstanding balance using simplifiedDebts
    // Important: This must be reactive to both currentUserId and balances changes
    const hasOutstandingBalance = useComputed(() => {
        const currentBalances = balances.value;
        if (!currentBalances?.simplifiedDebts) return false;

        // Check if current user appears in any debt relationship
        return currentBalances.simplifiedDebts.some((debt) => debt.from.uid === currentUserId || debt.to.uid === currentUserId);
    });

    // Check if a specific member has outstanding balance using simplifiedDebts
    const memberHasOutstandingBalance = (memberId: string): boolean => {
        if (!balances.value?.simplifiedDebts) return false;

        // Check if member appears in any debt relationship
        return balances.value.simplifiedDebts.some((debt) => debt.from.uid === memberId || debt.to.uid === memberId);
    };

    // If parent provides handler, let parent control the dialog
    useEffect(() => {
        if (onLeaveGroupClick) {
            // Don't show internal dialog if parent is handling it
            showLeaveConfirm.value = false;
        }
    }, [onLeaveGroupClick]);

    const handleLeaveGroup = async () => {
        if (isProcessing.value) return;

        // Check if user has outstanding balance and prevent leaving if so
        if (hasOutstandingBalance.value) {
            // Don't leave - the dialog should show error message and user can cancel
            return;
        }

        try {
            isProcessing.value = true;
            await apiClient.leaveGroup(groupId);
            // Successfully left - navigation will handle the redirect

            // Navigate to dashboard after leaving
            navigationService.goToDashboard();
        } catch (error: any) {
            logError('Failed to leave group', error);
        } finally {
            isProcessing.value = false;
            showLeaveConfirm.value = false;
        }
    };

    const handleRemoveMember = async () => {
        if (!memberToRemove.value || isProcessing.value) return;

        // Check if member has outstanding balance and prevent removal if so
        if (memberHasOutstandingBalance(memberToRemove.value.uid)) {
            // Don't remove - the dialog should show error message and user can cancel
            return;
        }

        try {
            isProcessing.value = true;
            await apiClient.removeGroupMember(groupId, memberToRemove.value.uid);
            onMemberChange?.();
        } catch (error: any) {
            logError('Failed to remove member', error);
        } finally {
            isProcessing.value = false;
            showRemoveConfirm.value = false;
            memberToRemove.value = null;
        }
    };

    const getMemberRole = (member: GroupMember): string => {
        switch (member.memberRole) {
            case 'admin':
                return t('membersList.admin');
            case 'member':
                return t('membersList.member');
            case 'viewer':
                return t('membersList.viewer');
            default:
                return '';
        }
    };

    if (loading.value) {
        return (
            <Card className='p-6'>
                <LoadingSpinner />
            </Card>
        );
    }

    const membersList = (
        <>
            <div className='space-y-0.5 max-h-[300px] overflow-y-auto overflow-x-hidden pr-1 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent hover:scrollbar-thumb-gray-400'>
                {members.value.map((member) => {
                    const memberTheme = member.themeColor;
                    return (
                        <div
                            key={member.uid}
                            className='flex items-center justify-between py-1.5 px-1.5 rounded-md hover:bg-gray-50 transition-colors'
                            data-testid='member-item'
                            data-member-name={getGroupDisplayName(member)}
                            data-member-id={member.uid}
                        >
                            <div className='flex items-center gap-2 min-w-0 flex-1'>
                                <Avatar displayName={getGroupDisplayName(member)} userId={member.uid} size='sm' themeColor={memberTheme} />
                                <div className='flex flex-col min-w-0 flex-1'>
                                    <span className='font-medium text-gray-900 text-sm truncate leading-tight'>
                                        {getGroupDisplayName(member)}
                                        {member.uid === currentUserId && <span className='text-gray-500 ml-1'>({t('common.you')})</span>}
                                    </span>
                                    {getMemberRole(member) && <span className='text-xs text-gray-500 leading-tight'>{getMemberRole(member)}</span>}
                                </div>
                            </div>
                            {/* Show actions only if current user is owner */}
                            {isOwner && member.uid !== currentUserId
                                ? (() => {
                                    const removeMemberLabel = t('membersList.removeMemberAriaLabel', { name: getGroupDisplayName(member) });

                                    return (
                                        <Tooltip content={removeMemberLabel}>
                                            <Button
                                                variant='ghost'
                                                size='sm'
                                                onClick={() => {
                                                    memberToRemove.value = member;
                                                    showRemoveConfirm.value = true;
                                                }}
                                                disabled={memberHasOutstandingBalance(member.uid)}
                                                data-testid='remove-member-button'
                                                ariaLabel={removeMemberLabel}
                                                className='flex-shrink-0'
                                            >
                                                <UserMinusIcon className='h-4 w-4' aria-hidden='true' />
                                            </Button>
                                        </Tooltip>
                                    );
                                })()
                                : null}
                        </div>
                    );
                })}
            </div>
            {onInviteClick && (
                <Button variant='secondary' size='sm' onClick={onInviteClick} className='w-full mt-2'>
                    <>
                        <UserPlusIcon className='h-4 w-4 mr-1.5' aria-hidden='true' />
                        <span className='text-sm'>{t('membersList.inviteOthers')}</span>
                    </>
                </Button>
            )}
        </>
    );

    const content = variant === 'sidebar'
        ? (
            <div className='border rounded-lg bg-white p-3'>
                <div className='flex justify-between items-center mb-2'>
                    <h3 className='font-semibold text-gray-900 text-sm'>{t('membersList.title')}</h3>
                </div>
                {membersList}
            </div>
        )
        : (
            <Card className='p-6'>
                <h2 className='text-lg font-semibold mb-4'>{t('membersList.title')}</h2>
                {membersList}
            </Card>
        );

    return (
        <>
            {content}

            {/* Leave Group Confirmation - only shown when not controlled by parent */}
            {!onLeaveGroupClick && (
                <ConfirmDialog
                    isOpen={showLeaveConfirm.value}
                    onCancel={() => (showLeaveConfirm.value = false)}
                    onConfirm={handleLeaveGroup}
                    title={t('membersList.leaveGroupDialog.title')}
                    message={hasOutstandingBalance.value ? t('membersList.leaveGroupDialog.messageWithBalance') : t('membersList.leaveGroupDialog.messageConfirm')}
                    confirmText={hasOutstandingBalance.value ? t('common.understood') : t('membersList.leaveGroupDialog.confirmText')}
                    cancelText={t('membersList.leaveGroupDialog.cancelText')}
                    variant={hasOutstandingBalance.value ? 'info' : 'warning'}
                    loading={isProcessing.value}
                    data-testid='leave-group-dialog'
                />
            )}

            {/* Remove Member Confirmation */}
            <ConfirmDialog
                isOpen={showRemoveConfirm.value}
                onCancel={() => {
                    showRemoveConfirm.value = false;
                    memberToRemove.value = null;
                }}
                onConfirm={handleRemoveMember}
                title={t('membersList.removeMemberDialog.title')}
                message={memberToRemove.value
                    ? (memberHasOutstandingBalance(memberToRemove.value.uid)
                        ? t('membersList.removeMemberDialog.messageWithBalance', { name: getGroupDisplayName(memberToRemove.value) })
                        : t('membersList.removeMemberDialog.messageConfirm', { name: getGroupDisplayName(memberToRemove.value) }))
                    : ''}
                confirmText={memberToRemove.value && memberHasOutstandingBalance(memberToRemove.value.uid) ? t('common.understood') : t('membersList.removeMemberDialog.confirmText')}
                cancelText={t('membersList.leaveGroupDialog.cancelText')}
                variant={memberToRemove.value && memberHasOutstandingBalance(memberToRemove.value.uid) ? 'info' : 'warning'}
                loading={isProcessing.value}
                data-testid='remove-member-dialog'
            />
        </>
    );
}
