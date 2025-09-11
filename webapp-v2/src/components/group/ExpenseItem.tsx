import { useMemo } from 'preact/hooks';
import { formatDistanceToNow, formatExpenseDateTime } from '@/utils/dateUtils.ts';
import type { ExpenseData, RegisteredUser } from '@splitifyd/shared';
import { DELETED_AT_FIELD } from '@splitifyd/shared';
import { formatCurrency } from '@/utils/currency';
import { Avatar } from '../ui/Avatar';
import { themeStore } from '@/app/stores/theme-store.ts';
import { useTranslation } from 'react-i18next';

interface ExpenseItemProps {
    expense: ExpenseData;
    members: RegisteredUser[];
    onClick?: (expense: ExpenseData) => void;
    onCopy?: (expense: ExpenseData) => void;
}

export function ExpenseItem({ expense, members, onClick, onCopy }: ExpenseItemProps) {
    const { t } = useTranslation();
    const paidByUser = members.find((m) => m.uid === expense.paidBy);
    const isDeleted = expense[DELETED_AT_FIELD] !== null && expense[DELETED_AT_FIELD] !== undefined;
    const deletedByUser = expense.deletedBy ? members.find((m) => m.uid === expense.deletedBy) : null;

    // Get theme colors for the payer
    const paidByTheme = paidByUser?.themeColor || themeStore.getThemeForUser(expense.paidBy);
    const isDark = themeStore.isDarkMode;
    const themeColor = paidByTheme ? (isDark ? paidByTheme.dark : paidByTheme.light) : '#6B7280';

    // Memoize the formatted currency to avoid recalculation on every render
    const formattedAmount = useMemo(() => formatCurrency(expense.amount, expense.currency), [expense.amount, expense.currency]);

    const handleCopyClick = (e: Event) => {
        e.stopPropagation(); // Prevent expense detail navigation
        onCopy?.(expense);
    };

    return (
        <div
            className={`border-b last:border-0 pb-3 last:pb-0 cursor-pointer hover:bg-gray-50 -mx-2 px-2 py-2 rounded relative group ${isDeleted ? 'opacity-60 bg-gray-50' : ''}`}
            style={{
                borderLeftWidth: '4px',
                borderLeftColor: isDeleted ? '#9CA3AF' : themeColor,
                backgroundColor: isDeleted ? '' : `${themeColor}08`, // Very light background
            }}
            onClick={() => onClick?.(expense)}
        >
            <div className="flex justify-between items-start">
                <div className="flex-1">
                    <div className="flex items-center gap-3">
                        {/* User avatar */}
                        <Avatar displayName={paidByUser?.displayName || 'Unknown'} userId={expense.paidBy} size="sm" themeColor={paidByUser?.themeColor} />

                        <div className="flex-1">
                            <div className="flex items-center gap-2">
                                <p className={`font-medium ${isDeleted ? 'line-through text-gray-500' : ''}`}>{expense.description}</p>
                                {isDeleted && (
                                    <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded" data-testid="deleted-badge">
                                        {t('expenseItem.deleted')}
                                    </span>
                                )}
                            </div>
                            <p className="text-sm text-gray-600">
                                {t('expenseItem.paidBy')}{' '}
                                <span className="font-medium" style={{ color: isDeleted ? '' : themeColor }}>
                                    {paidByUser?.displayName || 'Unknown'}
                                </span>{' '}
                                • {formatExpenseDateTime(expense.date)}
                                {isDeleted && expense.deletedAt && (
                                    <span className="ml-2 text-red-600">
                                        • {t('expenseItem.deletedBy')} {deletedByUser?.displayName || 'Unknown'} {formatDistanceToNow(new Date(expense.deletedAt))}
                                    </span>
                                )}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="text-right ml-4 flex items-start gap-2">
                    <div>
                        <p className={`font-semibold ${isDeleted ? 'text-gray-500' : ''}`}>{formattedAmount}</p>
                        <p className="text-xs text-gray-500">{expense.category}</p>

                        {/* Theme color indicator dot */}
                        {!isDeleted && paidByTheme && (
                            <div className="w-2 h-2 rounded-full mt-1 ml-auto" style={{ backgroundColor: themeColor }} title={`${paidByUser?.displayName || 'Unknown'} (${paidByTheme.name})`} />
                        )}
                    </div>

                    {/* Copy button - only show if not deleted and onCopy is provided */}
                    {!isDeleted && onCopy && (
                        <button
                            onClick={handleCopyClick}
                            className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-1 hover:bg-gray-200 rounded text-gray-600 hover:text-gray-800"
                            title={t('expenseItem.copyExpense')}
                            aria-label={t('expenseItem.copyExpense')}
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                                />
                            </svg>
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
