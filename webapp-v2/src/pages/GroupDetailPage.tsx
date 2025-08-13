import { useEffect } from 'preact/hooks';
import { route } from 'preact-router';
import { useSignal, useComputed } from '@preact/signals';
import { groupDetailStore } from '../app/stores/group-detail-store';
import { useAuthRequired } from '../app/hooks/useAuthRequired';
import { BaseLayout } from '../components/layout/BaseLayout';
import { GroupDetailGrid } from '../components/layout/GroupDetailGrid';
import { LoadingSpinner, Card, Button } from '@/components/ui';
import { Stack } from '@/components/ui';
import { 
  GroupHeader, 
  QuickActions, 
  MembersList, 
  ExpensesList,
  BalanceSummary,
  ShareGroupModal 
} from '@/components/group';
import { SettlementForm, SettlementHistory } from '@/components/settlements';
import { SidebarCard } from '@/components/ui/SidebarCard';
import { logError } from '../utils/browser-logger';

interface GroupDetailPageProps {
  id?: string;
}

export default function GroupDetailPage({ id: groupId }: GroupDetailPageProps) {
  const isInitialized = useSignal(false);
  const showShareModal = useSignal(false);
  const showSettlementForm = useSignal(false);
  const showSettlementHistory = useSignal(false);
  const showDeletedExpenses = useSignal(false);

  // Computed values from store
  const group = useComputed(() => groupDetailStore.group);
  const expenses = useComputed(() => groupDetailStore.expenses);
  const balances = useComputed(() => groupDetailStore.balances);
  const members = useComputed(() => groupDetailStore.members);
  const loading = useComputed(() => groupDetailStore.loading);
  const loadingMembers = useComputed(() => groupDetailStore.loadingMembers);
  const error = useComputed(() => groupDetailStore.error);
  
  // Auth store via hook
  const authStore = useAuthRequired();
  const currentUser = useComputed(() => authStore.user);
  const isGroupOwner = useComputed(() => 
    currentUser.value && group.value && group.value.createdBy === currentUser.value.uid
  );

  // Redirect to login if not authenticated  
  useEffect(() => {
    if (!currentUser.value) {
      route('/login', true);
      return;
    }
  }, [currentUser.value]);

  // Fetch group data on mount
  useEffect(() => {
    if (!groupId || !currentUser.value) return;

    const loadGroup = async () => {
      try {
        await groupDetailStore.fetchGroup(groupId);
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
      groupDetailStore.reset();
    };
  }, [groupId, currentUser.value]);

  // Redirect if user is not authenticated (will happen in useEffect)
  if (!currentUser.value) {
    return null;
  }

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
    return (
      <BaseLayout>
        <div className="container mx-auto px-4 py-8">
          <Card className="p-6 text-center">
            <h2 className="text-xl font-semibold mb-2">Error Loading Group</h2>
            <p className="text-gray-600 mb-4">{error.value}</p>
            <Button 
              variant="primary" 
              onClick={() => route('/dashboard')}
            >
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
      return (
        <BaseLayout>
          <div className="container mx-auto px-4 py-8">
            <Card className="p-6 text-center">
              <h2 className="text-xl font-semibold mb-2">Group Not Found</h2>
              <p className="text-gray-600 mb-4">This group doesn't exist or you don't have access to it.</p>
              <Button 
                variant="primary" 
                onClick={() => route('/dashboard')}
              >
                Back to Dashboard
              </Button>
            </Card>
          </div>
        </BaseLayout>
      );
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

  const handleAddExpense = () => {
    route(`/groups/${groupId}/add-expense`);
  };

  const handleSettleUp = () => {
    showSettlementForm.value = true;
  };

  const handleShare = () => {
    showShareModal.value = true;
  };

  const handleSettings = () => {
    // TODO: Implement group settings functionality
  };

  const handleLeaveGroup = async () => {
    if (!groupId) return;
    
    // Confirm before leaving
    if (!confirm('Are you sure you want to leave this group? You can only leave if you have no outstanding balance.')) {
      return;
    }
    
    try {
      const response = await groupDetailStore.leaveGroup(groupId);
      if (response.success) {
        // Navigate back to dashboard after successful leave
        route('/dashboard');
      }
    } catch (error) {
      // Error will be handled by the store
      logError('Failed to leave group', error);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!groupId) return;
    
    const memberToRemove = members.value.find(m => m.uid === memberId);
    const memberName = memberToRemove?.displayName || 'this member';
    
    // Confirm before removing
    if (!confirm(`Are you sure you want to remove ${memberName} from the group? They can only be removed if they have no outstanding balance.`)) {
      return;
    }
    
    try {
      const response = await groupDetailStore.removeMember(groupId, memberId);
      if (response.success) {
        // Refresh group data after successful removal
        await groupDetailStore.fetchGroup(groupId);
      }
    } catch (error) {
      // Error will be handled by the store
      logError('Failed to remove member', error);
    }
  };

  // Render group detail
  return (
    <BaseLayout 
      title={`${group.value!.name} - Splitifyd`}
      description={`Manage expenses for ${group.value!.name}`}
      headerVariant="dashboard"
    >
      <GroupDetailGrid
        leftSidebar={
          <>
            <MembersList 
              members={members.value} 
              createdBy={group.value!.createdBy || ''}
              loading={loadingMembers.value}
              variant="sidebar"
              onLeaveGroup={handleLeaveGroup}
              onRemoveMember={handleRemoveMember}
            />
            
            <QuickActions 
              onAddExpense={handleAddExpense}
              onSettleUp={handleSettleUp}
              onShare={handleShare}
              variant="vertical"
            />
          </>
        }
        mainContent={
          <Stack spacing="lg">
            <GroupHeader 
              group={group.value!} 
              onSettingsClick={handleSettings}
            />

            {/* Mobile-only quick actions */}
            <div className="lg:hidden">
              <QuickActions 
                onAddExpense={handleAddExpense}
                onSettleUp={handleSettleUp}
                onShare={handleShare}
              />
            </div>

            <ExpensesList 
              expenses={expenses.value}
              members={members.value}
              hasMore={groupDetailStore.hasMoreExpenses}
              loading={groupDetailStore.loadingExpenses}
              onLoadMore={() => groupDetailStore.loadMoreExpenses()}
              onExpenseClick={handleExpenseClick}
              isGroupOwner={isGroupOwner.value ?? false}
              showDeletedExpenses={showDeletedExpenses.value}
              onShowDeletedChange={(show) => {
                showDeletedExpenses.value = show;
                groupDetailStore.refetchExpenses(show);
              }}
            />

            {/* Mobile-only members list */}
            <div className="lg:hidden">
              <MembersList 
                members={members.value} 
                createdBy={group.value!.createdBy || ''}
                loading={loadingMembers.value}
                onLeaveGroup={handleLeaveGroup}
                onRemoveMember={handleRemoveMember}
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
            <BalanceSummary 
              balances={balances.value} 
              members={members.value}
              variant="sidebar"
            />

            {/* Settlement History Section */}
            <SidebarCard title="Payment History">
              <div className="space-y-3">
                <Button 
                  variant="secondary" 
                  size="sm"
                  className="w-full"
                  onClick={() => showSettlementHistory.value = !showSettlementHistory.value}
                >
                  {showSettlementHistory.value ? 'Hide History' : 'Show History'}
                </Button>
                {showSettlementHistory.value && (
                  <SettlementHistory 
                    groupId={groupId!} 
                    limit={5}
                  />
                )}
              </div>
            </SidebarCard>
          </>
        }
      />

      {/* Share Modal */}
      <ShareGroupModal
        isOpen={showShareModal.value}
        onClose={() => showShareModal.value = false}
        groupId={groupId!}
        groupName={group.value!.name}
      />

      {/* Settlement Form Modal */}
      <SettlementForm
        isOpen={showSettlementForm.value}
        onClose={() => showSettlementForm.value = false}
        groupId={groupId!}
        onSuccess={() => {
          // Refresh balances after successful settlement
          groupDetailStore.fetchBalances();
        }}
      />
    </BaseLayout>
  );
}