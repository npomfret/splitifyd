import { useEffect } from 'preact/hooks';
import { LoadingSpinner } from '../ui';
import type { SettlementListItem } from '../../../../firebase/functions/src/shared/shared-types';
import { useAuthRequired } from '../../app/hooks/useAuthRequired';
import { enhancedGroupDetailStore } from '../../app/stores/group-detail-store-enhanced';

interface SettlementHistoryProps {
  groupId: string;
  userId?: string;
  limit?: number;
}

export function SettlementHistory({ groupId, userId, limit = 10 }: SettlementHistoryProps) {
  const authStore = useAuthRequired();
  const currentUser = authStore.user;
  
  // Use store state
  const settlements = enhancedGroupDetailStore.settlements;
  const isLoading = enhancedGroupDetailStore.loadingSettlements;
  const hasMore = enhancedGroupDetailStore.hasMoreSettlements;

  useEffect(() => {
    // Always load settlements when component mounts or parameters change
    // This ensures we have fresh data when the history modal opens
    if (groupId) {
      enhancedGroupDetailStore.fetchSettlements(undefined, userId);
    }
  }, [groupId, userId]);

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined 
      });
    }
  };

  const formatAmount = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  if (isLoading && settlements.length === 0) {
    return (
      <div class="flex justify-center items-center py-8">
        <LoadingSpinner />
      </div>
    );
  }

  // Remove error handling - the store manages errors now

  if (settlements.length === 0) {
    return (
      <div class="text-center py-8">
        <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
            d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p class="mt-2 text-sm text-gray-500">No payments recorded yet</p>
      </div>
    );
  }

  return (
    <div class="space-y-3">
      {settlements.map(settlement => {
        const isCurrentUserPayer = settlement.payer.uid === currentUser?.uid;
        const isCurrentUserPayee = settlement.payee.uid === currentUser?.uid;
        
        return (
          <div key={settlement.id} class="p-4 bg-white border border-gray-200 rounded-lg hover:shadow-sm transition-shadow">
            <div class="flex justify-between items-start">
              <div class="flex-1">
                <p class="text-sm font-medium text-gray-900">
                  {isCurrentUserPayer ? (
                    <>
                      <span class="text-blue-600">You</span>
                      {' paid '}
                      <span class="font-semibold">{settlement.payee.displayName}</span>
                    </>
                  ) : isCurrentUserPayee ? (
                    <>
                      <span class="font-semibold">{settlement.payer.displayName}</span>
                      {' paid '}
                      <span class="text-blue-600">you</span>
                    </>
                  ) : (
                    <>
                      <span class="font-semibold">{settlement.payer.displayName}</span>
                      {' paid '}
                      <span class="font-semibold">{settlement.payee.displayName}</span>
                    </>
                  )}
                </p>
                
                {settlement.note && (
                  <p class="mt-1 text-sm text-gray-500">
                    {settlement.note}
                  </p>
                )}
                
                <p class="mt-1 text-xs text-gray-400">
                  {formatDate(settlement.date)}
                </p>
              </div>
              
              <div class="text-right ml-4">
                <p class={`text-lg font-bold ${
                  isCurrentUserPayee ? 'text-green-600' : 
                  isCurrentUserPayer ? 'text-gray-700' : 
                  'text-gray-600'
                }`}>
                  {isCurrentUserPayee && '+'}
                  {formatAmount(settlement.amount)}
                </p>
              </div>
            </div>
          </div>
        );
      })}
      
      {hasMore && (
        <div class="text-center pt-4">
          <button
            onClick={() => enhancedGroupDetailStore.loadMoreSettlements()}
            disabled={isLoading}
            class="px-4 py-2 text-sm text-blue-600 hover:text-blue-700 font-medium disabled:opacity-50"
          >
            {isLoading ? 'Loading...' : 'Load more'}
          </button>
        </div>
      )}
    </div>
  );
}