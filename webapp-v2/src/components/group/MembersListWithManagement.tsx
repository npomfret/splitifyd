import { useTranslation } from 'react-i18next';
import { useSignal, useComputed } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import { navigationService } from '@/services/navigation.service';
import { Card } from '../ui/Card';
import { LoadingSpinner } from '@/components/ui';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { ConfirmDialog } from '@/components/ui';
import { UserPlusIcon, UserMinusIcon } from '@heroicons/react/24/outline';
import type { GroupMemberDTO } from '@splitifyd/shared';
import { apiClient } from '@/app/apiClient';
import { logError } from '@/utils/browser-logger';
import { enhancedGroupDetailStore } from '@/app/stores/group-detail-store-enhanced';
import { useAuthRequired } from '@/app/hooks/useAuthRequired';

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
    const memberToRemove = useSignal<GroupMemberDTO | null>(null);
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

    const getMemberRole = (member: GroupMemberDTO): string => {
        return member.uid === createdBy ? t('membersList.admin') : '';
    };

    if (loading.value) {
        return (
            <Card className="p-6">
                <LoadingSpinner />
            </Card>
        );
    }

    const membersList = (
        <div className="space-y-3">
            {members.value.map((member) => (
                <div
                    key={member.uid}
                    className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50"
                    data-testid="member-item"
                    data-member-name={member.displayName}
                    data-member-id={member.uid}
                >
                    <div className="flex items-center gap-3">
                        <Avatar displayName={member.displayName || 'User'} userId={member.uid} size="sm" />
                        <div className="flex flex-col">
                            <span className="font-medium text-gray-900 text-sm">
                                {member.displayName}
                                {member.uid === currentUserId && <span className="text-gray-500 ml-1">({t('common.you')})</span>}
                            </span>
                            {getMemberRole(member) && <span className="text-xs text-gray-500">{getMemberRole(member)}</span>}
                        </div>
                    </div>
                    {/* Show actions only if current user is owner */}
                    {isOwner && member.uid !== currentUserId ? (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                                memberToRemove.value = member;
                                showRemoveConfirm.value = true;
                            }}
                            disabled={memberHasOutstandingBalance(member.uid)}
                            data-testid="remove-member-button"
                        >
                            <UserMinusIcon className="h-4 w-4" />
                        </Button>
                    ) : null}
                </div>
            ))}
            {onInviteClick && (
                <Button variant="secondary" size="sm" onClick={onInviteClick} className="w-full">
                    <>
                        <UserPlusIcon className="h-4 w-4 mr-1" />
                        {t('membersList.inviteOthers')}
                    </>
                </Button>
            )}
        </div>
    );

    const content =
        variant === 'sidebar' ? (
            <div className="border rounded-lg bg-white p-4 space-y-4">
                <div className="flex justify-between items-center">
                    <h3 className="font-semibold text-gray-900">{t('membersList.title')}</h3>
                </div>
                {membersList}
            </div>
        ) : (
            <Card className="p-6">
                <h2 className="text-lg font-semibold mb-4">{t('membersList.title')}</h2>
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
                    data-testid="leave-group-dialog"
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
                message={
                    memberToRemove.value && memberHasOutstandingBalance(memberToRemove.value.uid)
                        ? t('membersList.removeMemberDialog.messageWithBalance', { name: memberToRemove.value.displayName || t('membersList.thisMember') })
                        : t('membersList.removeMemberDialog.messageConfirm', { name: memberToRemove.value?.displayName || t('membersList.thisMember') })
                }
                confirmText={memberToRemove.value && memberHasOutstandingBalance(memberToRemove.value.uid) ? t('common.understood') : t('membersList.removeMemberDialog.confirmText')}
                cancelText={t('membersList.leaveGroupDialog.cancelText')}
                variant={memberToRemove.value && memberHasOutstandingBalance(memberToRemove.value.uid) ? 'info' : 'warning'}
                loading={isProcessing.value}
                data-testid="remove-member-dialog"
            />
        </>
    );
}
