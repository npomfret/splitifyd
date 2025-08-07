import { useState, useEffect } from 'preact/hooks';
import { LoadingSpinner } from '../ui';
import type { SettlementListItem } from '@shared/types/webapp-shared-types';
import { apiClient } from '../../app/apiClient';
import { useAuthRequired } from '../../app/hooks/useAuthRequired';

interface SettlementHistoryProps {
  groupId: string;
  userId?: string;
  limit?: number;
}

export function SettlementHistory({ groupId, userId, limit = 10 }: SettlementHistoryProps) {
  const authStore = useAuthRequired();
  const [settlements, setSettlements] = useState<SettlementListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState<string | undefined>();
  
  const currentUser = authStore.user;

  const loadSettlements = async (loadMore = false) => {
    try {
      setIsLoading(!loadMore);
      setError(null);
      
      const response = await apiClient.listSettlements(
        groupId,
        limit,
        loadMore ? cursor : undefined,
        userId
      );
      
      if (loadMore) {
        setSettlements(prev => [...prev, ...response.settlements]);
      } else {
        setSettlements(response.settlements);
      }
      
      setHasMore(response.hasMore);
      setCursor(response.nextCursor);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load payment history');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Intentionally not awaited - useEffect cannot be async (React anti-pattern)
    loadSettlements();
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

  const formatAmount = (amount: number, currency: string): string => {
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency
      }).format(amount);
    } catch {
      return `${currency} ${amount.toFixed(2)}`;
    }
  };

  if (isLoading && settlements.length === 0) {
    return (
      <div class="flex justify-center items-center py-8">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div class="p-4 bg-red-50 border border-red-200 rounded-md">
        <p class="text-sm text-red-600">{error}</p>
        <button 
          onClick={() => loadSettlements()} 
          class="mt-2 text-sm text-red-700 underline hover:no-underline"
        >
          Try again
        </button>
      </div>
    );
  }

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
                  {formatAmount(settlement.amount, settlement.currency)}
                </p>
              </div>
            </div>
          </div>
        );
      })}
      
      {hasMore && (
        <div class="text-center pt-4">
          <button
            onClick={() => loadSettlements(true)}
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