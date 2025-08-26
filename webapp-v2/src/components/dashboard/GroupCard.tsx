import { Group, groupSize } from '@splitifyd/shared';
import { Card } from '../ui';
import { formatCurrency } from '@/utils/currency';
import { useTranslation } from 'react-i18next';

interface GroupCardProps {
    group: Group;
    onClick: () => void;
    onInvite?: (groupId: string) => void;
    onAddExpense?: (groupId: string) => void;
}

export function GroupCard({ group, onClick, onInvite, onAddExpense }: GroupCardProps) {
    const { t } = useTranslation();
    // Get all currency balances
    const currencyBalances = group.balance?.balancesByCurrency || {};

    // Determine balance display for currencies
    const getBalanceDisplay = (balance: number, currency: string) => {
        const absBalance = Math.abs(balance);

        if (absBalance < 0.01) {
            return {
                text: t('groupCard.settledUp'),
                color: 'text-blue-400',
                bgColor: 'bg-blue-50',
            };
        } else if (balance > 0) {
            return {
                text: t('groupCard.youreOwed', { amount: formatCurrency(absBalance, currency) }),
                color: 'text-green-600',
                bgColor: 'bg-green-50',
            };
        } else {
            return {
                text: t('groupCard.youOwe', { amount: formatCurrency(absBalance, currency) }),
                color: 'text-red-600',
                bgColor: 'bg-red-50',
            };
        }
    };

    // Create balance displays for all currencies
    const balanceDisplays = Object.values(currencyBalances).map((balance) => getBalanceDisplay(balance.netBalance, balance.currency));

    // Determine overall status color (prioritize owed > owing > settled)
    // const hasOwed = Object.values(currencyBalances).some((b) => b.netBalance < 0);
    // const hasOwing = Object.values(currencyBalances).some((b) => b.netBalance > 0);
    // const overallColor = hasOwed ? 'text-red-600' : hasOwing ? 'text-green-600' : 'text-blue-400';
    // const overallBgColor = hasOwed ? 'bg-red-50' : hasOwing ? 'bg-green-50' : 'bg-blue-50';

    const handleActionClick = (e: Event, action: () => void) => {
        e.preventDefault();
        e.stopPropagation();
        action();
    };

    return (
        <Card onClick={onClick} className="hover:shadow-md transition-all hover:-translate-y-0.5 cursor-pointer border-gray-200 h-full flex flex-col group" padding="md" data-testid="group-card">
            <div class="flex-1 relative">
                {/* Action buttons - positioned absolutely in top right */}
                {(onInvite || onAddExpense) && (
                    <div class="absolute top-0 right-0 flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        {onAddExpense && (
                            <button
                                onClick={(e) => handleActionClick(e, () => onAddExpense(group.id))}
                                class="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-full transition-colors"
                                title={t('groupCard.addExpenseTooltip', { groupName: group.name })}
                                aria-label={t('groupCard.addExpenseTooltip', { groupName: group.name })}
                            >
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                </svg>
                            </button>
                        )}
                        {onInvite && (
                            <button
                                onClick={(e) => handleActionClick(e, () => onInvite(group.id))}
                                class="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-full transition-colors"
                                title={t('groupCard.inviteTooltip', { groupName: group.name })}
                                aria-label={t('groupCard.inviteTooltip', { groupName: group.name })}
                            >
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                                </svg>
                            </button>
                        )}
                    </div>
                )}

                {/* Group header */}
                <div class="mb-3 pr-12">
                    <h4 class="font-semibold text-gray-900 text-lg mb-1">{group.name}</h4>
                    {balanceDisplays.length === 0 ? (
                        // No balances - show settled up
                        <div class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-400">{t('groupCard.settledUp')}</div>
                    ) : balanceDisplays.length > 1 ? (
                        // Multiple currencies - show each balance
                        <div class="space-y-1">
                            {balanceDisplays.map((display, index) => (
                                <div key={index} class={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${display.bgColor} ${display.color} mr-2`}>
                                    {display.text}
                                </div>
                            ))}
                        </div>
                    ) : (
                        // Single currency
                        <div class={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${balanceDisplays[0].bgColor} ${balanceDisplays[0].color}`}>{balanceDisplays[0].text}</div>
                    )}
                </div>

                {/* Group stats */}
                <div class="space-y-2 text-sm text-gray-600">
                    <div class="flex items-center">
                        <svg class="w-4 h-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                            />
                        </svg>
                        {groupSize(group)} {groupSize(group) !== 1 ? t('groupCard.members') : t('groupCard.member')}
                    </div>
                    <div class="flex items-center">
                        <svg class="w-4 h-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {group.lastActivity || t('groupCard.noRecentActivity')}
                    </div>
                </div>
            </div>
        </Card>
    );
}
