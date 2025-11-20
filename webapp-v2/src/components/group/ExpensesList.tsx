import { enhancedGroupDetailStore } from '@/app/stores/group-detail-store-enhanced';
import type { ExpenseDTO } from '@billsplit-wl/shared';
import { useComputed } from '@preact/signals';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Checkbox } from '../ui/Checkbox';
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
            {expenses.value.length === 0 ? <p className='text-text-muted'>{t('expensesList.noExpensesYet')}</p> : (
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
