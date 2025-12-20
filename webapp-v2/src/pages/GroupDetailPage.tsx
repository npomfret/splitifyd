import { ExpenseDetailModal } from '@/components/expense';
import { ExpenseFormModal } from '@/components/expense-form';
import {
    ActivitySection,
    BalancesSection,
    ExpensesSection,
    GroupActions,
    GroupCommentsSection,
    GroupHeader,
    GroupSettingsModal,
    LeaveGroupDialog,
    MembersListWithManagement,
    SettlementsSection,
    ShareGroupModal,
} from '@/components/group';
import { SettlementForm } from '@/components/settlements';
import { Alert, Button, Card, LoadingSpinner, Stack, Typography } from '@/components/ui';
import { GROUP_DETAIL_ERROR_CODES } from '@/constants/error-codes.ts';
import { navigationService } from '@/services/navigation.service';
import { permissionsStore } from '@/stores/permissions-store.ts';
import type { ExpenseId, GroupId, SettlementWithMembers, SimplifiedDebt } from '@billsplit-wl/shared';
import { MemberRoles, MemberStatuses, toExpenseId } from '@billsplit-wl/shared';
import { useComputed, useSignal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import { useTranslation } from 'react-i18next';
import { useAuthRequired } from '../app/hooks/useAuthRequired';
import { useGroupModals } from '../app/hooks/useGroupModals';
import { enhancedGroupDetailStore } from '../app/stores/group-detail-store-enhanced';
import { enhancedGroupsStore } from '../app/stores/groups-store-enhanced';
import { BaseLayout } from '../components/layout/BaseLayout';
import { GroupDetailGrid } from '../components/layout/GroupDetailGrid';
import { logError, logWarning } from '../utils/browser-logger';

interface GroupDetailPageProps {
    id?: GroupId;
    expenseId?: string; // From route param for deep linking to expense detail
}

export function GroupDetailPage({ id: groupId, expenseId: routeExpenseId }: GroupDetailPageProps) {
    const { t } = useTranslation();
    const isInitialized = useSignal(false);
    const showLeaveGroupDialog = useSignal(false);
    const membershipActionInFlight = useSignal(false);

    // Use the modal management hook
    const modals = useGroupModals();

    // Computed values from store - only what's needed by this component
    const group = useComputed(() => enhancedGroupDetailStore.group);
    const loading = useComputed(() => enhancedGroupDetailStore.loading);
    const error = useComputed(() => enhancedGroupDetailStore.error);
    const members = useComputed(() => enhancedGroupDetailStore.members);
    const balances = useComputed(() => enhancedGroupDetailStore.balances);
    const commentsResponse = useComputed(() => enhancedGroupDetailStore.commentsResponse);
    const showDeletedExpenses = useComputed(() => enhancedGroupDetailStore.showDeletedExpenses);
    const showDeletedSettlements = useComputed(() => enhancedGroupDetailStore.showDeletedSettlements);
    const isGroupLocked = useComputed(() => group.value?.locked ?? false);

    const locationHash = typeof window !== 'undefined' ? window.location.hash : '';
    const expandActivitySection = locationHash === '#activity';
    const expandSettlementSection = locationHash === '#settlements';
    const expandCommentsSection = locationHash === '#comments';

    // Auth store via hook
    const authStore = useAuthRequired();
    const currentUser = useComputed(() => authStore.user);
    const currentMembership = useComputed(() => members.value.find((member) => member.uid === currentUser.value?.uid) ?? null);
    const membershipStatus = useComputed(() => currentMembership.value?.memberStatus ?? MemberStatuses.ACTIVE);
    const isArchivedMembership = useComputed(() => membershipStatus.value === MemberStatuses.ARCHIVED);
    const userPermissions = useComputed(() => permissionsStore.permissions.value || {});
    const emailVerificationRequired = useComputed(() => permissionsStore.emailVerificationRequired.value);
    const canManageSettings = useComputed(() => Boolean(userPermissions.value.canManageSettings));
    const canApproveMembers = useComputed(() => Boolean(userPermissions.value.canApproveMembers));
    const isGroupMember = useComputed(() => members.value.some((member) => member.uid === currentUser.value?.uid));
    const canShowSettingsButton = useComputed(() => Boolean(canManageSettings.value || canApproveMembers.value || isGroupMember.value));
    const canViewDeletedTransactions = useComputed(() => {
        if (!currentUser.value || !group.value) {
            return false;
        }

        const role = currentMembership.value?.memberRole;
        if (role === MemberRoles.ADMIN) {
            return true;
        }

        const permissions = userPermissions.value;
        if (!permissions) {
            return false;
        }

        return Boolean(permissions.canDeleteAnyExpense || permissions.canEditAnyExpense || permissions.canManageSettings);
    });

    useEffect(() => {
        if (!canViewDeletedTransactions.value) {
            if (showDeletedExpenses.value) {
                enhancedGroupDetailStore.setShowDeletedExpenses(false);
            }
            if (showDeletedSettlements.value) {
                enhancedGroupDetailStore.setShowDeletedSettlements(false);
            }
        }
    }, [canViewDeletedTransactions.value]);

    // Check if user can leave group (not the owner and not the last member)
    const isLastMember = useComputed(() => members.value.length === 1);
    const hasOutstandingBalance = useComputed(() => {
        if (!balances.value?.simplifiedDebts || !currentUser.value) return false;

        // Check if current user appears in any debt relationship
        return balances.value.simplifiedDebts.some((debt) => debt.from.uid === currentUser.value?.uid || debt.to.uid === currentUser.value?.uid);
    });
    // Users can leave if they're not the only member (server enforces last admin protection)
    const canLeaveGroup = useComputed(() => !isLastMember.value);

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

    const errorValue = error.value;
    const groupValue = group.value;
    const shouldRedirectToDashboard = errorValue === GROUP_DETAIL_ERROR_CODES.GROUP_DELETED || errorValue === GROUP_DETAIL_ERROR_CODES.USER_REMOVED_FROM_GROUP;
    const shouldRedirectToNotFoundFromError = typeof errorValue === 'string' && (/not found/i.test(errorValue) || errorValue === 'NOT_FOUND');
    const shouldRedirectToNotFoundFromMissingGroup = isInitialized.value && !groupValue && !errorValue;
    const shouldShowInlineError = Boolean(errorValue) && !shouldRedirectToDashboard && !shouldRedirectToNotFoundFromError;

    useEffect(() => {
        if (!shouldRedirectToDashboard) {
            return;
        }

        void navigationService.goToDashboard();
    }, [shouldRedirectToDashboard]);

    useEffect(() => {
        if (!shouldRedirectToNotFoundFromError) {
            return;
        }

        void navigationService.goToNotFound();
    }, [shouldRedirectToNotFoundFromError]);

    useEffect(() => {
        if (!shouldRedirectToNotFoundFromMissingGroup) {
            return;
        }

        void navigationService.goToNotFound();
    }, [shouldRedirectToNotFoundFromMissingGroup]);

    // Deep link detection - auto-open modals from URL
    useEffect(() => {
        if (!groupId || !isInitialized.value) return;

        const path = typeof window !== 'undefined' ? window.location.pathname : '';
        const search = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;

        // Check for expense detail: /groups/:groupId/expenses/:expenseId
        // Use routeExpenseId from props (from router) for reactive updates on client navigation
        if (routeExpenseId) {
            modals.openExpenseDetail(toExpenseId(routeExpenseId));
            history.replaceState(null, '', `/groups/${groupId}`);
            return;
        }

        // Fallback: check URL pattern for initial page load deep links
        const expenseDetailMatch = path.match(/\/groups\/[^/]+\/expenses\/([^/]+)/);
        if (expenseDetailMatch) {
            modals.openExpenseDetail(toExpenseId(expenseDetailMatch[1]));
            history.replaceState(null, '', `/groups/${groupId}`);
            return;
        }

        // Check for add/edit/copy expense: /groups/:groupId/add-expense
        if (path.includes('/add-expense') && search) {
            const id = search.get('id');
            const isEdit = search.get('edit') === 'true';
            const isCopy = search.get('copy') === 'true';
            const sourceId = search.get('sourceId');

            if (isEdit && id) {
                modals.openExpenseForm('edit', toExpenseId(id));
            } else if (isCopy && sourceId) {
                modals.openExpenseForm('copy', toExpenseId(sourceId));
            } else {
                modals.openExpenseForm('add');
            }
            history.replaceState(null, '', `/groups/${groupId}`);
            return;
        }
    }, [groupId, isInitialized.value, routeExpenseId]);

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

    if (shouldRedirectToDashboard || shouldRedirectToNotFoundFromError || shouldRedirectToNotFoundFromMissingGroup) {
        return (
            <BaseLayout>
                <div className='container mx-auto px-4 py-8'>
                    <LoadingSpinner />
                </div>
            </BaseLayout>
        );
    }

    if (shouldShowInlineError && typeof errorValue === 'string') {
        return (
            <BaseLayout>
                <div className='container mx-auto px-4 py-8' role='alert'>
                    <Card className='p-6 text-center'>
                        <Typography variant='heading' className='mb-2'>{t('pages.groupDetailPage.errorLoadingGroup')}</Typography>
                        <p className='text-text-muted mb-4'>{errorValue}</p>
                        <Button variant='primary' onClick={() => navigationService.goToDashboard()}>
                            {t('pages.groupDetailPage.backToDashboard')}
                        </Button>
                    </Card>
                </div>
            </BaseLayout>
        );
    }

    if (!groupValue) {
        return (
            <BaseLayout>
                <div className='container mx-auto px-4 py-8'>
                    <LoadingSpinner />
                </div>
            </BaseLayout>
        );
    }

    // Handle click events
    const handleExpenseClick = (expense: { id: ExpenseId; }) => {
        modals.openExpenseDetail(expense.id);
    };

    const handleExpenseCopy = (expense: { id: ExpenseId; }) => {
        modals.openExpenseForm('copy', expense.id);
    };

    const handleAddExpense = () => {
        modals.openExpenseForm('add');
    };

    const handleEditExpenseFromDetail = (expenseId: ExpenseId) => {
        modals.closeExpenseDetail();
        modals.openExpenseForm('edit', expenseId);
    };

    const handleCopyExpenseFromDetail = (expenseId: ExpenseId) => {
        modals.closeExpenseDetail();
        modals.openExpenseForm('copy', expenseId);
    };

    const handleSettleUp = (preselectedDebt?: SimplifiedDebt) => {
        // Only pass preselectedDebt if it's actually a debt object (not a DOM event)
        const debt = preselectedDebt && typeof preselectedDebt === 'object' && 'from' in preselectedDebt ? preselectedDebt : undefined;
        modals.openSettlementForm(undefined, debt);
    };

    const handleEditSettlement = (settlement: SettlementWithMembers) => {
        modals.openSettlementForm(settlement);
    };

    const handleShare = () => {
        modals.openShareModal();
    };

    const handleSettings = () => {
        const defaultTab = canManageSettings.value ? 'general' : 'identity';
        modals.openGroupSettingsModal(defaultTab);
    };

    const handleGroupUpdateSuccess = () => {
        // Activity feed handles refresh automatically via SSE
    };

    const handleGroupDelete = () => {
        // Navigate to dashboard after group deletion
        navigationService.goToDashboard();
    };

    const runMembershipMutation = async (mutation: () => Promise<void>) => {
        if (membershipActionInFlight.value) {
            return;
        }

        membershipActionInFlight.value = true;
        try {
            await mutation();
            await enhancedGroupsStore.refreshGroups();
        } catch (error) {
            logWarning('Failed to update membership archive status', {
                groupId,
                error: error instanceof Error ? error.message : String(error),
            });
        } finally {
            membershipActionInFlight.value = false;
        }
    };

    const handleArchiveGroup = () =>
        runMembershipMutation(async () => {
            await enhancedGroupDetailStore.archiveGroup();
        });

    const handleUnarchiveGroup = () =>
        runMembershipMutation(async () => {
            await enhancedGroupDetailStore.unarchiveGroup();
        });

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
                            onInviteClick={isGroupLocked.value ? undefined : handleShare}
                            onLeaveGroupClick={handleLeaveGroup}
                        />

                        <GroupActions
                            onAddExpense={isGroupLocked.value ? undefined : handleAddExpense}
                            onSettleUp={isGroupLocked.value ? undefined : handleSettleUp}
                            onShare={isGroupLocked.value ? undefined : handleShare}
                            onSettings={handleSettings}
                            onLeaveGroup={canLeaveGroup.value ? handleLeaveGroup : undefined}
                            showSettingsButton={canShowSettingsButton.value}
                            canLeaveGroup={canLeaveGroup.value}
                            variant='vertical'
                            onArchive={!isArchivedMembership.value ? handleArchiveGroup : undefined}
                            onUnarchive={isArchivedMembership.value ? handleUnarchiveGroup : undefined}
                            isArchived={isArchivedMembership.value}
                            membershipActionDisabled={membershipActionInFlight.value}
                            isGroupLocked={isGroupLocked.value}
                            emailNotVerified={emailVerificationRequired.value}
                        />
                    </>
                }
                mainContent={
                    <Stack spacing='lg'>
                        {/* 1. Header */}
                        <GroupHeader
                            group={group.value!}
                            members={members.value}
                            onSettings={handleSettings}
                            showSettingsButton={canShowSettingsButton.value}
                        />

                        {/* Locked Group Banner */}
                        {isGroupLocked.value && <Alert type='warning' message={t('group.locked.banner')} />}

                        {/* 2. Mobile-only group actions */}
                        <div className='lg:hidden'>
                            <GroupActions
                                onAddExpense={isGroupLocked.value ? undefined : handleAddExpense}
                                onSettleUp={isGroupLocked.value ? undefined : handleSettleUp}
                                onShare={isGroupLocked.value ? undefined : handleShare}
                                onSettings={handleSettings}
                                onLeaveGroup={canLeaveGroup.value ? handleLeaveGroup : undefined}
                                showSettingsButton={canShowSettingsButton.value}
                                canLeaveGroup={canLeaveGroup.value}
                                variant='vertical'
                                onArchive={!isArchivedMembership.value ? handleArchiveGroup : undefined}
                                onUnarchive={isArchivedMembership.value ? handleUnarchiveGroup : undefined}
                                isArchived={isArchivedMembership.value}
                                membershipActionDisabled={membershipActionInFlight.value}
                                isGroupLocked={isGroupLocked.value}
                                emailNotVerified={emailVerificationRequired.value}
                            />
                        </div>

                        {/* 3. Mobile-only balance summary */}
                        <div className='lg:hidden'>
                            <BalancesSection onSettleUp={handleSettleUp} idSuffix='mobile' />
                        </div>

                        {/* 4. Mobile-only comments */}
                        <div className='lg:hidden'>
                            <GroupCommentsSection
                                groupId={groupId!}
                                initialData={commentsResponse.value}
                                defaultCollapsed={!expandCommentsSection}
                                idSuffix='mobile'
                            />
                        </div>

                        {/* 5. Expenses (always visible) */}
                        <ExpensesSection
                            onExpenseClick={handleExpenseClick}
                            onExpenseCopy={handleExpenseCopy}
                            canToggleShowDeleted={canViewDeletedTransactions.value}
                            showDeletedExpenses={showDeletedExpenses.value}
                            onShowDeletedChange={canViewDeletedTransactions.value
                                ? (show) => {
                                    enhancedGroupDetailStore.setShowDeletedExpenses(show);
                                    enhancedGroupDetailStore.refreshAll();
                                }
                                : undefined}
                        />

                        {/* 6. Mobile-only settlement history */}
                        <div className='lg:hidden'>
                            <SettlementsSection
                                groupId={groupId!}
                                onEditSettlement={handleEditSettlement}
                                canToggleShowDeleted={canViewDeletedTransactions.value}
                                showDeletedSettlements={showDeletedSettlements.value}
                                onShowDeletedChange={canViewDeletedTransactions.value
                                    ? (show) => {
                                        enhancedGroupDetailStore.setShowDeletedSettlements(show);
                                        enhancedGroupDetailStore.refreshAll();
                                    }
                                    : undefined}
                                defaultCollapsed={!expandSettlementSection}
                                idSuffix='mobile'
                            />
                        </div>

                        {/* 7. Mobile-only members list */}
                        <div className='lg:hidden'>
                            <MembersListWithManagement
                                groupId={groupId!}
                                variant='sidebar'
                                onInviteClick={isGroupLocked.value ? undefined : handleShare}
                                onLeaveGroupClick={handleLeaveGroup}
                            />
                        </div>

                        {/* 8. Mobile-only activity feed */}
                        <div className='lg:hidden'>
                            <ActivitySection
                                groupId={groupId!}
                                currentUserId={currentUser.value!.uid}
                                defaultCollapsed={!expandActivitySection}
                                idSuffix='mobile'
                            />
                        </div>
                    </Stack>
                }
                rightSidebar={
                    <div className='hidden lg:block space-y-4'>
                        {/* Desktop-only: all right sidebar content (mobile versions in mainContent) */}
                        <BalancesSection onSettleUp={handleSettleUp} />

                        <ActivitySection
                            groupId={groupId!}
                            currentUserId={currentUser.value!.uid}
                            defaultCollapsed={!expandActivitySection}
                        />

                        <SettlementsSection
                            groupId={groupId!}
                            onEditSettlement={handleEditSettlement}
                            canToggleShowDeleted={canViewDeletedTransactions.value}
                            showDeletedSettlements={showDeletedSettlements.value}
                            onShowDeletedChange={canViewDeletedTransactions.value
                                ? (show) => {
                                    enhancedGroupDetailStore.setShowDeletedSettlements(show);
                                    enhancedGroupDetailStore.refreshAll();
                                }
                                : undefined}
                            defaultCollapsed={!expandSettlementSection}
                        />

                        <GroupCommentsSection
                            groupId={groupId!}
                            initialData={commentsResponse.value}
                            defaultCollapsed={!expandCommentsSection}
                        />
                    </div>
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
                    canManageMembers={canManageSettings.value ?? false}
                    canApproveMembers={canApproveMembers.value ?? false}
                    canManageSettings={canManageSettings.value ?? false}
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
                onSuccess={() => modals.closeSettlementForm()}
            />

            {/* Expense Form Modal */}
            <ExpenseFormModal
                isOpen={modals.showExpenseForm.value}
                onClose={() => modals.closeExpenseForm()}
                groupId={groupId!}
                mode={modals.expenseFormMode.value}
                expenseId={modals.targetExpenseId.value}
            />

            {/* Expense Detail Modal */}
            <ExpenseDetailModal
                isOpen={modals.showExpenseDetail.value}
                onClose={() => modals.closeExpenseDetail()}
                groupId={groupId!}
                expenseId={modals.targetExpenseId.value}
                onEdit={handleEditExpenseFromDetail}
                onCopy={handleCopyExpenseFromDetail}
            />

            {/* Leave Group Dialog */}
            <LeaveGroupDialog isOpen={showLeaveGroupDialog.value} onClose={() => (showLeaveGroupDialog.value = false)} groupId={groupId!} hasOutstandingBalance={hasOutstandingBalance.value} />
        </BaseLayout>
    );
}
