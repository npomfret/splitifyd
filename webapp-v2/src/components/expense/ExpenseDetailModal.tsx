import { apiClient } from '@/app/apiClient';
import { useModalOpen } from '@/app/hooks/useModalOpen';
import { getAuthStore } from '@/app/stores/auth-store';
import { CommentsSection } from '@/components/comments';
import { ReactionBar } from '@/components/reactions';
import { AuthenticatedImage, Avatar, Badge, Button, Card, CurrencyAmount, LoadingSpinner, Stack, Tooltip, Typography } from '@/components/ui';
import { Clickable } from '@/components/ui/Clickable';
import { ClockIcon, MapPinIcon, XIcon } from '@/components/ui/icons';
import { Modal, ModalContent, ModalHeader } from '@/components/ui/Modal';
import { logError } from '@/utils/browser-logger.ts';
import { formatCurrency } from '@/utils/currency';
import { formatDistanceToNow, formatExpenseDateTime, formatLocalDateTime } from '@/utils/dateUtils.ts';
import { getGroupDisplayName } from '@/utils/displayName';
import type { ReactionEmoji, UserId } from '@billsplit-wl/shared';
import { ExpenseDTO, ExpenseId, GroupDTO, GroupId, GroupMember, toCurrencyISOCode, toDisplayName } from '@billsplit-wl/shared';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { useCallback, useEffect, useState } from 'preact/hooks';
import { useTranslation } from 'react-i18next';
import { ExpenseActions } from './ExpenseActions';
import { SplitBreakdown } from './SplitBreakdown';

interface ExpenseDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    groupId: GroupId;
    expenseId: ExpenseId | null;
    onEdit: (expenseId: ExpenseId) => void;
    onCopy: (expenseId: ExpenseId) => void;
}

