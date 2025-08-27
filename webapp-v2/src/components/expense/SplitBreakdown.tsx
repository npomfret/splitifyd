import { Avatar } from '../ui/Avatar';
import { Stack } from '../ui/Stack';
import type { ExpenseData, User } from '@splitifyd/shared';
import { SplitTypes } from '@splitifyd/shared';

interface SplitBreakdownProps {
    expense: ExpenseData;
    members: User[];
}

export function SplitBreakdown({ expense, members }: SplitBreakdownProps) {
    const memberMap = members.reduce(
        (acc, member) => {
            acc[member.uid] = member;
            return acc;
        },
        {} as Record<string, User>,
    );

    const getSplitTypeLabel = (type: string) => {
        switch (type) {
            case SplitTypes.EQUAL:
                return 'Split Equally';
            case SplitTypes.EXACT:
                return 'Exact Amounts';
            case SplitTypes.PERCENTAGE:
                return 'By Percentage';
            default:
                return 'Custom Split';
        }
    };

    const getSplitTypeBadgeColor = (type: string) => {
        switch (type) {
            case SplitTypes.EQUAL:
                return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
            case SplitTypes.EXACT:
                return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300';
            case SplitTypes.PERCENTAGE:
                return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
            default:
                return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300';
        }
    };

    return (
        <Stack spacing="md">
            <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900 dark:text-white">
                    Split between {expense.participants.length} {expense.participants.length === 1 ? 'person' : 'people'}
                </h3>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getSplitTypeBadgeColor(expense.splitType)}`}>{getSplitTypeLabel(expense.splitType)}</span>
            </div>

            <div className="space-y-3">
                {expense.splits.map((split) => {
                    const member = memberMap[split.userId];
                    const percentage = (split.amount / expense.amount) * 100;
                    const isPayer = expense.paidBy === split.userId;
                    const owesAmount = isPayer ? 0 : split.amount;
                    const isOwing = owesAmount > 0;

                    return (
                        <div key={split.userId} className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-3">
                                    <div className="relative">
                                        <Avatar displayName={member?.displayName || 'Unknown'} userId={split.userId} size="md" />
                                        {isPayer && (
                                            <div className="absolute -bottom-1 -right-1 bg-green-500 text-white rounded-full p-0.5">
                                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                                    <path
                                                        fillRule="evenodd"
                                                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.293l-3-3a1 1 0 00-1.414 1.414L10.586 9.5 8.707 7.621a1 1 0 00-1.414 1.414l2.5 2.5a1 1 0 001.414 0l4-4a1 1 0 000-1.414z"
                                                        clipRule="evenodd"
                                                    />
                                                </svg>
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <p className="font-medium text-gray-900 dark:text-white">{member?.displayName || 'Unknown'}</p>
                                        {isPayer && <p className="text-xs text-green-600 dark:text-green-400">Paid</p>}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className={`font-semibold ${isOwing ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`} data-financial-amount="split">${split.amount.toFixed(2)}</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">{percentage.toFixed(1)}%</p>
                                </div>
                            </div>

                            <div className="mt-3">
                                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                                    <div
                                        className={`h-full transition-all duration-300 ${isPayer ? 'bg-green-500 dark:bg-green-400' : 'bg-red-500 dark:bg-red-400'}`}
                                        style={{ width: `${percentage}%` }}
                                    />
                                </div>
                                {isOwing && <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Owes {memberMap[expense.paidBy]?.displayName || 'Unknown'}</p>}
                            </div>
                        </div>
                    );
                })}
            </div>

            {expense.splitType === SplitTypes.PERCENTAGE && (
                <div className="mt-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                    <p className="text-sm text-yellow-800 dark:text-yellow-200">Total: {expense.splits.reduce((sum, s) => sum + (s.amount / expense.amount) * 100, 0).toFixed(1)}%</p>
                </div>
            )}
        </Stack>
    );
}
