import { useEffect, useState } from 'preact/hooks';
import { LoadingSpinner, ConfirmDialog } from '../ui';
import { useAuthRequired } from '@/app/hooks/useAuthRequired.ts';
import { enhancedGroupDetailStore } from '@/app/stores/group-detail-store-enhanced.ts';
import { apiClient } from '@/app/apiClient.ts';
import { logError } from '@/utils/browser-logger.ts';
import type { SettlementListItem } from '@shared/shared-types.ts';
import { PencilIcon, TrashIcon } from '@heroicons/react/24/outline';

interface SettlementHistoryProps {
    groupId: string;
    userId?: string;
    onEditSettlement?: (settlement: SettlementListItem) => void;
}

export function SettlementHistory({ groupId, userId, onEditSettlement }: SettlementHistoryProps) {
    const authStore = useAuthRequired();
    const currentUser = authStore.user;
    const [settlementToDelete, setSettlementToDelete] = useState<SettlementListItem | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

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
                year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
            });
        }
    };

    const formatAmount = (amount: number): string => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
        }).format(amount);
    };

    const handleDeleteClick = (settlement: SettlementListItem) => {
        setSettlementToDelete(settlement);
    };

    const handleConfirmDelete = async () => {
        if (!settlementToDelete) return;

        setIsDeleting(true);
        try {
            await apiClient.deleteSettlement(settlementToDelete.id);
            await enhancedGroupDetailStore.loadGroup(groupId);
            await enhancedGroupDetailStore.fetchSettlements();
            setSettlementToDelete(null);
        } catch (error) {
            logError('Failed to delete settlement', error);
        } finally {
            setIsDeleting(false);
        }
    };

    const handleCancelDelete = () => {
        setSettlementToDelete(null);
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
                    <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                </svg>
                <p class="mt-2 text-sm text-gray-500">No payments recorded yet</p>
            </div>
        );
    }

    return (
        <div class="space-y-3">
            {settlements.map((settlement) => {
                const isCurrentUserPayer = settlement.payer.uid === currentUser?.uid;
                const isCurrentUserPayee = settlement.payee.uid === currentUser?.uid;

                return (
                    <div key={settlement.id} class="p-4 bg-white border border-gray-200 rounded-lg hover:shadow-sm transition-shadow">
                        <div class="flex justify-between items-start">
                            <div class="flex-1">
                                <p class="text-sm font-medium text-gray-900">
                                    <span class="font-semibold">{settlement.payer.displayName}</span>
                                    {' → '}
                                    <span class="font-semibold">{settlement.payee.displayName}</span>
                                </p>

                                {settlement.note && <p class="mt-1 text-sm text-gray-500">{settlement.note}</p>}

                                <p class="mt-1 text-xs text-gray-400">{formatDate(settlement.date)}</p>
                            </div>

                            <div class="flex items-start gap-2 ml-4">
                                <div class="text-right">
                                    <p class={`text-lg font-bold ${isCurrentUserPayee ? 'text-green-600' : isCurrentUserPayer ? 'text-gray-700' : 'text-gray-600'}`}>
                                        {isCurrentUserPayee && '+'}
                                        {formatAmount(settlement.amount)}
                                    </p>
                                </div>
                                
                                <div class="flex gap-1">
                                    {onEditSettlement && (
                                        <button
                                            onClick={() => onEditSettlement(settlement)}
                                            class="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                                            title="Edit payment"
                                        >
                                            <PencilIcon class="h-4 w-4" />
                                        </button>
                                    )}
                                    <button
                                        onClick={() => handleDeleteClick(settlement)}
                                        class="p-1 text-gray-400 hover:text-red-600 transition-colors"
                                        title="Delete payment"
                                    >
                                        <TrashIcon class="h-4 w-4" />
                                    </button>
                                </div>
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

            {settlementToDelete && (
                <ConfirmDialog
                    isOpen={!!settlementToDelete}
                    title="Delete Payment"
                    message={`Are you sure you want to delete this payment of ${formatAmount(settlementToDelete.amount)} from ${settlementToDelete.payer.displayName} to ${settlementToDelete.payee.displayName}? This action cannot be undone.`}
                    confirmText="Delete"
                    cancelText="Cancel"
                    onConfirm={handleConfirmDelete}
                    onCancel={handleCancelDelete}
                    loading={isDeleting}
                />
            )}
        </div>
    );
}
