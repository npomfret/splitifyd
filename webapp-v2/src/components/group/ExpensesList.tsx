import { Card } from '../ui/Card';
import { Stack } from '../ui/Stack';
import { Button } from '../ui/Button';
import { ExpenseItem } from './ExpenseItem';
import type { ExpenseData, User } from '../../../../firebase/functions/src/types/webapp-shared-types';

interface ExpensesListProps {
  expenses: ExpenseData[];
  members: User[];
  hasMore: boolean;
  loading: boolean;
  onLoadMore: () => void;
  onExpenseClick?: (expense: ExpenseData) => void;
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
  isGroupOwner = false,
  showDeletedExpenses = false,
  onShowDeletedChange
}: ExpensesListProps) {
  return (
    <Card className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">Expenses</h2>
        {isGroupOwner && onShowDeletedChange && (
          <label className="flex items-center space-x-2 text-sm">
            <input
              type="checkbox"
              checked={showDeletedExpenses}
              onChange={(e) => onShowDeletedChange(e.currentTarget.checked)}
              className="rounded"
            />
            <span>Show deleted expenses</span>
          </label>
        )}
      </div>
      {expenses.length === 0 ? (
        <p className="text-gray-600">No expenses yet. Add one to get started!</p>
      ) : (
        <Stack spacing="md">
          {expenses.map((expense) => (
            <ExpenseItem 
              key={expense.id} 
              expense={expense}
              members={members}
              onClick={onExpenseClick}
            />
          ))}
          
          {hasMore && (
            <Button
              variant="ghost"
              onClick={onLoadMore}
              disabled={loading}
              className="w-full"
            >
              {loading ? 'Loading...' : 'Load More'}
            </Button>
          )}
        </Stack>
      )}
    </Card>
  );
}