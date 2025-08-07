import { useEffect, useState } from 'preact/hooks';
import { route } from 'preact-router';
import { useSignal, useComputed } from '@preact/signals';
import { apiClient } from '../app/apiClient';
import { groupDetailStore } from '../app/stores/group-detail-store';
import { BaseLayout } from '../components/layout/BaseLayout';
import { LoadingSpinner, Card, Button, Avatar } from '../components/ui';
import { Stack } from '../components/ui/Stack';
import { SplitBreakdown } from '../components/expense/SplitBreakdown';
import { ExpenseActions } from '../components/expense/ExpenseActions';
import { formatDistanceToNow } from '../utils/dateUtils';
import type { ExpenseData } from '@shared/types/webapp-shared-types';
import { logError } from '../utils/error-logger';

interface ExpenseDetailPageProps {
  groupId?: string;
  expenseId?: string;
}

export default function ExpenseDetailPage({ groupId, expenseId }: ExpenseDetailPageProps) {
  const expense = useSignal<ExpenseData | null>(null);
  const loading = useSignal(true);
  const error = useSignal<string | null>(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  
  // Get group data from store if available
  const group = useComputed(() => groupDetailStore.group);
  const members = useComputed(() => groupDetailStore.members);
  
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
        logError('Failed to load expense', err);
        error.value = err instanceof Error ? err.message : 'Failed to load expense';
      } finally {
        loading.value = false;
      }
    };
    
    // Intentionally not awaited - useEffect cannot be async (React anti-pattern)
    loadExpense();
  }, [groupId, expenseId]);
  
  const handleEdit = () => {
    route(`/groups/${groupId}/add-expense?id=${expenseId}&edit=true`);
  };
  
  const handleBack = () => {
    route(`/groups/${groupId}`);
  };

  const handleDelete = async () => {
    if (!expenseId) return;
    
    try {
      await apiClient.deleteExpense(expenseId);
      // Navigate back to group after successful deletion
      route(`/groups/${groupId}`);
    } catch (error) {
      logError('Failed to delete expense', error);
      // Error is handled by ExpenseActions component
      throw error;
    }
  };

  const handleShare = () => {
    if (!expenseId || !groupId) return;
    
    const url = `${window.location.origin}/groups/${groupId}/expenses/${expenseId}`;
    
    // Try to use native share API if available
    if (navigator.share) {
      navigator.share({
        title: `Expense: ${expense.value?.description}`,
        text: `Check out this expense: ${expense.value?.description} - $${expense.value?.amount.toFixed(2)}`,
        url: url
      }).catch((error) => {
        // Fallback to clipboard if share fails
        logError('Share API failed, falling back to clipboard', error);
        // Intentionally not awaited - fire-and-forget fallback operation
        copyToClipboard(url);
      });
    } else {
      // Fallback to clipboard - intentionally not awaited (fire-and-forget)
      copyToClipboard(url);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      // TODO: Add toast notification for successful copy
    } catch (error) {
      logError('Failed to copy to clipboard', error);
      // Fallback: select text for manual copy
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }
  };
  
  if (loading.value) {
    return (
      <BaseLayout>
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
          <LoadingSpinner size="lg" />
        </div>
      </BaseLayout>
    );
  }
  
  if (error.value || !expense.value) {
    return (
      <BaseLayout>
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
      </BaseLayout>
    );
  }
  
  const payer = memberMap.value[expense.value.paidBy];
  
  return (
    <BaseLayout
      title={`${expense.value.description} - Expense Details`}
      description={`Expense for ${expense.value.description} - $${expense.value.amount.toFixed(2)}`}
      headerVariant="dashboard"
    >
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        {/* Page Header */}
        <div className="bg-white dark:bg-gray-800 shadow-sm">
          <div className="max-w-3xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <Button variant="ghost" onClick={handleBack}>
                ← Back
              </Button>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                Expense Details
              </h1>
              <div className="w-16"></div> {/* Spacer for centered title */}
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
                  displayName={payer?.displayName || 'Unknown'}
                  userId={expense.value.paidBy}
                  size="md"
                />
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {payer?.displayName || 'Unknown'}
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
          
          {/* Receipt */}
          {expense.value.receiptUrl && (
            <Card>
              <Stack spacing="md">
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  Receipt
                </h3>
                <div className="text-center">
                  <img 
                    src={expense.value.receiptUrl} 
                    alt="Receipt"
                    className="max-w-full h-auto rounded-lg shadow-md mx-auto max-h-96 object-contain cursor-pointer hover:opacity-90 transition-opacity"
                    loading="lazy"
                    onClick={() => setShowReceiptModal(true)}
                  />
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                    Click to view full size
                  </p>
                </div>
              </Stack>
            </Card>
          )}

          {/* Actions */}
          <Card>
            <Stack spacing="md">
              <h3 className="font-semibold text-gray-900 dark:text-white">
                Actions
              </h3>
              <ExpenseActions
                expense={expense.value}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onShare={handleShare}
              />
            </Stack>
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

        {/* Receipt Modal */}
      {showReceiptModal && expense.value?.receiptUrl && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
          onClick={() => setShowReceiptModal(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Receipt viewer"
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setShowReceiptModal(false);
            }
          }}
          tabIndex={-1}
        >
          <div className="relative max-w-4xl max-h-full">
            <button
              onClick={() => setShowReceiptModal(false)}
              className="absolute top-2 right-2 z-10 bg-black bg-opacity-50 text-white rounded-full p-2 hover:bg-opacity-75 transition-all focus:outline-none focus:ring-2 focus:ring-white"
              aria-label="Close receipt viewer"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <img 
              src={expense.value.receiptUrl}
              alt="Receipt - Full Size"
              className="max-w-full max-h-full object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
      </div>
    </BaseLayout>
  );
}