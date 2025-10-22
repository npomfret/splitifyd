import { formatCurrency } from '@/utils/currency';
import { absAmount, amountToSmallestUnit, GroupDTO } from '@splitifyd/shared';
import { useTranslation } from 'react-i18next';
import { Card, Tooltip } from '../ui';

interface GroupCardProps {
    group: GroupDTO;
    onClick: () => void;
    onInvite?: (groupId: string) => void;
    onAddExpense?: (groupId: string) => void;
}

export function GroupCard({ group, onClick, onInvite, onAddExpense }: GroupCardProps) {
    const { t } = useTranslation();

    // Calculate balance display based on group balance data
    const calculateBalanceDisplay = () => {
        if (!group.balance?.balancesByCurrency) {
            return {
                text: t('groupCard.settledUp'),
                color: 'text-blue-400',
                bgColor: 'bg-blue-50',
            };
        }

        // Get all currency balances - display the first non-zero balance, or first balance if all zero
        const currencies = Object.keys(group.balance.balancesByCurrency);
        if (currencies.length === 0) {
            return {
                text: t('groupCard.settledUp'),
                color: 'text-blue-400',
                bgColor: 'bg-blue-50',
            };
        }

        // Find first non-zero balance, or use first currency if all are zero
        let balance = group.balance.balancesByCurrency[currencies[0]];
        for (const currency of currencies) {
            const currencyBalance = group.balance.balancesByCurrency[currency];
            if (amountToSmallestUnit(currencyBalance.netBalance, currencyBalance.currency) !== 0) {
                balance = currencyBalance;
                break;
            }
        }

        if (!balance || amountToSmallestUnit(balance.netBalance, balance.currency) === 0) {
            return {
                text: t('groupCard.settledUp'),
                color: 'text-blue-400',
                bgColor: 'bg-blue-50',
            };
        }

        const netBalanceUnits = amountToSmallestUnit(balance.netBalance, balance.currency);

        if (netBalanceUnits > 0) {
            // User is owed money
            return {
                text: t('dashboard.groupCard.youAreOwed', { amount: formatCurrency(balance.netBalance, balance.currency) }),
                color: 'text-green-600',
                bgColor: 'bg-green-50',
            };
        } else {
            // User owes money
            return {
                text: t('dashboard.groupCard.youOwe', { amount: formatCurrency(absAmount(balance.netBalance, balance.currency), balance.currency) }),
                color: 'text-red-600',
                bgColor: 'bg-red-50',
            };
        }
    };

    const balanceDisplay = calculateBalanceDisplay();

    const handleActionClick = (e: Event, action: () => void) => {
        e.preventDefault();
        e.stopPropagation();
        action();
    };

    return (
        <Card onClick={onClick} className='hover:shadow-md transition-all hover:-translate-y-0.5 cursor-pointer border-gray-200 h-full flex flex-col group' padding='md' data-testid='group-card'>
            <div class='flex-1 relative'>
                {/* Action buttons - positioned absolutely in top right */}
                {(onInvite || onAddExpense) && (
                    <div class='absolute top-0 right-0 flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200'>
                        {onAddExpense && (
                            <Tooltip content={t('groupCard.addExpenseTooltip', { groupName: group.name })}>
                                <button
                                    onClick={(e) => handleActionClick(e, () => onAddExpense(group.id))}
                                    class='p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-full transition-colors'
                                    aria-label={t('groupCard.addExpenseTooltip', { groupName: group.name })}
                                >
                                    <svg class='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24' aria-hidden='true' focusable='false'>
                                        <path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M12 6v6m0 0v6m0-6h6m-6 0H6' />
                                    </svg>
                                </button>
                            </Tooltip>
                        )}
                        {onInvite && (
                            <Tooltip content={t('groupCard.inviteTooltip', { groupName: group.name })}>
                                <button
                                    onClick={(e) => handleActionClick(e, () => onInvite(group.id))}
                                    class='p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-full transition-colors'
                                    aria-label={t('groupCard.inviteTooltip', { groupName: group.name })}
                                >
                                    <svg class='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24' aria-hidden='true' focusable='false'>
                                        <path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z' />
                                    </svg>
                                </button>
                            </Tooltip>
                        )}
                    </div>
                )}

                {/* GroupDTO header */}
                <div class='mb-3 pr-12'>
                    <h4 class='font-semibold text-gray-900 text-lg mb-1'>{group.name}</h4>
                    <div class={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${balanceDisplay.bgColor} ${balanceDisplay.color}`} data-financial-amount='balance'>
                        {balanceDisplay.text}
                    </div>
                </div>

                {/* GroupDTO stats */}
                <div class='space-y-2 text-sm text-gray-600'>
                    <div class='flex items-center'>
                        <svg class='w-4 h-4 mr-2 text-gray-400' fill='none' stroke='currentColor' viewBox='0 0 24 24' aria-hidden='true' focusable='false'>
                            <path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' />
                        </svg>
                        {group.lastActivity || t('groupCard.noRecentActivity')}
                    </div>
                </div>
            </div>
        </Card>
    );
}
