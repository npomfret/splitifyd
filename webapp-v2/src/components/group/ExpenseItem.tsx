import { useMemo } from 'preact/hooks';
import { formatDistanceToNow, formatExpenseDateTime } from '../../utils/dateUtils';
import type { ExpenseData, User } from '../../../../firebase/functions/src/shared/shared-types';
import { DELETED_AT_FIELD } from '../../../../firebase/functions/src/shared/shared-types';
import { formatCurrency } from '../../utils/currency';
import { Avatar } from '../ui/Avatar';
import { themeStore } from '../../app/stores/theme-store';

interface ExpenseItemProps {
  expense: ExpenseData;
  members: User[];
  onClick?: (expense: ExpenseData) => void;
}

export function ExpenseItem({ expense, members, onClick }: ExpenseItemProps) {
  const paidByUser = members.find(m => m.uid === expense.paidBy);
  const isDeleted = expense[DELETED_AT_FIELD] !== null && expense[DELETED_AT_FIELD] !== undefined;
  const deletedByUser = expense.deletedBy ? members.find(m => m.uid === expense.deletedBy) : null;
  
  // Get theme colors for the payer
  const paidByTheme = paidByUser?.themeColor || themeStore.getThemeForUser(expense.paidBy);
  const isDark = themeStore.isDarkMode;
  const themeColor = paidByTheme ? (isDark ? paidByTheme.dark : paidByTheme.light) : '#6B7280';
  
  // Memoize the formatted currency to avoid recalculation on every render
  const formattedAmount = useMemo(
    () => formatCurrency(expense.amount, expense.currency),
    [expense.amount, expense.currency]
  );
  
  return (
    <div 
      className={`border-b last:border-0 pb-3 last:pb-0 cursor-pointer hover:bg-gray-50 -mx-2 px-2 py-2 rounded relative ${
        isDeleted ? 'opacity-60 bg-gray-50' : ''
      }`}
      style={{
        borderLeftWidth: '4px',
        borderLeftColor: isDeleted ? '#9CA3AF' : themeColor,
        backgroundColor: isDeleted ? '' : `${themeColor}08` // Very light background
      }}
      onClick={() => onClick?.(expense)}
    >
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <div className="flex items-center gap-3">
            {/* User avatar */}
            <Avatar
              displayName={paidByUser?.displayName || 'Unknown'}
              userId={expense.paidBy}
              size="sm"
              themeColor={paidByUser?.themeColor}
            />
            
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className={`font-medium ${isDeleted ? 'line-through text-gray-500' : ''}`}>
                  {expense.description}
                </p>
                {isDeleted && (
                  <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">
                    Deleted
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-600">
                Paid by <span className="font-medium" style={{ color: isDeleted ? '' : themeColor }}>
                  {paidByUser?.displayName || 'Unknown'}
                </span> • {formatExpenseDateTime(expense.date)}
                {isDeleted && expense.deletedAt && (
                  <span className="ml-2 text-red-600">
                    • Deleted by {deletedByUser?.displayName || 'Unknown'} {formatDistanceToNow(new Date(expense.deletedAt))}
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>
        
        <div className="text-right ml-4">
          <p className={`font-semibold ${isDeleted ? 'text-gray-500' : ''}`}>
            {formattedAmount}
          </p>
          <p className="text-xs text-gray-500">{expense.category}</p>
          
          {/* Theme color indicator dot */}
          {!isDeleted && paidByTheme && (
            <div 
              className="w-2 h-2 rounded-full mt-1 ml-auto"
              style={{ backgroundColor: themeColor }}
              title={`${paidByUser?.displayName || 'Unknown'} (${paidByTheme.name})`}
            />
          )}
        </div>
      </div>
    </div>
  );
}