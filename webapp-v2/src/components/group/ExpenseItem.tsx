import { formatDistanceToNow } from '../../utils/dateUtils';
import type { ExpenseData, User } from '@shared/types/webapp-shared-types';

interface ExpenseItemProps {
  expense: ExpenseData;
  members: User[];
  onClick?: (expense: ExpenseData) => void;
}

export function ExpenseItem({ expense, members, onClick }: ExpenseItemProps) {
  const paidByUser = members.find(m => m.uid === expense.paidBy);
  return (
    <div 
      className="border-b last:border-0 pb-3 last:pb-0 cursor-pointer hover:bg-gray-50 -mx-2 px-2 py-2 rounded"
      onClick={() => onClick?.(expense)}
    >
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <p className="font-medium">{expense.description}</p>
          <p className="text-sm text-gray-600">
            Paid by {paidByUser?.displayName || 'Unknown'} • {formatDistanceToNow(new Date(expense.date))}
          </p>
        </div>
        <div className="text-right">
          <p className="font-semibold">${expense.amount.toFixed(2)}</p>
          <p className="text-xs text-gray-500">{expense.category}</p>
        </div>
      </div>
    </div>
  );
}