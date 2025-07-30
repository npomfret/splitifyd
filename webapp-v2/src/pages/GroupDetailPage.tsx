import { useEffect } from 'preact/hooks';
import { route } from 'preact-router';
import { useSignal, useComputed } from '@preact/signals';
import { groupDetailStore } from '../app/stores/group-detail-store';
// import { authStore } from '../app/stores/auth-store';
import { BaseLayout } from '../components/layout/BaseLayout';
import { LoadingSpinner, Card, Button } from '../components/ui';
import { Stack } from '../components/ui/Stack';
import { 
  GroupHeader, 
  QuickActions, 
  MembersList, 
  ExpensesList,
  BalanceSummary 
} from '../components/group';

interface GroupDetailPageProps {
  id?: string;
}

export default function GroupDetailPage({ id: groupId }: GroupDetailPageProps) {
  const isInitialized = useSignal(false);

  // Computed values from store
  const group = useComputed(() => groupDetailStore.group);
  const expenses = useComputed(() => groupDetailStore.expenses);
  const balances = useComputed(() => groupDetailStore.balances);
  const members = useComputed(() => group.value?.members || []);
  const loading = useComputed(() => groupDetailStore.loading);
  const error = useComputed(() => groupDetailStore.error);
  // const currentUser = useComputed(() => authStore.user);


  // Fetch group data on mount
  useEffect(() => {
    if (!groupId) return;

    const loadGroup = async () => {
      try {
        await groupDetailStore.fetchGroup(groupId);
        isInitialized.value = true;
      } catch (error) {
        console.error('Failed to load group:', error);
        isInitialized.value = true;
      }
    };

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
    console.log('Settle up clicked');
  };

  const handleShare = () => {
    console.log('Share clicked');
  };

  const handleSettings = () => {
    console.log('Settings clicked');
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
            members={group.value!.members || []} 
            createdBy={group.value!.createdBy || ''}
          />

          <BalanceSummary balances={balances.value} />

          <ExpensesList 
            expenses={expenses.value}
            members={members.value}
            hasMore={groupDetailStore.hasMoreExpenses}
            loading={groupDetailStore.loadingExpenses}
            onLoadMore={() => groupDetailStore.loadMoreExpenses()}
            onExpenseClick={handleExpenseClick}
          />
        </Stack>
      </div>
    </BaseLayout>
  );
}