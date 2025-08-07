import { useEffect } from 'preact/hooks';
import { route } from 'preact-router';
import { useSignal, useComputed } from '@preact/signals';
import { groupDetailStore } from '../app/stores/group-detail-store';
import { useAuthRequired } from '../app/hooks/useAuthRequired';
import { BaseLayout } from '../components/layout/BaseLayout';
import { LoadingSpinner, Card, Button } from '../components/ui';
import { Stack } from '../components/ui/Stack';
import { 
  GroupHeader, 
  QuickActions, 
  MembersList, 
  ExpensesList,
  BalanceSummary,
  ShareGroupModal 
} from '../components/group';
import { SettlementForm, SettlementHistory } from '../components/settlements';
import { logError } from '../utils/error-logger';

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

  // Fetch group data on mount
  useEffect(() => {
    if (!groupId) return;

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
  }, [groupId]);

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

  // Render group detail
  return (
    <BaseLayout 
      title={`${group.value!.name} - Splitifyd`}
      description={`Manage expenses for ${group.value!.name}`}
      headerVariant="dashboard"
    >
      <div className="container mx-auto px-4 py-8">
        <Stack spacing="lg">
          <GroupHeader 
            group={group.value!} 
            onSettingsClick={handleSettings}
          />

          <QuickActions 
            onAddExpense={handleAddExpense}
            onSettleUp={handleSettleUp}
            onShare={handleShare}
          />

          <MembersList 
            members={members.value} 
            createdBy={group.value!.createdBy || ''}
            loading={loadingMembers.value}
          />

          <BalanceSummary balances={balances.value} members={members.value} />

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

          {/* Settlement History Section */}
          <Card className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Payment History</h2>
              <Button 
                variant="secondary" 
                size="sm"
                onClick={() => showSettlementHistory.value = !showSettlementHistory.value}
              >
                {showSettlementHistory.value ? 'Hide History' : 'Show History'}
              </Button>
            </div>
            {showSettlementHistory.value && (
              <SettlementHistory 
                groupId={groupId!} 
                limit={5}
              />
            )}
          </Card>
        </Stack>
      </div>

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