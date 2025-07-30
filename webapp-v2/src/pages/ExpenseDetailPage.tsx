import { useEffect } from 'preact/hooks';
import { route } from 'preact-router';
import { useSignal, useComputed } from '@preact/signals';
import { apiClient } from '../app/apiClient';
import { groupDetailStore } from '../app/stores/group-detail-store';
import { LoadingSpinner, Card, Button, Avatar } from '../components/ui';
import { Stack } from '../components/ui/Stack';
import { V2Indicator } from '../components/ui/V2Indicator';
import { SplitBreakdown } from '../components/expense/SplitBreakdown';
import { formatDistanceToNow } from '../utils/dateUtils';
import type { ExpenseData } from '@shared/types/webapp-shared-types';

interface ExpenseDetailPageProps {
  groupId?: string;
  expenseId?: string;
}

export default function ExpenseDetailPage({ groupId, expenseId }: ExpenseDetailPageProps) {
  const expense = useSignal<ExpenseData | null>(null);
  const loading = useSignal(true);
  const error = useSignal<string | null>(null);
  
  // Get group data from store if available
  const group = useComputed(() => groupDetailStore.group);
  const members = useComputed(() => group.value?.members || []);
  
  // Create member lookup map
  const memberMap = useComputed(() => {
    return members.value.reduce((acc, member) => {
      acc[member.uid] = member;
      return acc;
    }, {} as Record<string, typeof members.value[0]>);
  });
  
  // Load expense data
  useEffect(() => {
    if (!groupId || !expenseId) {
      route('/dashboard');
      return;
    }
    
    const loadExpense = async () => {
      try {
        loading.value = true;
        error.value = null;
        
        // Ensure group data is loaded
        if (!group.value || group.value.id !== groupId) {
          await groupDetailStore.fetchGroup(groupId);
        }
        
        // Fetch expense data
        const response = await apiClient.request<ExpenseData>('/expenses', {
          method: 'GET',
          query: { id: expenseId }
        });
        if (response) {
          expense.value = response;
        } else {
          throw new Error('Expense not found');
        }
      } catch (err) {
        console.error('Failed to load expense:', err);
        error.value = err instanceof Error ? err.message : 'Failed to load expense';
      } finally {
        loading.value = false;
      }
    };
    
    loadExpense();
  }, [groupId, expenseId]);
  
  const handleEdit = () => {
    route(`/groups/${groupId}/add-expense?id=${expenseId}&edit=true`);
  };
  
  const handleBack = () => {
    route(`/groups/${groupId}`);
  };
  
  if (loading.value) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
        <LoadingSpinner size="lg" />
      </div>
    );
  }
  
  if (error.value || !expense.value) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
        <Card className="max-w-md mx-auto mt-8">
          <Stack spacing="md">
            <h2 className="text-xl font-semibold text-red-600">Error</h2>
            <p className="text-gray-600 dark:text-gray-400">
              {error.value || 'Expense not found'}
            </p>
            <Button onClick={handleBack}>Back to Group</Button>
          </Stack>
        </Card>
      </div>
    );
  }
  
  const payer = memberMap.value[expense.value.paidBy];
  
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <V2Indicator />
      
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Button variant="ghost" onClick={handleBack}>
              ← Back
            </Button>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              Expense Details
            </h1>
            <Button variant="primary" onClick={handleEdit}>
              Edit
            </Button>
          </div>
        </div>
      </div>
      
      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 py-6">
        <Stack spacing="md">
          {/* Main Expense Info */}
          <Card>
            <Stack spacing="lg">
              <div className="text-center">
                <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
                  ${expense.value.amount.toFixed(2)}
                </h2>
                <p className="text-lg text-gray-600 dark:text-gray-400 mt-2">
                  {expense.value.description}
                </p>
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500 dark:text-gray-400">Date</p>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {new Date(expense.value.date).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500 dark:text-gray-400">Category</p>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {expense.value.category}
                  </p>
                </div>
              </div>
            </Stack>
          </Card>
          
          {/* Paid By */}
          <Card>
            <Stack spacing="md">
              <h3 className="font-semibold text-gray-900 dark:text-white">
                Paid by
              </h3>
              <div className="flex items-center gap-3">
                <Avatar 
                  displayName={payer?.displayName || expense.value.paidByName || 'Unknown'}
                  userId={expense.value.paidBy}
                  size="md"
                />
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {payer?.displayName || expense.value.paidByName || 'Unknown'}
                  </p>
                  {payer?.email && (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {payer.email}
                    </p>
                  )}
                </div>
              </div>
            </Stack>
          </Card>
          
          {/* Split Information */}
          <Card>
            <SplitBreakdown expense={expense.value} members={members.value} />
          </Card>
          
          {/* Metadata */}
          <Card className="bg-gray-50 dark:bg-gray-800/50">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              <p>Added {formatDistanceToNow(new Date(expense.value.createdAt))}</p>
              {expense.value.updatedAt !== expense.value.createdAt && (
                <p>Last updated {formatDistanceToNow(new Date(expense.value.updatedAt))}</p>
              )}
            </div>
          </Card>
        </Stack>
      </div>
    </div>
  );
}