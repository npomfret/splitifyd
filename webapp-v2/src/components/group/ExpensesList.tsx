import { useStaggeredReveal } from '@/app/hooks/useScrollReveal';
import { enhancedGroupDetailStore } from '@/app/stores/group-detail-store-enhanced';
import { EmptyState, ListStateRenderer } from '@/components/ui';
import type { ExpenseDTO } from '@billsplit-wl/shared';
import { ReceiptPercentIcon } from '@heroicons/react/24/outline';
import { useComputed } from '@preact/signals';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/Button';
import { Checkbox } from '../ui/Checkbox';
import { SkeletonExpenseItem } from '../ui/Skeleton';
import { Stack } from '../ui/Stack';
import { ExpenseItem } from './ExpenseItem';

interface ExpensesListProps {
    onExpenseClick?: (expense: ExpenseDTO) => void;
    onExpenseCopy?: (expense: ExpenseDTO) => void;
    showDeletedExpenses?: boolean;
    onShowDeletedChange?: (show: boolean) => void;
    canToggleShowDeleted?: boolean;
}

export function ExpensesList({
    onExpenseClick,
    onExpenseCopy,
    showDeletedExpenses = false,
    onShowDeletedChange,
    canToggleShowDeleted = false,
}: ExpensesListProps) {
    const { t } = useTranslation();

    // Fetch data directly from stores
    const expenses = useComputed(() => enhancedGroupDetailStore.expenses);
    const members = useComputed(() => enhancedGroupDetailStore.members);
    const hasMore = useComputed(() => enhancedGroupDetailStore.hasMoreExpenses);
    const loading = useComputed(() => enhancedGroupDetailStore.loadingExpenses);

    // Staggered reveal animation for expense items
    const { ref: listRef, visibleIndices } = useStaggeredReveal(expenses.value.length, 50);

    const handleLoadMore = () => {
        enhancedGroupDetailStore.loadMoreExpenses();
    };

    return (
        <div>
            <ListStateRenderer
                state={{
                    loading: loading.value,
                    items: expenses.value,
                }}
                renderLoading={() => (
                    <div className='space-y-3' aria-busy='true' aria-label={t('common.loading')}>
                        <SkeletonExpenseItem />
                        <SkeletonExpenseItem />
                        <SkeletonExpenseItem />
                    </div>
                )}
                renderEmpty={() => (
                    <EmptyState
                        icon={<ReceiptPercentIcon className='w-12 h-12' aria-hidden='true' />}
                        title={t('expensesList.noExpensesYet')}
                    />
                )}
            >
                {(items) => (
                    <Stack spacing='md' ref={listRef}>
                        {items.map((expense, index) => (
                            <div
                                key={expense.id}
                                className={`fade-up ${visibleIndices.has(index) ? 'fade-up-visible' : ''}`}
                            >
                                <ExpenseItem
                                    expense={expense}
                                    members={members.value}
                                    onClick={onExpenseClick}
                                    onCopy={onExpenseCopy}
                                />
                            </div>
                        ))}

                        {hasMore.value && (
                            <Button variant='ghost' onClick={handleLoadMore} disabled={loading.value} className='w-full'>
                                {loading.value ? t('common.loading') : t('expensesList.loadMore')}
                            </Button>
                        )}
                    </Stack>
                )}
            </ListStateRenderer>

            {/* Include deleted checkbox - shown at bottom for admins/authorized users */}
            {canToggleShowDeleted && onShowDeletedChange && (
                <div className='flex justify-end mt-4'>
                    <Checkbox
                        label={t('common.includeDeleted')}
                        checked={showDeletedExpenses}
                        onChange={onShowDeletedChange}
                    />
                </div>
            )}
        </div>
    );
}
