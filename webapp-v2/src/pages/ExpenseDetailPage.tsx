import { CommentsSection } from '@/components/comments';
import { Avatar, Button, Card, CurrencyAmount, LoadingSpinner, Stack, Tooltip, Typography } from '@/components/ui';
import { Clickable } from '@/components/ui/Clickable';
import { XIcon } from '@/components/ui/icons';
import { navigationService } from '@/services/navigation.service';
import { formatCurrency } from '@/utils/currency';
import { getGroupDisplayName } from '@/utils/displayName';
import { ExpenseDTO, ExpenseId, GroupDTO, GroupId, GroupMember, toCurrencyISOCode } from '@billsplit-wl/shared';
import { batch, useComputed, useSignal } from '@preact/signals';
import { useEffect, useState } from 'preact/hooks';
import { useTranslation } from 'react-i18next';
import { apiClient } from '../app/apiClient';
import { ExpenseActions } from '@/components/expense';
import { SplitBreakdown } from '@/components/expense';
import { BaseLayout } from '../components/layout/BaseLayout';
import { logError } from '../utils/browser-logger';
import { formatDistanceToNow, formatExpenseDateTime, formatLocalDateTime } from '../utils/dateUtils';

interface ExpenseDetailPageProps {
    groupId?: GroupId;
    expenseId?: ExpenseId;
}

// Helper function to truncate description for display
const truncateDescription = (description: string, maxLength: number = 40): string => {
    if (description.length <= maxLength) {
        return description;
    }
    return description.slice(0, maxLength) + '...';
};

