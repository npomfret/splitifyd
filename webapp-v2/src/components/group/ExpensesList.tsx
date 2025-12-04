import { useStaggeredReveal } from '@/app/hooks/useScrollReveal';
import { enhancedGroupDetailStore } from '@/app/stores/group-detail-store-enhanced';
import type { ExpenseDTO } from '@billsplit-wl/shared';
import { useComputed } from '@preact/signals';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
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

    // Show skeleton during initial load (loading and no expenses yet)
    const isInitialLoad = loading.value && expenses.value.length === 0;

    return (
        <Card variant='glass' className='p-6 border-border-default' data-testid='expenses-list-card'>
            <div className='flex justify-between items-center mb-4'>
                <h2 className='text-lg font-semibold'>{t('expensesList.title')}</h2>
                {canToggleShowDeleted && onShowDeletedChange && (
                    <Checkbox
                        label={t('common.includeDeleted')}
                        checked={showDeletedExpenses}
                        onChange={onShowDeletedChange}
                        data-testid='include-deleted-expenses-checkbox'
                    />
                )}
            </div>

            {/* Loading skeleton */}
            {isInitialLoad ? (
                <div className='space-y-3' aria-busy='true' aria-label={t('common.loading')}>
                    <SkeletonExpenseItem />
                    <SkeletonExpenseItem />
                    <SkeletonExpenseItem />
                </div>
            ) : expenses.value.length === 0 ? <p className='text-text-muted'>{t('expensesList.noExpensesYet')}</p> : (
                <Stack spacing='md' ref={listRef}>
                    {expenses.value.map((expense, index) => (
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
        </Card>
    );
}
