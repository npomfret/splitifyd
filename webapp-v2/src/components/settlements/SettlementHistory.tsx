import { useEffect, useState } from 'preact/hooks';
import { LoadingSpinner, ConfirmDialog } from '../ui';
import { useAuthRequired } from '@/app/hooks/useAuthRequired.ts';
import { enhancedGroupDetailStore } from '@/app/stores/group-detail-store-enhanced.ts';
import { apiClient } from '@/app/apiClient.ts';
import type { SettlementWithMembers } from '@splitifyd/shared';
import { PencilIcon, TrashIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import { formatDistanceToNow } from '@/utils/dateUtils.ts';
import { formatCurrency } from '@/utils/currency';

interface SettlementHistoryProps {
    groupId: string;
    userId?: string;
    onEditSettlement?: (settlement: SettlementWithMembers) => void;
    showDeletedSettlements?: boolean;
    onShowDeletedChange?: (show: boolean) => void;
}

export function SettlementHistory({ groupId, userId, onEditSettlement, showDeletedSettlements = false, onShowDeletedChange }: SettlementHistoryProps) {
    const { t } = useTranslation();
    const authStore = useAuthRequired();
    const currentUser = authStore.user;
    const [settlementToDelete, setSettlementToDelete] = useState<SettlementWithMembers | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // Use store state
    const settlements = enhancedGroupDetailStore.settlements;
    const isLoading = enhancedGroupDetailStore.loadingSettlements;
    const hasMore = enhancedGroupDetailStore.hasMoreSettlements;
    const group = enhancedGroupDetailStore.group;
    const members = enhancedGroupDetailStore.members;

    // Check if current user is group owner
    const isGroupOwner = currentUser && group && group.createdBy === currentUser.uid;

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
            return t('settlementHistory.today');
        } else if (date.toDateString() === yesterday.toDateString()) {
            return t('settlementHistory.yesterday');
        } else {
            return date.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
            });
        }
    };

    const handleDeleteClick = (settlement: SettlementWithMembers) => {
        setSettlementToDelete(settlement);
    };

    const handleConfirmDelete = async () => {
        if (!settlementToDelete) return;

        setIsDeleting(true);
        try {
            await apiClient.deleteSettlement(settlementToDelete.id);
            await enhancedGroupDetailStore.refreshAll();
            setSettlementToDelete(null);
        } catch (error) {
            console.error('Failed to delete settlement:', error);
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
                <p class="mt-2 text-sm text-gray-500">{t('settlementHistory.noPaymentsYet')}</p>
            </div>
        );
    }

    return (
        <div class="space-y-3">
            {/* Admin toggle for deleted settlements */}
            {isGroupOwner && onShowDeletedChange && (
                <div class="pb-2 border-b border-gray-200">
                    <label class="flex items-center space-x-2 text-sm cursor-pointer">
                        <input
                            type="checkbox"
                            checked={showDeletedSettlements}
                            onChange={(e) => onShowDeletedChange(e.currentTarget.checked)}
                            class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span class="text-gray-700">{t('settlementHistory.showDeletedSettlements')}</span>
                    </label>
                </div>
            )}

            {settlements.map((settlement) => {
                const isCurrentUserPayer = settlement.payer.uid === currentUser?.uid;
                const isCurrentUserPayee = settlement.payee.uid === currentUser?.uid;
                const isDeleted = settlement.deletedAt !== null && settlement.deletedAt !== undefined;
                const deletedByUser = settlement.deletedBy ? members.find((m) => m.uid === settlement.deletedBy) : null;

                return (
                    <div key={settlement.id} class="p-4 bg-white border border-gray-200 rounded-lg hover:shadow-sm transition-shadow" data-testid="settlement-item">
                        <div class="flex justify-between items-start">
                            <div class="flex-1">
                                <p class="text-sm font-medium text-gray-900">
                                    <span class="font-semibold">{settlement.payer.displayName}</span>
                                    {' → '}
                                    <span class="font-semibold">{settlement.payee.displayName}</span>
                                </p>

                                {settlement.note && <p class="mt-1 text-sm text-gray-500">{settlement.note}</p>}

                                <p class="mt-1 text-xs text-gray-400">
                                    {formatDate(settlement.date)}
                                    {isDeleted && settlement.deletedAt && (
                                        <span class="ml-2 text-red-600" data-financial-amount="deleted">
                                            • {t('settlementHistory.deletedBy')} {deletedByUser?.displayName || t('common.unknown')} {formatDistanceToNow(new Date(settlement.deletedAt))}
                                        </span>
                                    )}
                                </p>
                            </div>

                            <div class="flex items-start gap-2 ml-4">
                                <div class="text-right">
                                    <p class={`text-lg font-bold ${isCurrentUserPayee ? 'text-green-600' : isCurrentUserPayer ? 'text-gray-700' : 'text-gray-600'}`} data-financial-amount="settlement">
                                        {isCurrentUserPayee && '+'}
                                        {formatCurrency(settlement.amount, settlement.currency)}
                                    </p>
                                </div>

                                <div class="flex gap-1">
                                    {onEditSettlement && (
                                        <button
                                            onClick={() => onEditSettlement(settlement)}
                                            class="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                                            title={t('settlementHistory.editPaymentTooltip')}
                                            data-testid="edit-settlement-button"
                                        >
                                            <PencilIcon class="h-4 w-4" />
                                        </button>
                                    )}
                                    <button
                                        onClick={() => handleDeleteClick(settlement)}
                                        class="p-1 text-gray-400 hover:text-red-600 transition-colors"
                                        title={t('settlementHistory.deletePaymentTooltip')}
                                        data-testid="delete-settlement-button"
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
                        {isLoading ? t('common.loading') : t('settlementHistory.loadMore')}
                    </button>
                </div>
            )}

            {settlementToDelete && (
                <ConfirmDialog
                    isOpen={!!settlementToDelete}
                    title={t('settlementHistory.deletePaymentTitle')}
                    message={t('settlementHistory.deletePaymentMessage', {
                        amount: formatCurrency(settlementToDelete.amount, settlementToDelete.currency),
                        payer: settlementToDelete.payer.displayName,
                        payee: settlementToDelete.payee.displayName,
                    })}
                    confirmText={t('settlementHistory.deleteButton')}
                    cancelText={t('settlementHistory.cancelButton')}
                    onConfirm={handleConfirmDelete}
                    onCancel={handleCancelDelete}
                    loading={isDeleting}
                />
            )}
        </div>
    );
}