export default function ExpenseDetailPage({ groupId, expenseId }: ExpenseDetailPageProps) {
    const { t } = useTranslation();
    const expense = useSignal<ExpenseDTO | null>(null);
    const loading = useSignal(true);
    const error = useSignal<string | null>(null);
    const [showReceiptModal, setShowReceiptModal] = useState(false);

    // Local state for page data (replaces store dependency)
    const group = useSignal<GroupDTO | null>(null);
    const members = useSignal<GroupMember[]>([]);

    // Create member lookup map
    const memberMap = useComputed(() => {
        return members.value.reduce(
            (acc, member) => {
                acc[member.uid] = member;
                return acc;
            },
            {} as Record<string, (typeof members.value)[0]>,
        );
    });

    // Load expense data
    useEffect(() => {
        if (!groupId) {
            error.value = t('pages.expenseDetailPage.missingGroupId');
            loading.value = false;
            return;
        }

        if (!expenseId) {
            error.value = t('pages.expenseDetailPage.missingExpenseId');
            loading.value = false;
            return;
        }

        const loadExpense = async () => {
            try {
                loading.value = true;
                error.value = null;

                // Use consolidated endpoint to get expense + group + members atomically
                const fullDetails = await apiClient.getExpenseFullDetails(expenseId);

                // Update all local state atomically using batch to prevent race conditions
                batch(() => {
                    expense.value = fullDetails.expense;
                    group.value = fullDetails.group;
                    members.value = fullDetails.members.members;
                });
            } catch (err) {
                logError(t('pages.expenseDetailPage.failedToLoad'), err);
                error.value = err instanceof Error ? err.message : t('pages.expenseDetailPage.failedToLoad');
            } finally {
                loading.value = false;
            }
        };

        // Intentionally not awaited - useEffect cannot be async (React anti-pattern)
        loadExpense();
    }, [groupId, expenseId]);

    const handleEdit = () => {
        navigationService.goToEditExpense(groupId!, expenseId!);
    };

    const handleCopy = () => {
        navigationService.goToCopyExpense(groupId!, expenseId!);
    };

    const handleBack = () => {
        navigationService.goToGroup(groupId!);
    };

    const handleDelete = async () => {
        if (!expenseId) return;

        try {
            await apiClient.deleteExpense(expenseId);
            // Navigate back to group after successful deletion
            navigationService.goToGroup(groupId!);
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
            navigator
                .share({
                    title: `${t('pages.expenseDetailPage.expenseLabel')}${expense.value?.description}`,
                    text: `${t('pages.expenseDetailPage.checkOutExpense')}${expense.value?.description} - ${
                        formatCurrency(expense.value?.amount ?? '0', toCurrencyISOCode(expense.value?.currency || 'USD'))
                    }`,
                    url: url,
                })
                .catch((error) => {
                    // Fallback to clipboard if share fails
                    logError(t('pages.expenseDetailPage.shareApiFailed'), error);
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
        } catch (error) {
            logError(t('pages.expenseDetailPage.failedToCopy'), error);
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
                <div className='min-h-screen p-4'>
                    <LoadingSpinner size='lg' />
                </div>
            </BaseLayout>
        );
    }

    if (error.value || !expense.value) {
        return (
            <BaseLayout>
                <div className='min-h-screen p-4'>
                    <Card className='max-w-md mx-auto mt-8' data-testid='expense-error-card'>
                        <Stack spacing='md'>
                            <Typography variant='heading' className='text-semantic-error' role='alert' data-testid='page-error-title'>
                                {t('pages.expenseDetailPage.error')}
                            </Typography>
                            <p className='text-text-muted'>{error.value || t('pages.expenseDetailPage.expenseNotFound')}</p>
                            <Button onClick={handleBack}>{t('pages.expenseDetailPage.backToGroup')}</Button>
                        </Stack>
                    </Card>
                </div>
            </BaseLayout>
        );
    }

    const payer = memberMap.value[expense.value.paidBy];
    if (!payer) {
        throw new Error(`ExpenseDetailPage: payer ${expense.value.paidBy} not found`);
    }
    const payerName = getGroupDisplayName(payer);

    return (
        <BaseLayout
            title={`${truncateDescription(expense.value.description)}${t('pages.expenseDetailPage.titleSeparator')}${formatCurrency(expense.value.amount, toCurrencyISOCode(expense.value.currency))}`}
            description={`${t('pages.expenseDetailPage.expenseFor')}${expense.value.description}${t('pages.expenseDetailPage.titleSeparator')}${
                formatCurrency(expense.value.amount, toCurrencyISOCode(expense.value.currency))
            }`}
            headerVariant='dashboard'
        >
            <div className='min-h-screen'>
                {/* Content */}
                <div className='max-w-3xl mx-auto px-4 py-6'>
                    <Stack spacing='md'>
                        {/* Lock Warning Banner */}
                        {expense.value.isLocked && (
                            <div className='bg-surface-warning border border-border-warning rounded-lg p-4' data-testid='expense-lock-warning'>
                                <div className='flex items-start gap-3'>
                                    <span className='text-2xl'>⚠️</span>
                                    <div>
                                        <p className='font-semibold text-text-primary'>
                                            {t('pages.expenseDetailPage.cannotEdit')}
                                        </p>
                                        <p className='text-sm text-text-muted mt-1'>
                                            {t('pages.expenseDetailPage.containsDepartedMembers')}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Consolidated Top Card - Main Info, Paid By, Actions, and Metadata */}
                        <Card variant='glass' className='border-border-default' data-testid='expense-summary-card'>
                            <Stack spacing='lg'>
                                {/* Back Button */}
                                <div className='flex items-center'>
                                    <Button variant='ghost' onClick={handleBack}>
                                        {t('pages.expenseDetailPage.backButton')}
                                    </Button>
                                </div>

                                {/* Top Section - Amount & Description */}
                                <div className='text-center pb-4 border-b border-border-default' data-testid='expense-amount-section'>
                                    <h2 className='text-3xl font-bold text-text-primary' data-testid='expense-amount'>
                                        <CurrencyAmount amount={expense.value.amount} currency={expense.value.currency} />
                                    </h2>
                                    <p className='text-lg text-text-primary/80 mt-2'>{expense.value.description}</p>
                                </div>

                                {/* Middle Section - Key Details Grid */}
                                <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
                                    {/* Date */}
                                    <div>
                                        <p className='text-sm text-text-primary/60'>{t('pages.expenseDetailPage.date')}</p>
                                        <p className='font-medium text-text-primary'>{formatExpenseDateTime(expense.value.date)}</p>
                                        <p className='text-sm text-text-primary/60 mt-1'>
                                            ({formatDistanceToNow(new Date(expense.value.date))})
                                        </p>
                                    </div>

                                    {/* Label */}
                                    <div>
                                        <p className='text-sm text-text-primary/60'>{t('pages.expenseDetailPage.label')}</p>
                                        <p className='font-medium text-text-primary'>{expense.value.label}</p>
                                    </div>

                                    {/* Paid By */}
                                    <div>
                                        <p className='text-sm text-text-primary/60 mb-2'>{t('pages.expenseDetailPage.paidBy')}</p>
                                        <div className='flex items-center gap-2'>
                                            <Avatar displayName={payerName} userId={expense.value.paidBy} size='sm' />
                                            <div>
                                                <p className='font-medium text-text-primary text-sm'>{payerName}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Actions Section */}
                                <div className='pt-4 border-t border-border-default'>
                                    <ExpenseActions expense={expense.value} onEdit={handleEdit} onDelete={handleDelete} onShare={handleShare} onCopy={handleCopy} disabled={expense.value.isLocked} />
                                </div>
                            </Stack>
                        </Card>

                        {/* Split Information - Kept Separate */}
                        <Card variant='glass' className='border-border-default' data-testid='expense-split-card'>
                            <SplitBreakdown expense={expense.value} members={members.value} />
                        </Card>

                        {/* Comments Section */}
                        <Card variant='glass' className='border-border-default' data-testid='expense-comments-card'>
                            <Stack spacing='md'>
                                <h3 className='font-semibold text-text-primary'>{t('pages.expenseDetailPage.discussion')}</h3>
                                <CommentsSection target={{ type: 'expense', expenseId: expenseId! }} maxHeight='300px' />
                            </Stack>
                        </Card>

                        {/* Receipt - Kept Separate */}
                        {expense.value.receiptUrl && (
                            <Card variant='glass' className='border-border-default' data-testid='expense-receipt-card'>
                                <Stack spacing='md'>
                                    <h3 className='font-semibold text-text-primary'>{t('pages.expenseDetailPage.receipt')}</h3>
                                    <div className='text-center'>
                                        <Clickable
                                            onClick={() => setShowReceiptModal(true)}
                                            aria-label='View receipt in full size'
                                            eventName='receipt_view'
                                            eventProps={{ expenseId }}
                                        >
                                            <img
                                                src={expense.value.receiptUrl}
                                                alt='Receipt'
                                                className='max-w-full h-auto rounded-lg shadow-md mx-auto max-h-96 object-contain cursor-pointer hover:opacity-90 transition-opacity'
                                                loading='lazy'
                                            />
                                        </Clickable>
                                        <p className='text-sm text-text-muted mt-2'>{t('pages.expenseDetailPage.clickToViewFullSize')}</p>
                                    </div>
                                </Stack>
                            </Card>
                        )}

                        {/* Metadata - Moved to Bottom */}
                        <Card variant='glass' className='border-border-default' data-testid='expense-metadata-card'>
                            <div className='text-sm text-text-primary/60'>
                                <div className='flex items-center justify-between'>
                                    <span>
                                        {t('pages.expenseDetailPage.added')}
                                        {formatDistanceToNow(new Date(expense.value.createdAt))}
                                    </span>
                                    <span className='text-xs'>{formatLocalDateTime(expense.value.createdAt)}</span>
                                </div>
                                {expense.value.updatedAt !== expense.value.createdAt && (
                                    <div className='flex items-center justify-between mt-1'>
                                        <span>
                                            {t('pages.expenseDetailPage.lastUpdated')}
                                            {formatDistanceToNow(new Date(expense.value.updatedAt))}
                                        </span>
                                        <span className='text-xs'>{formatLocalDateTime(expense.value.updatedAt)}</span>
                                    </div>
                                )}
                            </div>
                        </Card>
                    </Stack>
                </div>

                {/* Receipt Modal */}
                {showReceiptModal && expense.value?.receiptUrl && (
                    <div
                        className='fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4'
                        onClick={() => setShowReceiptModal(false)}
                        role='dialog'
                        aria-modal='true'
                        aria-label={t('pages.expenseDetailPage.receiptViewer')}
                        onKeyDown={(e) => {
                            if (e.key === 'Escape') {
                                setShowReceiptModal(false);
                            }
                        }}
                        tabIndex={-1}
                    >
                        <div className='relative max-w-4xl max-h-full'>
                            <Tooltip content={t('pages.expenseDetailPage.closeReceiptViewer')} className='absolute top-2 right-2 z-10'>
                                <Clickable
                                    as='button'
                                    type='button'
                                    onClick={() => setShowReceiptModal(false)}
                                    className='bg-black bg-opacity-50 text-text-inverted rounded-full p-2 hover:bg-opacity-75 transition-all focus:outline-none focus:ring-2 focus:ring-text-inverted'
                                    aria-label={t('pages.expenseDetailPage.closeReceiptViewer')}
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
                                    alt={t('pages.expenseDetailPage.receiptFullSize')}
                                    className='max-w-full max-h-full object-contain rounded-lg'
                                />
                            </Clickable>
                        </div>
                    </div>
                )}
            </div>
        </BaseLayout>
    );
}
