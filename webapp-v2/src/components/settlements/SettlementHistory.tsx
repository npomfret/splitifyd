import { apiClient } from '@/app/apiClient.ts';
import { useAuthRequired } from '@/app/hooks/useAuthRequired.ts';
import { enhancedGroupDetailStore } from '@/app/stores/group-detail-store-enhanced.ts';
import { themeStore } from '@/app/stores/theme-store.ts';
import { formatCurrency } from '@/utils/currency';
import { formatDistanceToNow } from '@/utils/dateUtils.ts';
import { getGroupDisplayName } from '@/utils/displayName';
import { PencilIcon, TrashIcon } from '@heroicons/react/24/outline';
import { useComputed, useSignal } from '@preact/signals';
import type { GroupMember, SettlementWithMembers } from '@splitifyd/shared';
import { useEffect, useMemo, useState } from 'preact/hooks';
import { useTranslation } from 'react-i18next';
import { Avatar } from '../ui/Avatar';
import { ConfirmDialog, CurrencyAmount, LoadingSpinner, Tooltip } from '../ui';

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
    const currentUserId = currentUser?.uid;
    const showAllSettlements = useSignal(false);
    const [settlementToDelete, setSettlementToDelete] = useState<SettlementWithMembers | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // Use useComputed to reactively track store changes
    const settlements = useComputed(() => enhancedGroupDetailStore.settlements);
    const isLoading = useComputed(() => enhancedGroupDetailStore.loadingSettlements);
    const hasMore = useComputed(() => enhancedGroupDetailStore.hasMoreSettlements);
    const group = useComputed(() => enhancedGroupDetailStore.group);
    const members = useComputed(() => enhancedGroupDetailStore.members);

    // Check if current user is group owner
    const isGroupOwner = currentUser && group.value && group.value.createdBy === currentUser.uid;

    const renderMemberName = (member: GroupMember) => {
        const displayName = getGroupDisplayName(member);
        const isCurrentUser = currentUserId === member.uid;

        return (
            <>
                {displayName}
                {isCurrentUser && <span class='text-gray-500 ml-1'>({t('common.you')})</span>}
            </>
        );
    };

    const visibleSettlements = useMemo(() => {
        const settlementList = settlements.value ?? [];

        if (showAllSettlements.value || !currentUserId) {
            return settlementList;
        }

        return settlementList.filter(
            (settlement) => settlement.payer.uid === currentUserId || settlement.payee.uid === currentUserId,
        );
    }, [settlements.value, showAllSettlements.value, currentUserId]);

    const totalSettlements = settlements.value.length;

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

    if (isLoading.value && totalSettlements === 0) {
        return (
            <div class='flex justify-center items-center py-8'>
                <LoadingSpinner />
            </div>
        );
    }

    // Remove error handling - the store manages errors now

    if (totalSettlements === 0) {
        return (
            <div class='text-center py-8'>
                <svg class='mx-auto h-12 w-12 text-gray-400' fill='none' stroke='currentColor' viewBox='0 0 24 24' aria-hidden='true' focusable='false'>
                    <path
                        stroke-linecap='round'
                        stroke-linejoin='round'
                        stroke-width='2'
                        d='M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
                    />
                </svg>
                <p class='mt-2 text-sm text-gray-500'>{t('settlementHistory.noPaymentsYet')}</p>
            </div>
        );
    }

    return (
        <div class='space-y-2'>
            <div class='pb-2 border-b border-gray-200 space-y-2'>
                <label class='flex items-center space-x-2 text-sm cursor-pointer'>
                    <input
                        type='checkbox'
                        checked={showAllSettlements.value}
                        onChange={(e) => (showAllSettlements.value = e.currentTarget.checked)}
                        class='rounded border-gray-300 text-blue-600 focus:ring-blue-500'
                        data-testid='show-all-settlements-checkbox'
                        autoComplete='off'
                    />
                    <span class='text-gray-700'>{t('settlementHistory.showAll')}</span>
                </label>
                {isGroupOwner && onShowDeletedChange && (
                    <label class='flex items-center space-x-2 text-sm cursor-pointer'>
                        <input
                            type='checkbox'
                            checked={showDeletedSettlements}
                            onChange={(e) => onShowDeletedChange(e.currentTarget.checked)}
                            class='rounded border-gray-300 text-blue-600 focus:ring-blue-500'
                            autoComplete='off'
                        />
                        <span class='text-gray-700'>{t('settlementHistory.showDeletedSettlements')}</span>
                    </label>
                )}
            </div>

            {visibleSettlements.length === 0 ? (
                <div class='text-center py-6 text-sm text-gray-500'>
                    {t('settlementHistory.noPaymentsForYou')}
                </div>
            ) : (
                <div class='space-y-2 max-h-[300px] overflow-y-auto overflow-x-hidden pr-1 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent hover:scrollbar-thumb-gray-400'>
                    {visibleSettlements.map((settlement) => {
                        const isCurrentUserPayer = settlement.payer.uid === currentUserId;
                        const isCurrentUserPayee = settlement.payee.uid === currentUserId;
                        const isDeleted = settlement.deletedAt !== null && settlement.deletedAt !== undefined;
                        const deletedByUser = settlement.deletedBy ? members.value.find((m) => m.uid === settlement.deletedBy) : null;
                        const deletedByContent = deletedByUser ? renderMemberName(deletedByUser) : t('common.unknown');

                        // Get theme colors
                        const payerTheme = settlement.payer.themeColor || themeStore.getThemeForUser(settlement.payer.uid);
                        const isDark = themeStore.isDarkMode;
                        const themeColor = payerTheme ? (isDark ? payerTheme.dark : payerTheme.light) : '#6B7280';

                        // Determine if current user is involved
                        const isCurrentUserInvolved = isCurrentUserPayer || isCurrentUserPayee;

                        return (
                            <div
                                key={settlement.id}
                                class={`group border-b last:border-0 pb-3 last:pb-0 -mx-2 px-2 py-2 rounded relative ${isDeleted ? 'opacity-60 bg-gray-50' : isCurrentUserInvolved ? 'hover:bg-blue-50' : 'hover:bg-gray-50'}`}
                                style={{
                                    borderLeftWidth: '4px',
                                    borderLeftColor: isDeleted ? '#9CA3AF' : themeColor,
                                    backgroundColor: isDeleted ? '' : isCurrentUserInvolved ? `${themeColor}12` : `${themeColor}08`,
                                }}
                                data-testid='settlement-item'
                            >
                                <div class='grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 items-start'>
                                    {/* Row 1: Payer avatar and name */}
                                    <div class='row-start-1 flex items-center'>
                                        <Avatar
                                            displayName={getGroupDisplayName(settlement.payer)}
                                            userId={settlement.payer.uid}
                                            size='sm'
                                            themeColor={payerTheme}
                                        />
                                    </div>
                                    <div class='row-start-1 col-start-2 flex items-center gap-2 min-w-0'>
                                        <span class='text-sm font-semibold text-gray-900 truncate'>
                                            {renderMemberName(settlement.payer)}
                                        </span>
                                    </div>

                                    {/* Row 2: Arrow, amount, and date */}
                                    <div class='row-start-2 flex items-center justify-center self-stretch'>
                                        <div class='flex items-center justify-center w-6 h-full text-gray-400'>
                                            <svg class='w-3 h-3 text-gray-400' fill='none' stroke='currentColor' viewBox='0 0 24 24' aria-hidden='true' focusable='false'>
                                                <path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 14l-7 7m0 0l-7-7m7 7V3' />
                                            </svg>
                                        </div>
                                    </div>
                                    <div class='row-start-2 col-start-2 flex items-center gap-2 w-full min-w-0'>
                                        <div class='flex items-center gap-2'>
                                            <span class={`text-base font-bold tabular-nums ${isDeleted ? 'text-gray-500' : isCurrentUserPayee ? 'text-green-600' : 'text-gray-900'}`} data-financial-amount='settlement'>
                                                {isCurrentUserPayee && '+'}
                                                <CurrencyAmount amount={settlement.amount} currency={settlement.currency} displayOptions={{ includeCurrencyCode: false }} />
                                            </span>
                                            <span class='text-xs text-gray-600'>{formatDate(settlement.date)}</span>
                                        </div>

                                        {/* Action buttons */}
                                        <div class='flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 ml-auto'>
                                            {onEditSettlement && (() => {
                                                const editTooltip = settlement.isLocked ? t('settlementHistory.cannotEditTooltip') : t('settlementHistory.editPaymentTooltip');

                                                return (
                                                    <Tooltip content={editTooltip}>
                                                        <button
                                                            type='button'
                                                            onClick={() => !settlement.isLocked && onEditSettlement(settlement)}
                                                            disabled={settlement.isLocked}
                                                            class='p-1 text-gray-400 hover:text-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:text-gray-400'
                                                            aria-label={editTooltip}
                                                            data-testid='edit-settlement-button'
                                                        >
                                                            <PencilIcon class='h-4 w-4' aria-hidden='true' />
                                                        </button>
                                                    </Tooltip>
                                                );
                                            })()}
                                            {(() => {
                                                const deleteTooltip = t('settlementHistory.deletePaymentTooltip');

                                                return (
                                                    <Tooltip content={deleteTooltip}>
                                                        <button
                                                            type='button'
                                                            onClick={() => handleDeleteClick(settlement)}
                                                            class='p-1 text-gray-400 hover:text-red-600 transition-colors'
                                                            aria-label={deleteTooltip}
                                                            data-testid='delete-settlement-button'
                                                        >
                                                            <TrashIcon class='h-4 w-4' aria-hidden='true' />
                                                        </button>
                                                    </Tooltip>
                                                );
                                            })()}
                                        </div>
                                    </div>

                                    {/* Row 3: Payee avatar and name */}
                                    <div class='row-start-3 flex items-center'>
                                        <Avatar
                                            displayName={getGroupDisplayName(settlement.payee)}
                                            userId={settlement.payee.uid}
                                            size='sm'
                                            themeColor={settlement.payee.themeColor || themeStore.getThemeForUser(settlement.payee.uid)}
                                        />
                                    </div>
                                    <div class='row-start-3 col-start-2 flex items-center gap-2 min-w-0'>
                                        <span class='text-sm font-semibold text-gray-900 truncate'>
                                            {renderMemberName(settlement.payee)}
                                        </span>
                                    </div>

                                    {/* Row 4: Note if present (spans full width) */}
                                    {settlement.note && (
                                        <div class='row-start-4 col-span-2 text-xs text-gray-600 mt-0.5 truncate'>
                                            {settlement.note}
                                        </div>
                                    )}

                                    {/* Deleted info if present */}
                                    {isDeleted && settlement.deletedAt && (
                                        <div class={`${settlement.note ? 'row-start-5' : 'row-start-4'} col-start-2 text-red-600 text-xs mt-1`} data-financial-amount='deleted'>
                                            {t('settlementHistory.deletedBy')} {deletedByContent} {formatDistanceToNow(new Date(settlement.deletedAt))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {hasMore.value && (
                <div class='text-center pt-4'>
                    <button
                        onClick={() => enhancedGroupDetailStore.loadMoreSettlements()}
                        disabled={isLoading.value}
                        data-testid='load-more-settlements-button'
                        class='px-4 py-2 text-sm text-blue-600 hover:text-blue-700 font-medium disabled:opacity-50'
                    >
                        {isLoading.value ? t('common.loading') : t('settlementHistory.loadMorePayments')}
                    </button>
                </div>
            )}

            {settlementToDelete && (
                <ConfirmDialog
                    isOpen={!!settlementToDelete}
                    title={t('settlementHistory.deletePaymentTitle')}
                    message={t('settlementHistory.deletePaymentMessage', {
                        amount: formatCurrency(settlementToDelete.amount, settlementToDelete.currency),
                        payer: getGroupDisplayName(settlementToDelete.payer),
                        payee: getGroupDisplayName(settlementToDelete.payee),
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
