import { apiClient } from '@/app/apiClient';
import { useAuthRequired } from '@/app/hooks/useAuthRequired';
import { enhancedGroupDetailStore } from '@/app/stores/group-detail-store-enhanced';
import { Button, Card, ConfirmDialog, MemberDisplay, SidebarCard, SkeletonList, SkeletonMemberItem, Tooltip, Typography } from '@/components/ui';
import { navigationService } from '@/services/navigation.service';
import { logError } from '@/utils/browser-logger';
import { getGroupDisplayName } from '@/utils/displayName';
import { GroupId, GroupMember } from '@billsplit-wl/shared';
import { ChevronDownIcon, UserMinusIcon, UserPlusIcon } from '@heroicons/react/24/outline';
import { useComputed, useSignal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import { useTranslation } from 'react-i18next';

interface MembersListWithManagementProps {
    groupId: GroupId;
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
    const balances = useComputed(() => enhancedGroupDetailStore.balances);
    const loading = useComputed(() => enhancedGroupDetailStore.loadingMembers);
    const currentUser = useComputed(() => authStore.user);
    const memberCount = useComputed(() => members.value.length);
    const isCollapsed = useSignal(true);

    const currentUserId = currentUser.value?.uid || '';
    const currentMembership = members.value.find((m) => m.uid === currentUserId);
    const isAdmin = currentMembership?.memberRole === 'admin';

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
                <SkeletonList>{SkeletonMemberItem}</SkeletonList>
            </Card>
        );
    }

    const membersList = (
        <>
            <ul
                className='max-h-[300px] overflow-y-auto overflow-x-hidden pr-1 scrollbar-thin scrollbar-thumb-border-default scrollbar-track-transparent hover:scrollbar-thumb-border-strong space-y-2'
                aria-label={t('membersList.title')}
            >
                {members.value.map((member) => {
                    const memberTheme = member.themeColor;
                    return (
                        <li
                            key={member.uid}
                            className='flex items-center justify-between py-1.5 px-1.5 rounded-md hover:bg-surface-muted transition-colors list-none'
                            aria-label={getGroupDisplayName(member)}
                        >
                            <MemberDisplay
                                displayName={getGroupDisplayName(member)}
                                userId={member.uid}
                                themeColor={memberTheme}
                                isCurrentUser={member.uid === currentUserId}
                                secondaryText={getMemberRole(member) || undefined}
                                className='flex-1'
                            />
                            {/* Show actions only if current user is admin */}
                            {isAdmin && member.uid !== currentUserId
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
                                                ariaLabel={removeMemberLabel}
                                                className='shrink-0'
                                            >
                                                <UserMinusIcon className='h-4 w-4' aria-hidden='true' />
                                            </Button>
                                        </Tooltip>
                                    );
                                })()
                                : null}
                        </li>
                    );
                })}
            </ul>
        </>
    );

    const toggleLabel = t('pages.groupDetailPage.toggleSection', { section: t('membersList.title') });
    const titleContent = (
        <span className='flex items-baseline gap-1.5'>
            <span>{t('membersList.title')}</span>
            <span className='text-sm font-medium text-text-muted'>({memberCount.value})</span>
        </span>
    );
    const headerClasses = ['flex', 'items-center', 'justify-between', 'gap-2', !isCollapsed.value ? 'mb-4' : ''].filter(Boolean).join(' ');
    const inviteTooltip = t('membersList.inviteOthers');
    const inviteAriaLabel = t('groupActions.inviteOthers');
    const inviteButton = onInviteClick
        ? (
            <Tooltip content={inviteTooltip}>
                <Button
                    type='button'
                    onClick={onInviteClick}
                    ariaLabel={inviteAriaLabel}
                    variant='ghost'
                    size='sm'
                    className='rounded-full'
                >
                    <UserPlusIcon aria-hidden='true' className='h-5 w-5' />
                </Button>
            </Tooltip>
        )
        : null;

    const content = variant === 'sidebar'
        ? (
            <SidebarCard
                title={titleContent}
                collapsible
                defaultCollapsed
                ariaLabel={t('membersList.title')}
                collapseToggleLabel={toggleLabel}
                headerActions={inviteButton}
            >
                {membersList}
            </SidebarCard>
        )
        : (
            <Card ariaLabel={t('membersList.title')}>
                <div className={headerClasses}>
                    <Typography variant='subheading' as='h2' className='flex items-baseline gap-2'>
                        <span>{t('membersList.title')}</span>
                        <span className='text-sm font-medium text-text-muted'>({memberCount.value})</span>
                    </Typography>
                    <div className='flex items-center gap-1.5'>
                        {inviteButton}
                        <Tooltip content={toggleLabel}>
                            <Button
                                type='button'
                                onClick={() => (isCollapsed.value = !isCollapsed.value)}
                                ariaLabel={toggleLabel}
                                aria-expanded={!isCollapsed.value}
                                variant='ghost'
                                size='sm'
                                className='rounded-full'
                            >
                                <ChevronDownIcon
                                    aria-hidden='true'
                                    className={`h-5 w-5 transform transition-transform duration-200 ${isCollapsed.value ? '-rotate-90' : 'rotate-0'}`}
                                />
                            </Button>
                        </Tooltip>
                    </div>
                </div>
                {!isCollapsed.value && membersList}
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
            />
        </>
    );
}
