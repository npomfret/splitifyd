import { apiClient } from '@/app/apiClient';
import { CommentsSection } from '@/components/comments';
import { Avatar, Badge, Button, Card, CurrencyAmount, LoadingSpinner, Stack, Tooltip, Typography } from '@/components/ui';
import { Clickable } from '@/components/ui/Clickable';
import { XIcon } from '@/components/ui/icons';
import { Modal, ModalContent, ModalHeader } from '@/components/ui/Modal';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { logError } from '@/utils/browser-logger.ts';
import { formatCurrency } from '@/utils/currency';
import { formatDistanceToNow, formatExpenseDateTime, formatLocalDateTime } from '@/utils/dateUtils.ts';
import { getGroupDisplayName } from '@/utils/displayName';
import { ExpenseDTO, ExpenseId, GroupDTO, GroupId, GroupMember, toCurrencyISOCode, toDisplayName } from '@billsplit-wl/shared';
import { useEffect, useRef, useState } from 'preact/hooks';
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
    const previousIsOpenRef = useRef(isOpen);

    const [expense, setExpense] = useState<ExpenseDTO | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [group, setGroup] = useState<GroupDTO | null>(null);
    const [members, setMembers] = useState<GroupMember[]>([]);
    const [showReceiptModal, setShowReceiptModal] = useState(false);

    // Track open state transitions for data loading
    useEffect(() => {
        const wasOpen = previousIsOpenRef.current;
        const isNowOpen = isOpen;
        previousIsOpenRef.current = isOpen;

        // Reset and load on open transition
        if (!wasOpen && isNowOpen && expenseId) {
            loadExpense(expenseId);
        }

        // Reset state when closing
        if (wasOpen && !isNowOpen) {
            setExpense(null);
            setError(null);
            setLoading(true);
            setGroup(null);
            setMembers([]);
            setShowReceiptModal(false);
        }
    }, [isOpen, expenseId]);

    const loadExpense = async (id: ExpenseId) => {
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
    };

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
                        <div className='text-center py-4'>
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

                        {/* Amount */}
                        <div className='text-center pb-4 border-b border-border-default'>
                            <h2 className='text-2xl font-bold text-text-primary'>
                                <CurrencyAmount amount={expense.amount} currency={expense.currency} />
                            </h2>
                        </div>

                        {/* Key Details */}
                        <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
                            {/* Date */}
                            <div>
                                <p className='text-sm text-text-primary/60'>{t('expenseComponents.expenseDetailModal.date')}</p>
                                <p className='font-medium text-text-primary'>{formatExpenseDateTime(expense.date)}</p>
                                <p className='text-xs text-text-primary/60'>
                                    ({formatDistanceToNow(new Date(expense.date))})
                                </p>
                            </div>

                            {/* Labels */}
                            {expense.labels.length > 0 && (
                                <div>
                                    <p className='text-sm text-text-primary/60'>{t('expenseComponents.expenseDetailModal.labels')}</p>
                                    <div className='flex flex-wrap gap-1.5 mt-1'>
                                        {expense.labels.map((label) => (
                                            <Badge key={label} variant='primary'>
                                                {label}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Paid By */}
                            <div>
                                <p className='text-sm text-text-primary/60 mb-1'>{t('expenseComponents.expenseDetailModal.paidBy')}</p>
                                <div className='flex items-center gap-2'>
                                    <Avatar displayName={payerName} userId={expense.paidBy} size='sm' />
                                    <p className='font-medium text-text-primary text-sm'>{payerName}</p>
                                </div>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className='pt-4 border-t border-border-default'>
                            <ExpenseActions
                                expense={expense}
                                onEdit={handleEdit}
                                onDelete={handleDelete}
                                onShare={handleShare}
                                onCopy={handleCopy}
                                disabled={expense.isLocked}
                            />
                        </div>

                        {/* Split Breakdown */}
                        <Card variant='glass' className='border-border-default'>
                            <SplitBreakdown expense={expense} members={members} />
                        </Card>

                        {/* Comments */}
                        <Card variant='glass' className='border-border-default' ariaLabel={t('pages.expenseDetailPage.discussion')}>
                            <Stack spacing='md'>
                                <h3 className='font-semibold text-text-primary'>{t('expenseComponents.expenseDetailModal.comments')}</h3>
                                <CommentsSection target={{ type: 'expense', expenseId: expenseId! }} maxHeight='200px' />
                            </Stack>
                        </Card>

                        {/* Receipt */}
                        {expense.receiptUrl && (
                            <Card variant='glass' className='border-border-default'>
                                <Stack spacing='md'>
                                    <h3 className='font-semibold text-text-primary'>{t('expenseComponents.expenseDetailModal.receipt')}</h3>
                                    <div className='text-center'>
                                        <Clickable
                                            onClick={() => setShowReceiptModal(true)}
                                            aria-label={t('expenseComponents.expenseDetailModal.viewReceipt')}
                                            eventName='receipt_view'
                                            eventProps={{ expenseId }}
                                        >
                                            <img
                                                src={expense.receiptUrl}
                                                alt='Receipt'
                                                className='max-w-full h-auto rounded-lg shadow-md mx-auto max-h-48 object-contain cursor-pointer hover:opacity-90 transition-opacity'
                                                loading='lazy'
                                            />
                                        </Clickable>
                                    </div>
                                </Stack>
                            </Card>
                        )}

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
                        <Tooltip content='Close' className='absolute top-2 right-2 z-10'>
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
                            <img
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
