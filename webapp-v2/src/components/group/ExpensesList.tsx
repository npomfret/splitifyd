import { useAuthRequired } from '@/app/hooks/useAuthRequired';
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
}

export function ExpensesList({ onExpenseClick, onExpenseCopy, showDeletedExpenses = false, onShowDeletedChange }: ExpensesListProps) {
    const { t } = useTranslation();

    // Auth store via hook
    const authStore = useAuthRequired();

    // Fetch data directly from stores
    const expenses = useComputed(() => enhancedGroupDetailStore.expenses);
    const members = useComputed(() => enhancedGroupDetailStore.members);
    const hasMore = useComputed(() => enhancedGroupDetailStore.hasMoreExpenses);
    const loading = useComputed(() => enhancedGroupDetailStore.loadingExpenses);
    const group = useComputed(() => enhancedGroupDetailStore.group);
    const currentUser = useComputed(() => authStore.user);

    const isGroupOwner = useComputed(() => currentUser.value && group.value && group.value.createdBy === currentUser.value.uid);

    const handleLoadMore = () => {
        enhancedGroupDetailStore.loadMoreExpenses();
    };

    return (
        <Card className='p-6'>
            <div className='flex justify-between items-center mb-4'>
                <h2 className='text-lg font-semibold'>{t('expensesList.title')}</h2>
                {isGroupOwner.value && onShowDeletedChange && (
                    <label className='flex items-center space-x-2 text-sm'>
                        <input type='checkbox' checked={showDeletedExpenses} onChange={(e) => onShowDeletedChange(e.currentTarget.checked)} className='rounded' autoComplete='off' />
                        <span>{t('expensesList.showDeletedExpenses')}</span>
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
