import { apiClient } from '@/app/apiClient';
import { enhancedGroupDetailStore } from '@/app/stores/group-detail-store-enhanced';
import { CommentsSection } from '@/components/comments';
import { Avatar, Button, Card, CurrencyAmount, LoadingSpinner, Stack, Tooltip, Typography } from '@/components/ui';
import { Clickable } from '@/components/ui/Clickable';
import { XIcon } from '@/components/ui/icons';
import { Modal } from '@/components/ui/Modal';
import { formatCurrency } from '@/utils/currency';
import { getGroupDisplayName } from '@/utils/displayName';
import { ExpenseDTO, ExpenseId, GroupDTO, GroupId, GroupMember, toCurrencyISOCode, toDisplayName } from '@billsplit-wl/shared';
import { batch, useSignal } from '@preact/signals';
import { useEffect, useRef, useState } from 'preact/hooks';
import { useTranslation } from 'react-i18next';
import { logError } from '../../utils/browser-logger';
import { formatDistanceToNow, formatExpenseDateTime, formatLocalDateTime } from '../../utils/dateUtils';
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

    const expense = useSignal<ExpenseDTO | null>(null);
    const loading = useSignal(true);
    const error = useSignal<string | null>(null);
    const group = useSignal<GroupDTO | null>(null);
    const members = useSignal<GroupMember[]>([]);
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
            expense.value = null;
            error.value = null;
            loading.value = true;
            group.value = null;
            members.value = [];
            setShowReceiptModal(false);
        }
    }, [isOpen, expenseId]);

    const loadExpense = async (id: ExpenseId) => {
        try {
            loading.value = true;
            error.value = null;

            const fullDetails = await apiClient.getExpenseFullDetails(id);

            batch(() => {
                expense.value = fullDetails.expense;
                group.value = fullDetails.group;
                members.value = fullDetails.members.members;
            });
        } catch (err) {
            logError(t('expenseComponents.expenseDetailModal.failedToLoad'), err);
            error.value = err instanceof Error ? err.message : t('expenseComponents.expenseDetailModal.failedToLoad');
        } finally {
            loading.value = false;
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
            await enhancedGroupDetailStore.refreshAll();
            onClose();
        } catch (err) {
            logError('Failed to delete expense', err);
            throw err;
        }
    };

    const handleShare = () => {
        if (!expenseId || !groupId || !expense.value) return;

        const url = `${window.location.origin}/groups/${groupId}/expenses/${expenseId}`;

        if (navigator.share) {
            navigator
                .share({
                    title: `Expense: ${expense.value.description}`,
                    text: `Check out this expense: ${expense.value.description} - ${
                        formatCurrency(expense.value.amount, toCurrencyISOCode(expense.value.currency))
                    }`,
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

    const memberMap = members.value.reduce(
        (acc, member) => {
            acc[member.uid] = member;
            return acc;
        },
        {} as Record<string, GroupMember>,
    );

    const payer = expense.value ? memberMap[expense.value.paidBy] : null;
    const payerName = payer ? getGroupDisplayName(payer) : toDisplayName('');

    return (
        <Modal
            open={isOpen}
            onClose={onClose}
            size='lg'
            labelledBy='expense-detail-modal-title'
            data-testid='expense-detail-modal'
        >
            {/* Modal Header */}
            <div class='px-6 py-4 border-b border-border-default'>
                <div class='flex justify-between items-center'>
                    <Typography variant='heading' id='expense-detail-modal-title'>
                        {expense.value?.description || t('expenseComponents.expenseDetailModal.title')}
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
            </div>

            {/* Modal Content */}
            <div class='px-6 py-5 max-h-[70vh] overflow-y-auto'>
                {/* Loading state */}
                {loading.value && (
                    <div className='flex items-center justify-center py-8'>
                        <LoadingSpinner size='lg' />
                    </div>
                )}

                {/* Error state */}
                {!loading.value && (error.value || !expense.value) && (
                    <Stack spacing='md'>
                        <div className='text-center py-4'>
                            <Typography variant='body' className='text-semantic-error'>
                                {error.value || t('expenseComponents.expenseDetailModal.expenseNotFound')}
                            </Typography>
                        </div>
                        <Button variant='secondary' onClick={onClose}>
                            {t('expenseComponents.expenseDetailModal.close')}
                        </Button>
                    </Stack>
                )}

                {/* Content */}
                {!loading.value && expense.value && payer && (
                    <Stack spacing='md'>
                        {/* Lock Warning */}
                        {expense.value.isLocked && (
                            <div className='bg-surface-warning border border-border-warning rounded-lg p-3' data-testid='expense-lock-warning'>
                                <div className='flex items-start gap-2'>
                                    <span className='text-lg'>⚠️</span>
                                    <p className='text-sm text-text-primary'>
                                        {t('pages.expenseDetailPage.containsDepartedMembers')}
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Amount */}
                        <div className='text-center pb-4 border-b border-border-default'>
                            <h2 className='text-2xl font-bold text-text-primary' data-testid='expense-amount'>
                                <CurrencyAmount amount={expense.value.amount} currency={expense.value.currency} />
                            </h2>
                        </div>

                        {/* Key Details */}
                        <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
                            {/* Date */}
                            <div>
                                <p className='text-sm text-text-primary/60'>{t('expenseComponents.expenseDetailModal.date')}</p>
                                <p className='font-medium text-text-primary'>{formatExpenseDateTime(expense.value.date)}</p>
                                <p className='text-xs text-text-primary/60'>
                                    ({formatDistanceToNow(new Date(expense.value.date))})
                                </p>
                            </div>

                            {/* Label */}
                            <div>
                                <p className='text-sm text-text-primary/60'>{t('expenseComponents.expenseDetailModal.label')}</p>
                                <p className='font-medium text-text-primary'>{expense.value.label}</p>
                            </div>

                            {/* Paid By */}
                            <div>
                                <p className='text-sm text-text-primary/60 mb-1'>{t('expenseComponents.expenseDetailModal.paidBy')}</p>
                                <div className='flex items-center gap-2'>
                                    <Avatar displayName={payerName} userId={expense.value.paidBy} size='sm' />
                                    <p className='font-medium text-text-primary text-sm'>{payerName}</p>
                                </div>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className='pt-4 border-t border-border-default'>
                            <ExpenseActions
                                expense={expense.value}
                                onEdit={handleEdit}
                                onDelete={handleDelete}
                                onShare={handleShare}
                                onCopy={handleCopy}
                                disabled={expense.value.isLocked}
                            />
                        </div>

                        {/* Split Breakdown */}
                        <Card variant='glass' className='border-border-default'>
                            <SplitBreakdown expense={expense.value} members={members.value} />
                        </Card>

                        {/* Comments */}
                        <Card variant='glass' className='border-border-default'>
                            <Stack spacing='md'>
                                <h3 className='font-semibold text-text-primary'>{t('expenseComponents.expenseDetailModal.comments')}</h3>
                                <CommentsSection target={{ type: 'expense', expenseId: expenseId! }} maxHeight='200px' />
                            </Stack>
                        </Card>

                        {/* Receipt */}
                        {expense.value.receiptUrl && (
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
                                                src={expense.value.receiptUrl}
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
                                <span>Added {formatDistanceToNow(new Date(expense.value.createdAt))}</span>
                                <span>{formatLocalDateTime(expense.value.createdAt)}</span>
                            </div>
                            {expense.value.updatedAt !== expense.value.createdAt && (
                                <div className='flex items-center justify-between mt-1'>
                                    <span>Updated {formatDistanceToNow(new Date(expense.value.updatedAt))}</span>
                                    <span>{formatLocalDateTime(expense.value.updatedAt)}</span>
                                </div>
                            )}
                        </div>
                    </Stack>
                )}
            </div>

            {/* Receipt Full-Screen Modal */}
            {showReceiptModal && expense.value?.receiptUrl && (
                <div
                    className='fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[60] p-4'
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
                        <Tooltip content='Close'>
                            <Clickable
                                as='button'
                                type='button'
                                onClick={() => setShowReceiptModal(false)}
                                className='absolute top-2 right-2 z-10 bg-black bg-opacity-50 text-text-inverted rounded-full p-2 hover:bg-opacity-75 transition-all focus:outline-none focus:ring-2 focus:ring-text-inverted'
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
                                src={expense.value.receiptUrl}
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
