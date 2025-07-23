import { useEffect } from 'preact/hooks';
import { route } from 'preact-router';
import { useSignal, useComputed } from '@preact/signals';
import { groupDetailStore } from '../app/stores/group-detail-store';
// import { authStore } from '../app/stores/auth-store';
import { LoadingSpinner } from '../components/ui';
import { Stack } from '../components/ui/Stack';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { formatDistanceToNow } from '../utils/dateUtils';

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
        <LoadingSpinner />
      </div>
    );
  }

  // Handle error state
  if (error.value) {
    return (
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
    );
  }

  // Handle no group found
  if (!group.value && isInitialized.value) {
    return (
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
    );
  }

  // Render group detail
  return (
    <div className="container mx-auto px-4 py-8">
      <Stack spacing="lg">
        {/* Group Header */}
        <Card className="p-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h1 className="text-2xl font-bold mb-2">{group.value?.name}</h1>
              {group.value?.description && (
                <p className="text-gray-600">{group.value.description}</p>
              )}
            </div>
            <Button 
              variant="secondary"
              size="sm"
              onClick={() => console.log('Settings clicked')}
            >
              Settings
            </Button>
          </div>
          
          <div className="flex gap-6 text-sm text-gray-600">
            <div>
              <span className="font-medium">{group.value?.members.length}</span> members
            </div>
            <div>
              <span className="font-medium">{group.value?.expenseCount || 0}</span> expenses
            </div>
            <div>
              Created {group.value?.createdAt && formatDistanceToNow(new Date(group.value.createdAt))}
            </div>
          </div>
        </Card>

        {/* Quick Actions */}
        <div className="flex gap-4">
          <Button 
            variant="primary"
            onClick={() => console.log('Add expense clicked')}
          >
            Add Expense
          </Button>
          <Button 
            variant="secondary"
            onClick={() => console.log('Settle up clicked')}
          >
            Settle Up
          </Button>
          <Button 
            variant="ghost"
            onClick={() => console.log('Share clicked')}
          >
            Share Group
          </Button>
        </div>

        {/* Members Section */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Members</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {group.value?.members.map((member) => (
              <div key={member.uid} className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                  <span className="text-sm font-medium text-primary-700">
                    {member.displayName.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{member.displayName}</p>
                  {member.uid === group.value?.createdBy && (
                    <p className="text-xs text-gray-500">Admin</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Balances Section */}
        {balances.value && (
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4">Balances</h2>
            {balances.value.simplifiedDebts.length === 0 ? (
              <p className="text-gray-600">All settled up!</p>
            ) : (
              <Stack spacing="sm">
                {balances.value.simplifiedDebts.map((debt, index) => (
                  <div key={index} className="flex justify-between items-center py-2">
                    <span className="text-sm">
                      <span className="font-medium">{debt.from.name}</span> owes{' '}
                      <span className="font-medium">{debt.to.name}</span>
                    </span>
                    <span className="font-semibold text-red-600">
                      ${debt.amount.toFixed(2)}
                    </span>
                  </div>
                ))}
              </Stack>
            )}
          </Card>
        )}

        {/* Expenses Section */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Expenses</h2>
          {expenses.value.length === 0 ? (
            <p className="text-gray-600">No expenses yet. Add one to get started!</p>
          ) : (
            <Stack spacing="md">
              {expenses.value.map((expense) => (
                <div 
                  key={expense.id} 
                  className="border-b last:border-0 pb-3 last:pb-0 cursor-pointer hover:bg-gray-50 -mx-2 px-2 py-2 rounded"
                  onClick={() => console.log('Expense clicked:', expense.id)}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <p className="font-medium">{expense.description}</p>
                      <p className="text-sm text-gray-600">
                        Paid by {expense.paidByName || 'Unknown'} • {formatDistanceToNow(new Date(expense.date))}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">${expense.amount.toFixed(2)}</p>
                      <p className="text-xs text-gray-500">{expense.category}</p>
                    </div>
                  </div>
                </div>
              ))}
              
              {groupDetailStore.hasMoreExpenses && (
                <Button
                  variant="ghost"
                  onClick={() => groupDetailStore.loadMoreExpenses()}
                  disabled={groupDetailStore.loadingExpenses}
                  className="w-full"
                >
                  {groupDetailStore.loadingExpenses ? 'Loading...' : 'Load More'}
                </Button>
              )}
            </Stack>
          )}
        </Card>
      </Stack>
    </div>
  );
}