import { useEffect } from 'preact/hooks';
import { route } from 'preact-router';
import { useSignal, useComputed } from '@preact/signals';
import { groupDetailStore } from '../app/stores/group-detail-store';
// import { authStore } from '../app/stores/auth-store';
import { LoadingSpinner, Card, Button } from '../components/ui';
import { Stack } from '../components/ui/Stack';
import { V2Indicator } from '../components/ui/V2Indicator';
import { 
  GroupHeader, 
  QuickActions, 
  MembersList, 
  BalanceSummary, 
  ExpensesList 
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
  const loading = useComputed(() => groupDetailStore.loading);
  const error = useComputed(() => groupDetailStore.error);
  // const currentUser = useComputed(() => authStore.user);

  // Debug logging
  console.log('GroupDetailPage render:', {
    groupId,
    group: group.value,
    loading: loading.value,
    error: error.value,
    isInitialized: isInitialized.value
  });

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
      <div className="container mx-auto px-4 py-8">
        <V2Indicator />
        <LoadingSpinner />
      </div>
    );
  }

  // Handle error state
  if (error.value) {
    return (
      <div className="container mx-auto px-4 py-8">
        <V2Indicator />
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
    );
  }

  // Handle no group found
  if (!group.value && isInitialized.value) {
    return (
      <div className="container mx-auto px-4 py-8">
        <V2Indicator />
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
    );
  }

  // Handle click events
  const handleExpenseClick = (expense: any) => {
    console.log('Expense clicked:', expense.id);
  };

  const handleAddExpense = () => {
    console.log('Add expense clicked');
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
    <div className="container mx-auto px-4 py-8">
      <V2Indicator />
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
          hasMore={groupDetailStore.hasMoreExpenses}
          loading={groupDetailStore.loadingExpenses}
          onLoadMore={() => groupDetailStore.loadMoreExpenses()}
          onExpenseClick={handleExpenseClick}
        />
      </Stack>
    </div>
  );
}