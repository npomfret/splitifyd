import { apiClient } from '@/app/apiClient.ts';
import { useAuthRequired } from '@/app/hooks/useAuthRequired.ts';
import { enhancedGroupDetailStore } from '@/app/stores/group-detail-store-enhanced.ts';
import { themeStore } from '@/app/stores/theme-store.ts';
import { ReactionBar } from '@/components/reactions';
import { ArrowDownIcon } from '@/components/ui/icons';
import { logError } from '@/utils/browser-logger';
import { formatCurrency } from '@/utils/currency';
import { getGroupDisplayName } from '@/utils/displayName';
import type { GroupId, GroupMember, ReactionEmoji, SettlementId, SettlementWithMembers } from '@billsplit-wl/shared';
import { BanknotesIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline';
import { useComputed } from '@preact/signals';
import { useEffect, useMemo, useState } from 'preact/hooks';
import { useTranslation } from 'react-i18next';
import { Checkbox, ConfirmDialog, CurrencyAmount, EmptyState, RelativeTime, SkeletonList, SkeletonSettlementItem, Stack, Tooltip } from '../ui';
import { Avatar } from '../ui/Avatar';

interface SettlementHistoryProps {
    groupId: GroupId;
    userId?: string;
    onEditSettlement?: (settlement: SettlementWithMembers) => void;
    showDeletedSettlements?: boolean;
    onShowDeletedChange?: (show: boolean) => void;
    canToggleShowDeleted?: boolean;
}

export function SettlementHistory({
    groupId,
    userId,
    onEditSettlement,
    showDeletedSettlements = false,
    onShowDeletedChange,
    canToggleShowDeleted = false,
}: SettlementHistoryProps) {
    const { t } = useTranslation();
    const authStore = useAuthRequired();
    const currentUser = authStore.user;
    const currentUserId = currentUser?.uid;
    const [showAllSettlements, setShowAllSettlements] = useState(false);
    const [settlementToDelete, setSettlementToDelete] = useState<SettlementWithMembers | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // Use useComputed to reactively track store changes
    const settlements = useComputed(() => enhancedGroupDetailStore.settlements);
    const isLoading = useComputed(() => enhancedGroupDetailStore.loadingSettlements);
    const hasMore = useComputed(() => enhancedGroupDetailStore.hasMoreSettlements);
    const members = useComputed(() => enhancedGroupDetailStore.members);

    const renderMemberName = (member: GroupMember) => {
        const displayName = getGroupDisplayName(member);
        const isCurrentUser = currentUserId === member.uid;

        return (
            <>
                {displayName}
                {isCurrentUser && <span className='text-text-muted ml-1'>({t('common.you')})</span>}
            </>
        );
    };

    const visibleSettlements = useMemo(() => {
        const settlementList = settlements.value ?? [];

        if (showAllSettlements || !currentUserId) {
            return settlementList;
        }

        return settlementList.filter(
            (settlement) => settlement.payer.uid === currentUserId || settlement.payee.uid === currentUserId,
        );
    }, [settlements.value, showAllSettlements, currentUserId]);

    const totalSettlements = settlements.value.length;

    useEffect(() => {
        // Always load settlements when component mounts or parameters change
        // This ensures we have fresh data when the history modal opens
        if (groupId) {
            enhancedGroupDetailStore.fetchSettlements();
        }
    }, [groupId, userId]);

    const handleDeleteClick = (settlement: SettlementWithMembers) => {
        setSettlementToDelete(settlement);
    };

    const handleConfirmDelete = async () => {
        if (!settlementToDelete) return;

        setIsDeleting(true);
        try {
            await apiClient.deleteSettlement(settlementToDelete.id);
            // Activity feed handles refresh automatically via SSE
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

    const handleReactionToggle = async (settlementId: SettlementId, emoji: ReactionEmoji) => {
        await enhancedGroupDetailStore.toggleSettlementReaction(settlementId, emoji);
    };

    if (isLoading.value && totalSettlements === 0) {
        return <SkeletonList>{SkeletonSettlementItem}</SkeletonList>;
    }

    // Remove error handling - the store manages errors now

    if (totalSettlements === 0) {
        return (
            <EmptyState
                icon={<BanknotesIcon className='w-12 h-12' aria-hidden='true' />}
                title={t('settlementHistory.noPaymentsYet')}
                className='py-8'
            />
        );
    }

    return (
        <Stack spacing='sm'>
            <div className='pb-2 border-b border-border-default space-y-2'>
                <Checkbox
                    label={t('settlementHistory.showAll')}
                    checked={showAllSettlements}
                    onChange={(checked) => setShowAllSettlements(checked)}
                />
                {canToggleShowDeleted && onShowDeletedChange && (
                    <Checkbox
                        label={t('common.includeDeleted')}
                        checked={showDeletedSettlements}
                        onChange={onShowDeletedChange}
                    />
                )}
            </div>

            {visibleSettlements.length === 0
                ? (
                    <div className='text-center py-6 help-text'>
                        {t('settlementHistory.noPaymentsForYou')}
                    </div>
                )
                : (
                    <Stack
                        spacing='sm'
                        className='max-h-[300px] overflow-y-auto overflow-x-hidden pr-1 scrollbar-thin scrollbar-thumb-border-default scrollbar-track-transparent hover:scrollbar-thumb-border-strong'
                    >
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
                                <article
                                    key={settlement.id}
                                    class={`group border-b last:border-0 pb-3 last:pb-0 -mx-2 px-2 py-2 rounded relative ${
                                        isDeleted ? 'opacity-60 bg-surface-muted' : isCurrentUserInvolved ? 'hover:bg-interactive-primary/10' : 'hover:bg-surface-muted'
                                    }`}
                                    style={{
                                        borderLeftWidth: '4px',
                                        borderLeftColor: isDeleted ? '#9CA3AF' : themeColor,
                                        backgroundColor: isDeleted ? '' : isCurrentUserInvolved ? `${themeColor}12` : `${themeColor}08`,
                                    }}
                                >
                                    <div className='grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 items-start'>
                                        {/* Row 1: Payer avatar and name */}
                                        <div className='row-start-1 flex items-center'>
                                            <Avatar
                                                displayName={getGroupDisplayName(settlement.payer)}
                                                userId={settlement.payer.uid}
                                                size='sm'
                                                themeColor={payerTheme}
                                            />
                                        </div>
                                        <div className='row-start-1 col-start-2 flex items-center gap-2 min-w-0'>
                                            <span className='text-sm font-semibold text-text-primary truncate'>
                                                {renderMemberName(settlement.payer)}
                                            </span>
                                        </div>

                                        {/* Row 2: Arrow, amount, and date */}
                                        <div className='row-start-2 flex items-center justify-center self-stretch'>
                                            <div className='flex items-center justify-center w-6 h-full text-text-muted'>
                                                <ArrowDownIcon size={12} className='text-text-muted' />
                                            </div>
                                        </div>
                                        <div className='row-start-2 col-start-2 flex items-center gap-2 w-full min-w-0'>
                                            <div className='flex items-center gap-2'>
                                                <span
                                                    class={`text-base font-bold tabular-nums ${isDeleted ? 'text-text-muted' : 'text-text-primary'}`}
                                                    data-financial-amount='settlement'
                                                >
                                                    <CurrencyAmount amount={settlement.amount} currency={settlement.currency} displayOptions={{ includeCurrencyCode: false }} />
                                                </span>
                                                <RelativeTime date={settlement.date} className='help-text-xs' tooltipPlacement='bottom' />
                                            </div>

                                            {/* Action buttons */}
                                            <div className='flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-auto'>
                                                {onEditSettlement && (() => {
                                                    const editTooltip = settlement.isLocked ? t('settlementHistory.cannotEditTooltip') : t('settlementHistory.editPaymentTooltip');

                                                    return (
                                                        <Tooltip content={editTooltip}>
                                                            <button
                                                                type='button'
                                                                onClick={() => !settlement.isLocked && onEditSettlement(settlement)}
                                                                disabled={settlement.isLocked}
                                                                className='p-1 text-text-muted hover:text-interactive-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:text-text-muted'
                                                                aria-label={editTooltip}
                                                            >
                                                                <PencilIcon className='h-4 w-4' aria-hidden='true' />
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
                                                                className='p-1 text-text-muted hover:text-semantic-error transition-colors'
                                                                aria-label={deleteTooltip}
                                                            >
                                                                <TrashIcon className='h-4 w-4' aria-hidden='true' />
                                                            </button>
                                                        </Tooltip>
                                                    );
                                                })()}
                                            </div>
                                        </div>

                                        {/* Row 3: Payee avatar and name */}
                                        <div className='row-start-3 flex items-center'>
                                            <Avatar
                                                displayName={getGroupDisplayName(settlement.payee)}
                                                userId={settlement.payee.uid}
                                                size='sm'
                                                themeColor={settlement.payee.themeColor || themeStore.getThemeForUser(settlement.payee.uid)}
                                            />
                                        </div>
                                        <div className='row-start-3 col-start-2 flex items-center gap-2 min-w-0'>
                                            <span className='text-sm font-semibold text-text-primary truncate'>
                                                {renderMemberName(settlement.payee)}
                                            </span>
                                        </div>

                                        {/* Row 4: Note if present (spans full width) */}
                                        {settlement.note && (
                                            <div className='row-start-4 col-span-2 help-text-xs mt-0.5 truncate'>
                                                {settlement.note}
                                            </div>
                                        )}

                                        {/* Deleted info if present */}
                                        {isDeleted && settlement.deletedAt && (
                                            <div
                                                class={`${
                                                    settlement.note
                                                        ? 'row-start-5'
                                                        : 'row-start-4'
                                                } col-start-2 text-semantic-error text-xs mt-1`}
                                                data-financial-amount='deleted'
                                            >
                                                {t('settlementHistory.deletedBy')} {deletedByContent}{' '}
                                                <RelativeTime
                                                    date={settlement
                                                        .deletedAt}
                                                    className='text-semantic-error'
                                                />
                                            </div>
                                        )}

                                        {/* Reactions */}
                                        <div className='col-span-2 mt-1'>
                                            <ReactionBar
                                                counts={settlement.reactionCounts}
                                                userReactions={currentUserId ? settlement.userReactions?.[currentUserId] : undefined}
                                                onToggle={(emoji) => handleReactionToggle(settlement.id, emoji)}
                                                size='sm'
                                            />
                                        </div>
                                    </div>
                                </article>
                            );
                        })}
                    </Stack>
                )}

            {hasMore.value && (
                <div className='text-center pt-4'>
                    <button
                        onClick={() => enhancedGroupDetailStore.loadMoreSettlements()}
                        disabled={isLoading.value}
                        className='px-4 py-2 text-sm text-interactive-primary hover:text-interactive-primary font-medium disabled:opacity-50'
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
        </Stack>
    );
}
