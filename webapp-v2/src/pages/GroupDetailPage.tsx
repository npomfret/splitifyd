import { CommentsSection } from '@/components/comments';
import { BalanceSummary, ExpensesList, GroupActions, GroupHeader, GroupSettingsModal, LeaveGroupDialog, MembersListWithManagement, ShareGroupModal } from '@/components/group';
import { SettlementForm, SettlementHistory } from '@/components/settlements';
import { Button, Card, LoadingSpinner } from '@/components/ui';
import { Stack } from '@/components/ui';
import { SidebarCard } from '@/components/ui/SidebarCard';
import { navigationService } from '@/services/navigation.service';
import { useComputed, useSignal } from '@preact/signals';
import type { SettlementWithMembers } from '@splitifyd/shared';
import { useEffect } from 'preact/hooks';
import { useTranslation } from 'react-i18next';
import { BanknotesIcon, ChatBubbleLeftIcon, ScaleIcon } from '@heroicons/react/24/outline';
import { useAuthRequired } from '../app/hooks/useAuthRequired';
import { useGroupModals } from '../app/hooks/useGroupModals';
import { enhancedGroupDetailStore } from '../app/stores/group-detail-store-enhanced';
import { permissionsStore } from '@/stores/permissions-store.ts';
import { BaseLayout } from '../components/layout/BaseLayout';
import { GroupDetailGrid } from '../components/layout/GroupDetailGrid';
import { logError, logInfo } from '../utils/browser-logger';

interface GroupDetailPageProps {
    id?: string;
}