export function ExpenseDetailModal({ isOpen, onClose, groupId, expenseId, onEdit, onCopy }: ExpenseDetailModalProps) {
    const { t } = useTranslation();

    const [expense, setExpense] = useState<ExpenseDTO | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [group, setGroup] = useState<GroupDTO | null>(null);
    const [members, setMembers] = useState<GroupMember[]>([]);
    const [showReceiptModal, setShowReceiptModal] = useState(false);
    const [currentUserId, setCurrentUserId] = useState<UserId | null>(null);

    useEffect(() => {
        getAuthStore().then((store) => {
            setCurrentUserId(store.user?.uid as UserId ?? null);
        });
    }, []);

    const loadExpense = useCallback(async (id: ExpenseId) => {
        try {
            setLoading(true);
            setError(null);

            const fullDetails = await apiClient.getExpenseFullDetails(id);

            setExpense(fullDetails.expense);
            setGroup(fullDetails.group);
            setMembers(fullDetails.members.members);
        } catch (err) {
            logError(t('expenseComponents.expenseDetailModal.failedToLoad'), err);
            setError(err instanceof Error ? err.message : t('expenseComponents.expenseDetailModal.failedToLoad'));
        } finally {
            setLoading(false);
        }
    }, [t]);

    // Handle open/close transitions
    useModalOpen(isOpen, {
        onOpen: useCallback(() => {
            if (expenseId) {
                loadExpense(expenseId);
            }
        }, [expenseId, loadExpense]),
        onClose: useCallback(() => {
            setExpense(null);
            setError(null);
            setLoading(true);
            setGroup(null);
            setMembers([]);
            setShowReceiptModal(false);
        }, []),
    });

    const handleEdit = () => {
        if (!expenseId) return;
        onClose();
        onEdit(expenseId);
    };

    const handleCopy = () => {
        if (!expenseId) return;
        onClose();
        onCopy(expenseId);
    };

    const handleDelete = async () => {
        if (!expenseId) return;

        try {
            await apiClient.deleteExpense(expenseId);
            // Activity feed handles refresh automatically via SSE
            onClose();
        } catch (err) {
            logError('Failed to delete expense', err);
            throw err;
        }
    };

    const handleReactionToggle = async (emoji: ReactionEmoji) => {
        if (!expenseId || !expense || !currentUserId) return;

        try {
            const response = await apiClient.toggleExpenseReaction(expenseId, emoji);

            // Optimistically update the local expense state
            const currentUserReactions = expense.userReactions?.[currentUserId] ?? [];
            const currentCounts = expense.reactionCounts || {};

            let newUserReactionsArray: ReactionEmoji[];
            let newCounts: typeof currentCounts;

            if (response.action === 'added') {
                newUserReactionsArray = [...currentUserReactions, emoji];
                newCounts = { ...currentCounts, [emoji]: (currentCounts[emoji] || 0) + 1 };
            } else {
                newUserReactionsArray = currentUserReactions.filter((e) => e !== emoji);
                const newCount = (currentCounts[emoji] || 1) - 1;
                newCounts = { ...currentCounts };
                if (newCount > 0) {
                    newCounts[emoji] = newCount;
                } else {
                    delete newCounts[emoji];
                }
            }

            const newUserReactionsMap = {
                ...(expense.userReactions || {}),
                [currentUserId]: newUserReactionsArray,
            };

            setExpense({ ...expense, userReactions: newUserReactionsMap, reactionCounts: newCounts });
        } catch (err) {
            logError('Failed to toggle expense reaction', err);
        }
    };

    const handleShare = () => {
        if (!expenseId || !groupId || !expense) return;

        const url = `${window.location.origin}/groups/${groupId}/expenses/${expenseId}`;

        if (navigator.share) {
            navigator
                .share({
                    title: t('expenseComponents.expenseDetailModal.shareTitle', { description: expense.description }),
                    text: t('expenseComponents.expenseDetailModal.shareText', {
                        description: expense.description,
                        amount: formatCurrency(expense.amount, toCurrencyISOCode(expense.currency)),
                    }),
                    url: url,
                })
                .catch(() => {
                    void copyToClipboard(url);
                });
        } else {
            void copyToClipboard(url);
        }
    };

    const copyToClipboard = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text);
        } catch {
            const textArea = document.createElement('textarea');
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
        }
    };

    const memberMap = members.reduce(
        (acc, member) => {
            acc[member.uid] = member;
            return acc;
        },
        {} as Record<string, GroupMember>,
    );

    const payer = expense ? memberMap[expense.paidBy] : null;
    const payerName = payer ? getGroupDisplayName(payer) : toDisplayName('');

    return (
        <Modal
            open={isOpen}
            onClose={onClose}
            size='lg'
            labelledBy='expense-detail-modal-title'
        >
            <ModalHeader>
                <div className='flex justify-between items-center'>
                    <Typography variant='heading' id='expense-detail-modal-title'>
                        {expense?.description || t('expenseComponents.expenseDetailModal.title')}
                    </Typography>
                    <Tooltip content={t('expenseComponents.expenseDetailModal.closeModal')}>
                        <Clickable
                            as='button'
                            type='button'
                            onClick={onClose}
                            className='text-text-muted hover:text-text-primary'
                            aria-label={t('expenseComponents.expenseDetailModal.closeModal')}
                            eventName='modal_close'
                            eventProps={{ modalName: 'expense_detail', method: 'x_button' }}
                        >
                            <XIcon size={24} />
                        </Clickable>
                    </Tooltip>
                </div>
            </ModalHeader>

            <ModalContent>
                {/* Loading state */}
                {loading && (
                    <div className='flex items-center justify-center py-8'>
                        <LoadingSpinner size='lg' />
                    </div>
                )}

                {/* Error state */}
                {!loading && (error || !expense) && (
                    <Stack spacing='md'>
                        <div className='text-center py-4' role='alert'>
                            <Typography variant='body' className='text-semantic-error'>
                                {error || t('expenseComponents.expenseDetailModal.expenseNotFound')}
                            </Typography>
                        </div>
                        <Button variant='secondary' onClick={onClose}>
                            {t('expenseComponents.expenseDetailModal.close')}
                        </Button>
                    </Stack>
                )}

                {/* Content */}
                {!loading && expense && payer && (
                    <Stack spacing='md'>
                        {/* Lock Warning */}
                        {expense.isLocked && (
                            <div className='bg-surface-warning border border-border-warning rounded-lg p-3' role='alert'>
                                <div className='flex items-start gap-2'>
                                    <ExclamationTriangleIcon className='w-5 h-5 text-semantic-warning shrink-0' aria-hidden='true' />
                                    <p className='text-sm text-text-primary'>
                                        {t('pages.expenseDetailPage.containsDepartedMembers')}
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Hero: Amount */}
                        <div className='text-center'>
                            <div
                                className='text-4xl font-bold text-text-primary'
                                aria-label={t('expenseComponents.expenseDetailModal.expenseAmount')}
                            >
                                <CurrencyAmount amount={expense.amount} currency={expense.currency} />
                            </div>
                        </div>

                        {/* Metadata row */}
                        <div className='flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm text-text-muted'>
                            {/* Date */}
                            <div className='flex items-center gap-1.5'>
                                <ClockIcon size={16} className='text-text-muted' />
                                <span>{formatExpenseDateTime(expense.date)}</span>
                            </div>

                            {/* Location (if present) */}
                            {expense.location && (
                                <div className='flex items-center gap-1.5'>
                                    <MapPinIcon size={16} className='text-text-muted' />
                                    {expense.location.url
                                        ? (
                                            <a
                                                href={expense.location.url}
                                                target='_blank'
                                                rel='noopener noreferrer'
                                                className='hover:text-text-primary hover:underline'
                                                aria-label={t('expenseComponents.expenseDetailModal.openInMaps')}
                                            >
                                                {expense.location.name}
                                            </a>
                                        )
                                        : <span>{expense.location.name}</span>}
                                </div>
                            )}

                            {/* Paid By */}
                            <div className='flex items-center gap-1.5'>
                                <Avatar displayName={payerName} userId={expense.paidBy} size='xs' />
                                <span>{payerName}</span>
                            </div>
                        </div>

                        {/* Labels */}
                        {expense.labels.length > 0 && (
                            <div className='flex flex-wrap justify-center gap-1.5'>
                                {expense.labels.map((label) => (
                                    <Badge key={label} variant='primary'>
                                        {label}
                                    </Badge>
                                ))}
                            </div>
                        )}

                        {/* Reactions */}
                        <div className='flex justify-center pb-4 border-b border-border-default'>
                            <ReactionBar
                                counts={expense.reactionCounts}
                                userReactions={currentUserId ? expense.userReactions?.[currentUserId] : undefined}
                                onToggle={handleReactionToggle}
                                size='md'
                            />
                        </div>

                        {/* Actions */}
                        <div>
                            <ExpenseActions
                                expense={expense}
                                onEdit={handleEdit}
                                onDelete={handleDelete}
                                onShare={handleShare}
                                onCopy={handleCopy}
                                disabled={expense.isLocked}
                            />
                        </div>

                        {/* Receipt */}
                        {expense.receiptUrl && (
                            <Card variant='glass' className='border-border-default' ariaLabel={t('expenseComponents.expenseDetailModal.receipt')}>
                                <Stack spacing='sm'>
                                    <h3 className='font-semibold text-text-primary'>{t('expenseComponents.expenseDetailModal.receipt')}</h3>
                                    <div className='flex justify-center'>
                                        <Clickable
                                            onClick={() => setShowReceiptModal(true)}
                                            aria-label={t('expenseComponents.expenseDetailModal.viewReceipt')}
                                            eventName='receipt_thumbnail_click'
                                            eventProps={{ expenseId }}
                                        >
                                            <AuthenticatedImage
                                                src={expense.receiptUrl}
                                                alt={t('expenseComponents.expenseDetailModal.receipt')}
                                                className='max-w-xs max-h-48 object-contain rounded-lg border border-border-default cursor-pointer hover:opacity-80 transition-opacity'
                                            />
                                        </Clickable>
                                    </div>
                                </Stack>
                            </Card>
                        )}

                        {/* Split Breakdown */}
                        <Card variant='glass' className='border-border-default'>
                            <SplitBreakdown expense={expense} members={members} />
                        </Card>

                        {/* Comments */}
                        <Card variant='glass' className='border-border-default' ariaLabel={t('pages.expenseDetailPage.discussion')}>
                            <Stack spacing='md'>
                                <h3 className='font-semibold text-text-primary'>{t('expenseComponents.expenseDetailModal.comments')}</h3>
                                <CommentsSection target={{ type: 'expense', expenseId: expenseId! }} groupId={groupId} maxHeight='200px' allowAttachmentUpload={false} />
                            </Stack>
                        </Card>

                        {/* Metadata */}
                        <div className='text-xs text-text-primary/50 pt-2'>
                            <div className='flex items-center justify-between'>
                                <span>Added {formatDistanceToNow(new Date(expense.createdAt))}</span>
                                <span>{formatLocalDateTime(expense.createdAt)}</span>
                            </div>
                            {expense.updatedAt !== expense.createdAt && (
                                <div className='flex items-center justify-between mt-1'>
                                    <span>Updated {formatDistanceToNow(new Date(expense.updatedAt))}</span>
                                    <span>{formatLocalDateTime(expense.updatedAt)}</span>
                                </div>
                            )}
                        </div>
                    </Stack>
                )}
            </ModalContent>

            {/* Receipt Full-Screen Modal */}
            {showReceiptModal && expense?.receiptUrl && (
                <div
                    className='fixed inset-0 flex items-center justify-center z-60 p-4'
                    style={{ backgroundColor: 'var(--lightbox-overlay, rgba(0, 0, 0, 0.85))' }}
                    onClick={() => setShowReceiptModal(false)}
                    role='dialog'
                    aria-modal='true'
                    aria-label='Receipt viewer'
                    onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                            setShowReceiptModal(false);
                        }
                    }}
                    tabIndex={-1}
                >
                    <div className='relative max-w-4xl max-h-full'>
                        <Tooltip content='Close' className='absolute top-2 end-2 z-10'>
                            <Clickable
                                as='button'
                                type='button'
                                onClick={() => setShowReceiptModal(false)}
                                className='bg-surface-overlay text-text-inverted rounded-full p-2 hover:opacity-75 transition-all focus:outline-hidden focus:ring-2 focus:ring-text-inverted'
                                aria-label='Close receipt viewer'
                                eventName='receipt_modal_close'
                                eventProps={{ expenseId }}
                            >
                                <XIcon size={24} />
                            </Clickable>
                        </Tooltip>
                        <Clickable
                            onClick={(e: MouseEvent) => e.stopPropagation()}
                            aria-label='Receipt image'
                            eventName='receipt_image_click'
                            eventProps={{ expenseId }}
                        >
                            <AuthenticatedImage
                                src={expense.receiptUrl}
                                alt='Receipt full size'
                                className='max-w-full max-h-full object-contain rounded-lg'
                            />
                        </Clickable>
                    </div>
                </div>
            )}
        </Modal>
    );
}
