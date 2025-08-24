import { Card } from '../ui/Card';
import { Stack } from '../ui/Stack';
import { Button } from '../ui/Button';
import { ExpenseItem } from './ExpenseItem';
import type { ExpenseData, User } from '@shared/shared-types.ts';
import { useTranslation } from 'react-i18next';

interface ExpensesListProps {
    expenses: ExpenseData[];
    members: User[];
    hasMore: boolean;
    loading: boolean;
    onLoadMore: () => void;
    onExpenseClick?: (expense: ExpenseData) => void;
    onExpenseCopy?: (expense: ExpenseData) => void;
    isGroupOwner?: boolean;
    showDeletedExpenses?: boolean;
    onShowDeletedChange?: (show: boolean) => void;
}

export function ExpensesList({
    expenses,
    members,
    hasMore,
    loading,
    onLoadMore,
    onExpenseClick,
    onExpenseCopy,
    isGroupOwner = false,
    showDeletedExpenses = false,
    onShowDeletedChange,
}: ExpensesListProps) {
    const { t } = useTranslation();
    return (
        <Card className="p-6">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">{t('expensesList.title')}</h2>
                {isGroupOwner && onShowDeletedChange && (
                    <label className="flex items-center space-x-2 text-sm">
                        <input type="checkbox" checked={showDeletedExpenses} onChange={(e) => onShowDeletedChange(e.currentTarget.checked)} className="rounded" />
                        <span>{t('expensesList.showDeletedExpenses')}</span>
                    </label>
                )}
            </div>
            {expenses.length === 0 ? (
                <p className="text-gray-600">{t('expensesList.noExpensesYet')}</p>
            ) : (
                <Stack spacing="md">
                    {expenses.map((expense) => (
                        <ExpenseItem key={expense.id} expense={expense} members={members} onClick={onExpenseClick} onCopy={onExpenseCopy} />
                    ))}

                    {hasMore && (
                        <Button variant="ghost" onClick={onLoadMore} disabled={loading} className="w-full">
                            {loading ? t('common.loading') : t('expensesList.loadMore')}
                        </Button>
                    )}
                </Stack>
            )}
        </Card>
    );
}
