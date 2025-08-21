import { useEffect } from 'preact/hooks';
import { route } from 'preact-router';
import { useSignal, useComputed } from '@preact/signals';
import { enhancedGroupDetailStore } from '../app/stores/group-detail-store-enhanced';
import { useAuthRequired } from '../app/hooks/useAuthRequired';
import { BaseLayout } from '../components/layout/BaseLayout';
import { GroupDetailGrid } from '../components/layout/GroupDetailGrid';
import { LoadingSpinner, Card, Button } from '@/components/ui';
import { Stack } from '@/components/ui';
import { GroupActions, GroupHeader, MembersListWithManagement, ExpensesList, BalanceSummary, ShareGroupModal, EditGroupModal } from '@/components/group';
import { SettlementForm, SettlementHistory } from '@/components/settlements';
import { SidebarCard } from '@/components/ui/SidebarCard';
import { logError } from '../utils/browser-logger';
import type { SettlementListItem } from '@shared/shared-types.ts';

interface GroupDetailPageProps {
    id?: string;
}

export default function GroupDetailPage({ id: groupId }: GroupDetailPageProps) {
    const isInitialized = useSignal(false);
    const showShareModal = useSignal(false);
    const showSettlementForm = useSignal(false);
    const showSettlementHistory = useSignal(false);
    const showDeletedExpenses = useSignal(false);
    const showEditModal = useSignal(false);
    const settlementToEdit = useSignal<SettlementListItem | null>(null);

    // Computed values from store
    const group = useComputed(() => enhancedGroupDetailStore.group);
    const expenses = useComputed(() => enhancedGroupDetailStore.expenses);
    const balances = useComputed(() => enhancedGroupDetailStore.balances);
    const members = useComputed(() => enhancedGroupDetailStore.members);
    const loading = useComputed(() => enhancedGroupDetailStore.loading);
    const loadingMembers = useComputed(() => enhancedGroupDetailStore.loadingMembers);
    const error = useComputed(() => enhancedGroupDetailStore.error);

    // Auth store via hook
    const authStore = useAuthRequired();
    const currentUser = useComputed(() => authStore.user);
    const isGroupOwner = useComputed(() => currentUser.value && group.value && group.value.createdBy === currentUser.value.uid);

    // Component should only render if user is authenticated (handled by ProtectedRoute)
    if (!currentUser.value) {
        return null;
    }

    // Fetch group data on mount and subscribe to realtime updates
    useEffect(() => {
        if (!groupId || !currentUser.value) return;

        const loadGroup = async () => {
            try {
                await enhancedGroupDetailStore.loadGroup(groupId);
                // Subscribe to realtime changes after initial load
                if (currentUser.value) {
                    enhancedGroupDetailStore.subscribeToChanges(currentUser.value.uid);
                }
                isInitialized.value = true;
            } catch (error) {
                logError('Failed to load group page', error, { groupId });
                isInitialized.value = true;
            }
        };

        // Intentionally not awaited - useEffect cannot be async (React anti-pattern)
        loadGroup();

        // Cleanup on unmount
        return () => {
            enhancedGroupDetailStore.dispose();
            enhancedGroupDetailStore.reset();
        };
    }, [groupId, currentUser.value]);

    // Handle loading state
    if (loading.value && !isInitialized.value) {
        return (
            <BaseLayout>
                <div className="container mx-auto px-4 py-8">
                    <LoadingSpinner />
                </div>
            </BaseLayout>
        );
    }

    // Handle error state
    if (error.value) {
        // Check if it's a 404 error (group not found or no access)
        if (error.value.includes('not found') || error.value.includes('Not Found')) {
            // Navigate to 404 page for consistent experience
            route('/404', true);
            return null;
        }

        // Other errors show inline
        return (
            <BaseLayout>
                <div className="container mx-auto px-4 py-8">
                    <Card className="p-6 text-center">
                        <h2 className="text-xl font-semibold mb-2">Error Loading Group</h2>
                        <p className="text-gray-600 mb-4">{error.value}</p>
                        <Button variant="primary" onClick={() => route('/dashboard')}>
                            Back to Dashboard
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
            route('/404', true);
            return null;
        } else {
            // Still loading
            return (
                <BaseLayout>
                    <div className="container mx-auto px-4 py-8">
                        <LoadingSpinner />
                    </div>
                </BaseLayout>
            );
        }
    }

    // Handle click events
    const handleExpenseClick = (expense: any) => {
        route(`/groups/${groupId}/expenses/${expense.id}`);
    };

    const handleExpenseCopy = (expense: any) => {
        route(`/groups/${groupId}/add-expense?copy=true&sourceId=${expense.id}`);
    };

    const handleAddExpense = () => {
        route(`/groups/${groupId}/add-expense`);
    };

    const handleSettleUp = () => {
        settlementToEdit.value = null;
        showSettlementForm.value = true;
    };

    const handleEditSettlement = (settlement: SettlementListItem) => {
        settlementToEdit.value = settlement;
        showSettlementForm.value = true;
    };

    const handleShare = () => {
        showShareModal.value = true;
    };

    const handleSettings = () => {
        showEditModal.value = true;
    };

    const handleGroupUpdateSuccess = async () => {
        // Refresh group data after successful update
        try {
            await enhancedGroupDetailStore.loadGroup(groupId!);
        } catch (error) {
            logError('Failed to refresh group after update', error, { groupId });
        }
    };

    const handleGroupDelete = () => {
        // Navigate to dashboard after group deletion
        route('/dashboard');
    };

    // Render group detail
    return (
        <BaseLayout title={`${group.value!.name} - Splitifyd`} description={`Manage expenses for ${group.value!.name}`} headerVariant="dashboard">
            <GroupDetailGrid
                leftSidebar={
                    <>
                        <MembersListWithManagement 
                            members={members.value} 
                            createdBy={group.value!.createdBy || ''} 
                            currentUserId={currentUser.value.uid}
                            groupId={groupId!}
                            balances={balances.value}
                            loading={loadingMembers.value} 
                            variant="sidebar" 
                            onInviteClick={handleShare}
                            onMemberChange={() => enhancedGroupDetailStore.fetchMembers()}
                        />

                        <GroupActions onAddExpense={handleAddExpense} onSettleUp={handleSettleUp} onShare={handleShare} onSettings={handleSettings} isGroupOwner={isGroupOwner.value ?? false} variant="vertical" />
                    </>
                }
                mainContent={
                    <Stack spacing="lg">
                        <GroupHeader group={group.value!} onSettings={handleSettings} isGroupOwner={isGroupOwner.value ?? false} />

                        {/* Mobile-only quick actions */}
                        <div className="lg:hidden">
                            <GroupActions onAddExpense={handleAddExpense} onSettleUp={handleSettleUp} onShare={handleShare} onSettings={handleSettings} isGroupOwner={isGroupOwner.value ?? false} />
                        </div>

                        <ExpensesList
                            expenses={expenses.value}
                            members={members.value}
                            hasMore={enhancedGroupDetailStore.hasMoreExpenses}
                            loading={enhancedGroupDetailStore.loadingExpenses}
                            onLoadMore={() => enhancedGroupDetailStore.loadMoreExpenses()}
                            onExpenseClick={handleExpenseClick}
                            onExpenseCopy={handleExpenseCopy}
                            isGroupOwner={isGroupOwner.value ?? false}
                            showDeletedExpenses={showDeletedExpenses.value}
                            onShowDeletedChange={(show) => {
                                showDeletedExpenses.value = show;
                                enhancedGroupDetailStore.fetchExpenses(undefined, show);
                            }}
                        />

                        {/* Mobile-only members list */}
                        <div className="lg:hidden">
                            <MembersListWithManagement 
                                members={members.value} 
                                createdBy={group.value!.createdBy || ''} 
                                currentUserId={currentUser.value.uid}
                                groupId={groupId!}
                                balances={balances.value}
                                loading={loadingMembers.value} 
                                onInviteClick={handleShare}
                                onMemberChange={() => enhancedGroupDetailStore.fetchMembers()}
                            />
                        </div>

                        {/* Mobile-only balance summary */}
                        <div className="lg:hidden">
                            <BalanceSummary balances={balances.value} members={members.value} />
                        </div>
                    </Stack>
                }
                rightSidebar={
                    <>
                        <BalanceSummary balances={balances.value} members={members.value} variant="sidebar" />

                        {/* Settlement History Section */}
                        <SidebarCard title="Payment History">
                            <div className="space-y-3">
                                <Button variant="secondary" size="sm" className="w-full" onClick={() => (showSettlementHistory.value = !showSettlementHistory.value)}>
                                    {showSettlementHistory.value ? 'Hide History' : 'Show History'}
                                </Button>
                                {showSettlementHistory.value && <SettlementHistory groupId={groupId!} onEditSettlement={handleEditSettlement} />}
                            </div>
                        </SidebarCard>
                    </>
                }
            />

            {/* Share Modal */}
            <ShareGroupModal isOpen={showShareModal.value} onClose={() => (showShareModal.value = false)} groupId={groupId!} groupName={group.value!.name} />

            {/* Edit Group Modal */}
            {isGroupOwner.value && (
                <EditGroupModal
                    isOpen={showEditModal.value}
                    group={group.value!}
                    onClose={() => (showEditModal.value = false)}
                    onSuccess={handleGroupUpdateSuccess}
                    onDelete={handleGroupDelete}
                />
            )}

            {/* Settlement Form Modal */}
            <SettlementForm
                isOpen={showSettlementForm.value}
                onClose={() => {
                    showSettlementForm.value = false;
                    settlementToEdit.value = null;
                }}
                groupId={groupId!}
                editMode={!!settlementToEdit.value}
                settlementToEdit={settlementToEdit.value || undefined}
                onSuccess={() => {
                    // Refresh balances after successful settlement
                    enhancedGroupDetailStore.fetchBalances();
                    settlementToEdit.value = null;
                }}
            />
        </BaseLayout>
    );
}
