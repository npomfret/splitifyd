import { Card } from '../ui/Card';
import { Stack } from '../ui/Stack';
import { Button } from '../ui/Button';
import { ExpenseItem } from './ExpenseItem';
import type { ExpenseData, User } from '@shared/types/webapp-shared-types';

interface ExpensesListProps {
  expenses: ExpenseData[];
  members: User[];
  hasMore: boolean;
  loading: boolean;
  onLoadMore: () => void;
  onExpenseClick?: (expense: ExpenseData) => void;
}

export function ExpensesList({ 
  expenses, 
  members,
  hasMore, 
  loading, 
  onLoadMore, 
  onExpenseClick 
}: ExpensesListProps) {
  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold mb-4">Expenses</h2>
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