export default function GroupDetailPage({ id: groupId }: GroupDetailPageProps) {
    const { t } = useTranslation();
    const isInitialized = useSignal(false);
    const showDeletedExpenses = useSignal(false);
    const showLeaveGroupDialog = useSignal(false);

    // Use the modal management hook
    const modals = useGroupModals();

    // Computed values from store - only what's needed by this component
    const group = useComputed(() => enhancedGroupDetailStore.group);
    const loading = useComputed(() => enhancedGroupDetailStore.loading);
    const error = useComputed(() => enhancedGroupDetailStore.error);
    const members = useComputed(() => enhancedGroupDetailStore.members);
    const balances = useComputed(() => enhancedGroupDetailStore.balances);
    const expenses = useComputed(() => enhancedGroupDetailStore.expenses);
    const commentsResponse = useComputed(() => enhancedGroupDetailStore.commentsResponse);

    // Auth store via hook
    const authStore = useAuthRequired();
    const currentUser = useComputed(() => authStore.user);
    const isGroupOwner = useComputed(() => currentUser.value && group.value && group.value.createdBy === currentUser.value.uid);
    const userPermissions = useComputed(() => permissionsStore.permissions.value || {});
    const canManageSecurity = useComputed(() => Boolean(userPermissions.value.canManageSettings));
    const canApproveMembers = useComputed(() => Boolean(userPermissions.value.canApproveMembers));
    const isGroupMember = useComputed(() => members.value.some((member) => member.uid === currentUser.value?.uid));
    const canShowSettingsButton = useComputed(() => Boolean(isGroupOwner.value || canManageSecurity.value || canApproveMembers.value || isGroupMember.value));

    // Check if user can leave group (not the owner and not the last member)
    const isLastMember = useComputed(() => members.value.length === 1);
    const hasOutstandingBalance = useComputed(() => {
        if (!balances.value?.simplifiedDebts || !currentUser.value) return false;

        // Check if current user appears in any debt relationship
        return balances.value.simplifiedDebts.some((debt) => debt.from.uid === currentUser.value?.uid || debt.to.uid === currentUser.value?.uid);
    });
    // Users can leave if they're not the owner and not the only member left
    const canLeaveGroup = useComputed(() => !isGroupOwner.value && !isLastMember.value);

    // Component should only render if user is authenticated (handled by ProtectedRoute)
    if (!currentUser.value) {
        return null;
    }

    // Fetch group data on mount and subscribe to realtime updates using reference counting
    useEffect(() => {
        if (!groupId || !currentUser.value) return;

        const loadGroup = async () => {
            try {
                // Use new reference-counted API - automatically handles loading and subscription
                await enhancedGroupDetailStore.registerComponent(groupId, currentUser.value!.uid);
                isInitialized.value = true;
            } catch (error) {
                logError('Failed to load group page', error, { groupId });
                isInitialized.value = true;
            }
        };

        // Intentionally not awaited - useEffect cannot be async (React anti-pattern)
        loadGroup();

        // Cleanup on unmount using reference counting
        return () => {
            enhancedGroupDetailStore.deregisterComponent(groupId);
        };
    }, [groupId]); // Only depend on groupId to prevent subscription churn

    // Handle loading state
    if (loading.value && !isInitialized.value) {
        return (
            <BaseLayout>
                <div className='container mx-auto px-4 py-8'>
                    <LoadingSpinner />
                </div>
            </BaseLayout>
        );
    }

    // Handle error state
    if (error.value) {
        // Check if the group was deleted while being viewed
        if (error.value === 'GROUP_DELETED') {
            // Navigate immediately to dashboard for predictable behavior
            navigationService.goToDashboard();
            return null;
        }

        // Check if user was removed from the group while viewing it
        if (error.value === 'USER_REMOVED_FROM_GROUP') {
            // Redirect immediately to dashboard - no need to show message
            navigationService.goToDashboard();
            return null;
        }

        // Check if it's a 404 error (group not found or no access)
        if (error.value.includes('not found') || error.value.includes('Not Found')) {
            // Navigate to 404 page for consistent experience
            navigationService.goToNotFound();
            return null;
        }

        // Other errors show inline
        return (
            <BaseLayout>
                <div className='container mx-auto px-4 py-8' data-testid='error-container'>
                    <Card className='p-6 text-center'>
                        <h2 className='text-xl font-semibold mb-2'>{t('pages.groupDetailPage.errorLoadingGroup')}</h2>
                        <p className='text-gray-600 mb-4'>{error.value}</p>
                        <Button variant='primary' onClick={() => navigationService.goToDashboard()}>
                            {t('pages.groupDetailPage.backToDashboard')}
                        </Button>
                    </Card>
                </div>
            </BaseLayout>
        );
    }

    // Handle no group found or still loading
    if (!group.value) {
        if (isInitialized.value) {
            // Group not found after loading - navigate to 404
            navigationService.goToNotFound();
            return null;
        } else {
            // Still loading
            return (
                <BaseLayout>
                    <div className='container mx-auto px-4 py-8'>
                        <LoadingSpinner />
                    </div>
                </BaseLayout>
            );
        }
    }

    // Handle click events
    const handleExpenseClick = (expense: any) => {
        navigationService.goToExpenseDetail(groupId!, expense.id);
    };

    const handleExpenseCopy = (expense: any) => {
        navigationService.goToCopyExpense(groupId!, expense.id);
    };

    const handleAddExpense = () => {
        navigationService.goToAddExpense(groupId!);
    };

    const handleSettleUp = (preselectedDebt?: any) => {
        modals.openSettlementForm(undefined, preselectedDebt);
    };

    const handleEditSettlement = (settlement: SettlementWithMembers) => {
        modals.openSettlementForm(settlement);
    };

    const handleShare = () => {
        modals.openShareModal();
    };

    const handleSettings = () => {
        const defaultTab = isGroupOwner.value ? 'general' : 'identity';
        modals.openGroupSettingsModal(defaultTab);
    };

    const handleGroupUpdateSuccess = async () => {
        // Since we don't have Firebase websockets for real-time updates yet,
        // we need to manually refresh the group data after a successful update
        logInfo('Group update successful - manually refreshing group data', { groupId });
        await enhancedGroupDetailStore.refreshAll();
    };

    const handleGroupDelete = () => {
        // Navigate to dashboard after group deletion
        navigationService.goToDashboard();
    };

    const handleLeaveGroup = () => {
        showLeaveGroupDialog.value = true;
    };

    // Render group detail
    return (
        <BaseLayout
            title={`${group.value!.name}${t('pages.groupDetailPage.titleSuffix')}`}
            description={`${t('pages.groupDetailPage.manageExpensesFor')}${group.value!.name}`}
            headerVariant='dashboard'
        >
            <GroupDetailGrid
                leftSidebar={
                    <>
                        <MembersListWithManagement
                            groupId={groupId!}
                            variant='sidebar'
                            onInviteClick={handleShare}
                            onMemberChange={() => enhancedGroupDetailStore.refreshAll()}
                            onLeaveGroupClick={handleLeaveGroup}
                        />

                        <GroupActions
                            onAddExpense={handleAddExpense}
                            onSettleUp={handleSettleUp}
                            onShare={handleShare}
                            onSettings={handleSettings}
                            onLeaveGroup={canLeaveGroup.value ? handleLeaveGroup : undefined}
                            showSettingsButton={canShowSettingsButton.value}
                            canLeaveGroup={canLeaveGroup.value}
                            variant='vertical'
                        />
                    </>
                }
                mainContent={
                    <Stack spacing='lg'>
                        <GroupHeader
                            group={group.value!}
                            members={members.value}
                            expenseCount={expenses.value.length}
                            onSettings={handleSettings}
                            showSettingsButton={canShowSettingsButton.value}
                        />

                        {/* Mobile-only quick actions */}
                        <div className='lg:hidden'>
                            <GroupActions
                                onAddExpense={handleAddExpense}
                                onSettleUp={handleSettleUp}
                                onShare={handleShare}
                                onSettings={handleSettings}
                                onLeaveGroup={canLeaveGroup.value ? handleLeaveGroup : undefined}
                                showSettingsButton={canShowSettingsButton.value}
                                canLeaveGroup={canLeaveGroup.value}
                            />
                        </div>

                        <ExpensesList
                            onExpenseClick={handleExpenseClick}
                            onExpenseCopy={handleExpenseCopy}
                            showDeletedExpenses={showDeletedExpenses.value}
                            onShowDeletedChange={(show) => {
                                showDeletedExpenses.value = show;
                                enhancedGroupDetailStore.refreshAll();
                            }}
                        />

                        {/* Mobile-only members list */}
                        <div className='lg:hidden'>
                            <MembersListWithManagement
                                groupId={groupId!}
                                onInviteClick={handleShare}
                                onMemberChange={() => enhancedGroupDetailStore.refreshAll()}
                                onLeaveGroupClick={handleLeaveGroup}
                            />
                        </div>

                        {/* Mobile-only balance summary */}
                        <div className='lg:hidden'>
                            <BalanceSummary onSettleUp={handleSettleUp} />
                        </div>
                    </Stack>
                }
                rightSidebar={
                    <>
                        <BalanceSummary variant='sidebar' onSettleUp={handleSettleUp} />

                        {/* Settlement History Section */}
                        <SidebarCard
                            title={
                                <div className='flex items-center gap-2'>
                                    <BanknotesIcon className='h-5 w-5 text-gray-600' aria-hidden='true' />
                                    <span>{t('pages.groupDetailPage.paymentHistory')}</span>
                                </div>
                            }
                            collapsible
                            defaultCollapsed
                            collapseToggleTestId='toggle-settlements-section'
                            collapseToggleLabel={t('pages.groupDetailPage.toggleSection', { section: t('pages.groupDetailPage.paymentHistory') })}
                        >
                            <SettlementHistory
                                groupId={groupId!}
                                onEditSettlement={handleEditSettlement}
                                showDeletedSettlements={enhancedGroupDetailStore.showDeletedSettlements}
                                onShowDeletedChange={(show) => {
                                    enhancedGroupDetailStore.setShowDeletedSettlements(show);
                                    enhancedGroupDetailStore.refreshAll();
                                }}
                            />
                        </SidebarCard>

                        {/* Comments Section */}
                        <SidebarCard
                            title={
                                <div className='flex items-center gap-2'>
                                    <ChatBubbleLeftIcon className='h-5 w-5 text-gray-600' aria-hidden='true' />
                                    <span>{t('pages.groupDetailPage.comments')}</span>
                                </div>
                            }
                            className='flex-1'
                            collapsible
                            defaultCollapsed
                            collapseToggleTestId='toggle-comments-section'
                            collapseToggleLabel={t('pages.groupDetailPage.toggleSection', { section: t('pages.groupDetailPage.comments') })}
                        >
                            <CommentsSection targetType='group' targetId={groupId!} maxHeight='300px' initialData={commentsResponse.value} />
                        </SidebarCard>
                    </>
                }
            />

            {/* Share Modal */}
            <ShareGroupModal isOpen={modals.showShareModal.value} onClose={() => modals.closeShareModal()} groupId={groupId!} groupName={group.value!.name} />

            {/* Group Settings Modal */}
            {canShowSettingsButton.value && (
                <GroupSettingsModal
                    isOpen={modals.showGroupSettingsModal.value}
                    onClose={() => modals.closeGroupSettingsModal()}
                    group={group.value!}
                    members={members.value}
                    canManageMembers={canManageSecurity.value ?? false}
                    canApproveMembers={canApproveMembers.value ?? false}
                    isGroupOwner={Boolean(isGroupOwner.value)}
                    onGroupUpdated={handleGroupUpdateSuccess}
                    onDelete={handleGroupDelete}
                    initialTab={modals.groupSettingsInitialTab.value}
                />
            )}

            {/* Settlement Form Modal */}
            <SettlementForm
                isOpen={modals.showSettlementForm.value}
                onClose={() => modals.closeSettlementForm()}
                groupId={groupId!}
                editMode={!!modals.settlementToEdit.value}
                settlementToEdit={modals.settlementToEdit.value || undefined}
                preselectedDebt={modals.preselectedDebt.value || undefined}
                onSuccess={() => {
                    // Refresh all data after successful settlement
                    enhancedGroupDetailStore.refreshAll();
                    modals.closeSettlementForm();
                }}
            />

            {/* Leave Group Dialog */}
            <LeaveGroupDialog isOpen={showLeaveGroupDialog.value} onClose={() => (showLeaveGroupDialog.value = false)} groupId={groupId!} hasOutstandingBalance={hasOutstandingBalance.value} />
        </BaseLayout>
    );
}
