import { enhancedGroupDetailStore } from '@/app/stores/group-detail-store-enhanced';
import { useComputed } from '@preact/signals';
import type { ExpenseDTO } from '@splitifyd/shared';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
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

    const handleLoadMore = () => {
        enhancedGroupDetailStore.loadMoreExpenses();
    };

    return (
        <Card className='p-6' data-testid='expenses-list-card'>
            <div className='flex justify-between items-center mb-4'>
                <h2 className='text-lg font-semibold'>{t('expensesList.title')}</h2>
                {canToggleShowDeleted && onShowDeletedChange && (
                    <label className='flex items-center space-x-2 text-sm'>
                        <input
                            type='checkbox'
                            data-testid='include-deleted-expenses-checkbox'
                            checked={showDeletedExpenses}
                            onChange={(e) => onShowDeletedChange(e.currentTarget.checked)}
                            className='rounded'
                            autoComplete='off'
                        />
                        <span>{t('common.includeDeleted')}</span>
                    </label>
                )}
            </div>
            {expenses.value.length === 0 ? <p className='text-gray-600'>{t('expensesList.noExpensesYet')}</p> : (
                <Stack spacing='md'>
                    {expenses.value.map((expense) => <ExpenseItem key={expense.id} expense={expense} members={members.value} onClick={onExpenseClick} onCopy={onExpenseCopy} />)}

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
