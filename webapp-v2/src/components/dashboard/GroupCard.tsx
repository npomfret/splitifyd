import { translateGroupCardKey } from '@/app/i18n/dynamic-translations';
import { iconButton } from '@/components/ui/styles';
import { absAmount, type Amount, amountToSmallestUnit, GroupDTO, GroupId } from '@billsplit-wl/shared';
import type { JSX } from 'preact';
import { useTranslation } from 'react-i18next';
import { Badge, Card, CurrencyAmount, RelativeTime, Tooltip } from '../ui';
import { Clickable } from '../ui/Clickable';
import { ClockIcon, PlusIcon, UserAddIcon } from '../ui/icons';

interface GroupCardProps {
    group: GroupDTO;
    onClick: () => void;
    onInvite?: (groupId: GroupId) => void;
    onAddExpense?: (groupId: GroupId) => void;
    isArchivedView?: boolean;
}

export function GroupCard({ group, onClick, onInvite, onAddExpense, isArchivedView = false }: GroupCardProps) {
    const { t } = useTranslation();

    const renderBalanceMessage = (translationKey: 'youAreOwed' | 'youOwe', amount: Amount, currency: string): JSX.Element => {
        const template = translateGroupCardKey(translationKey, t, { amount: '__AMOUNT__' });

        if (!template.includes('__AMOUNT__')) {
            return (
                <>
                    {template}
                    <CurrencyAmount amount={amount} currency={currency} className='font-semibold ml-1' />
                </>
            );
        }

        const [prefix = '', suffix = ''] = template.split('__AMOUNT__');

        return (
            <>
                {prefix}
                <CurrencyAmount amount={amount} currency={currency} className='font-semibold ml-0.5' />
                {suffix}
            </>
        );
    };

    const calculateBalanceDisplay = () => {
        const settled = [{
            key: 'settled',
            content: t('groupCard.settledUp'),
            color: 'text-interactive-primary',
            icon: '✓',
        }];

        if (!group.balance?.balancesByCurrency) {
            return settled;
        }

        const balances = Object
            .values(group.balance.balancesByCurrency)
            .map((balance) => ({
                balance,
                totalUnits: amountToSmallestUnit(balance.netBalance, balance.currency),
            }))
            .filter(({ totalUnits }) => totalUnits !== 0);

        if (balances.length === 0) {
            return settled;
        }

        const positives = balances
            .filter(({ totalUnits }) => totalUnits > 0)
            .sort((a, b) => a.balance.currency.localeCompare(b.balance.currency));

        const negatives = balances
            .filter(({ totalUnits }) => totalUnits < 0)
            .sort((a, b) => a.balance.currency.localeCompare(b.balance.currency));

        const positiveDisplays = positives.map(({ balance }) => ({
            key: `owed-${balance.currency}`,
            content: renderBalanceMessage('youAreOwed', balance.netBalance, balance.currency),
            color: 'text-semantic-success',
            icon: '↑',
        }));

        const negativeDisplays = negatives.map(({ balance }) => ({
            key: `owe-${balance.currency}`,
            content: renderBalanceMessage('youOwe', absAmount(balance.netBalance, balance.currency), balance.currency),
            color: 'text-text-owed',
            icon: '↓',
        }));

        return [...positiveDisplays, ...negativeDisplays];
    };

    const balanceDisplays = calculateBalanceDisplay();

    const handleActionClick = (e: Event, action: () => void) => {
        e.preventDefault();
        e.stopPropagation();
        action();
    };

    const showQuickActions = !isArchivedView && (onInvite || onAddExpense);

    return (
        <Card
            onClick={onClick}
            variant='glass'
            className='hover:shadow-md transition-all hover:-translate-y-0.5 cursor-pointer border-border-default h-full flex flex-col group'
            padding='md'
        >
            <div className='flex-1 relative'>
                {/* Action buttons - positioned absolutely in top right */}
                {showQuickActions && (
                    <div className='absolute top-0 end-0 flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200'>
                        {onAddExpense && (
                            <Tooltip content={t('groupCard.addExpenseTooltip', { groupName: group.name })}>
                                <Clickable
                                    as='button'
                                    onClick={(e: MouseEvent) => handleActionClick(e, () => onAddExpense(group.id))}
                                    className={iconButton.ghostRounded}
                                    aria-label={t('groupCard.addExpenseTooltip', { groupName: group.name })}
                                    eventName='group_card_add_expense'
                                    eventProps={{ groupId: group.id, groupName: group.name }}
                                >
                                    <PlusIcon size={16} />
                                </Clickable>
                            </Tooltip>
                        )}
                        {onInvite && (
                            <Tooltip content={t('groupCard.inviteTooltip', { groupName: group.name })}>
                                <Clickable
                                    as='button'
                                    onClick={(e: MouseEvent) => handleActionClick(e, () => onInvite(group.id))}
                                    className={iconButton.ghostRounded}
                                    aria-label={t('groupCard.inviteTooltip', { groupName: group.name })}
                                    eventName='group_card_invite'
                                    eventProps={{ groupId: group.id, groupName: group.name }}
                                >
                                    <UserAddIcon size={16} />
                                </Clickable>
                            </Tooltip>
                        )}
                    </div>
                )}

                {/* GroupDTO header */}
                <div className='mb-3'>
                    <div className='flex items-start justify-between gap-2 pr-12'>
                        <h4 className='font-semibold text-text-primary text-lg mb-1'>{group.name}</h4>
                        {isArchivedView && (
                            <Badge variant='warning'>
                                {t('dashboard.groupCard.archivedBadge')}
                            </Badge>
                        )}
                    </div>
                    <div className='flex flex-col gap-1.5 mt-2'>
                        {balanceDisplays.map((display) => (
                            <div
                                key={display.key}
                                class={`flex items-center gap-1.5 text-sm font-medium ${display.color}`}
                                data-financial-amount='balance'
                            >
                                <span className='text-base leading-none opacity-70'>{display.icon}</span>
                                <span className='leading-tight'>{display.content}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* GroupDTO stats */}
                <div className='space-y-2 help-text'>
                    <div className='flex items-center'>
                        <ClockIcon size={16} className='mr-2 text-text-muted/80' />
                        {group.updatedAt
                            ? <RelativeTime date={group.updatedAt} fallback={group.lastActivity || t('groupCard.noRecentActivity')} />
                            : (group.lastActivity || t('groupCard.noRecentActivity'))}
                    </div>
                </div>
            </div>
        </Card>
    );
}
