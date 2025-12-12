import { CurrencyAmount, Typography } from '@/components/ui';
import { CheckCircleIcon } from '@/components/ui/icons';
import { getGroupDisplayName } from '@/utils/displayName';
import { amountToSmallestUnit, ExpenseDTO, GroupMember } from '@billsplit-wl/shared';
import { SplitTypes } from '@billsplit-wl/shared';
import { useTranslation } from 'react-i18next';
import { Avatar } from '../ui/Avatar';
import { Stack } from '../ui/Stack';

interface SplitBreakdownProps {
    expense: ExpenseDTO;
    members: GroupMember[];
}

export function SplitBreakdown({ expense, members }: SplitBreakdownProps) {
    const { t } = useTranslation();
    const memberMap = members.reduce(
        (acc, member) => {
            acc[member.uid] = member;
            return acc;
        },
        {} as Record<string, GroupMember>,
    );

    const getSplitTypeLabel = (type: string) => {
        switch (type) {
            case SplitTypes.EQUAL:
                return t('expenseComponents.splitBreakdown.splitEqually');
            case SplitTypes.EXACT:
                return t('expenseComponents.splitBreakdown.exactAmounts');
            case SplitTypes.PERCENTAGE:
                return t('expenseComponents.splitBreakdown.byPercentage');
            default:
                return t('expenseComponents.splitBreakdown.customSplit');
        }
    };

    const getSplitTypeBadgeColor = (type: string) => {
        switch (type) {
            case SplitTypes.EQUAL:
                return 'bg-interactive-primary/10 text-interactive-primary';
            case SplitTypes.EXACT:
                return 'bg-interactive-secondary/10 text-interactive-primary';
            case SplitTypes.PERCENTAGE:
                return 'bg-interactive-accent/10 text-semantic-success';
            default:
                return 'bg-surface-muted text-text-primary';
        }
    };

    const totalUnits = amountToSmallestUnit(expense.amount, expense.currency);

    return (
        <Stack spacing='md'>
            <div className='flex items-center justify-between'>
                <Typography variant='bodyStrong' as='h3'>
                    {t('expenseComponents.splitBreakdown.splitBetween')}
                    {expense.participants.length}
                    {expense.participants.length === 1 ? t('expenseComponents.splitBreakdown.person') : t('expenseComponents.splitBreakdown.people')}
                </Typography>
                <span className={`badge ${getSplitTypeBadgeColor(expense.splitType)}`}>{getSplitTypeLabel(expense.splitType)}</span>
            </div>

            <div className='space-y-3'>
                {expense.splits.map((split) => {
                    const member = memberMap[split.uid];
                    if (!member) {
                        throw new Error(`SplitBreakdown: member ${split.uid} not found`);
                    }
                    const memberName = getGroupDisplayName(member);
                    const splitUnits = amountToSmallestUnit(split.amount, expense.currency);
                    const percentage = totalUnits === 0 ? 0 : (splitUnits / totalUnits) * 100;
                    const isPayer = expense.paidBy === split.uid;
                    const isOwing = !isPayer && splitUnits > 0;

                    return (
                        <div key={split.uid} className='bg-surface-muted rounded-lg p-4'>
                            <div className='flex items-center justify-between mb-2'>
                                <div className='flex items-center gap-3'>
                                    <div className='relative'>
                                        <Avatar displayName={memberName} userId={split.uid} size='md' />
                                        {isPayer && (
                                            <div className='absolute -bottom-1 -right-1 bg-interactive-accent text-text-inverted rounded-full p-0.5'>
                                                <CheckCircleIcon size={12} />
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <p className='font-medium text-text-primary'>{memberName}</p>
                                        {isPayer && <p className='text-xs text-semantic-success'>{t('expenseComponents.splitBreakdown.paid')}</p>}
                                    </div>
                                </div>
                                <div className='text-right'>
                                    <p
                                        className={`font-semibold ${isOwing ? 'text-semantic-error' : 'text-text-primary'}`}
                                        data-financial-amount='split'
                                        data-testid='split-amount'
                                    >
                                        <CurrencyAmount amount={split.amount} currency={expense.currency} />
                                    </p>
                                    <p className='help-text-xs'>{percentage.toFixed(1)}%</p>
                                </div>
                            </div>

                            <div className='mt-3'>
                                <div className='w-full bg-surface-raised rounded-full h-2 overflow-hidden'>
                                    <div
                                        className={`h-full transition-all duration-300 ${isPayer ? 'bg-interactive-accent' : 'bg-semantic-error'}`}
                                        style={{ width: `${Math.min(100, Math.max(0, percentage))}%` }}
                                    />
                                </div>
                                {isOwing && memberMap[expense.paidBy] && (
                                    <p className='help-text-xs mt-1'>
                                        {t('expenseComponents.splitBreakdown.owes')}
                                        {getGroupDisplayName(memberMap[expense.paidBy])}
                                    </p>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {expense.splitType === SplitTypes.PERCENTAGE && (
                <div className='mt-2 p-3 bg-surface-warning rounded-lg'>
                    <p className='text-sm text-semantic-warning'>
                        {t('expenseComponents.splitBreakdown.total')}
                        {(() => {
                            if (totalUnits === 0) {
                                return '0.0';
                            }
                            const percentageTotal = expense.splits.reduce((sum, s) => {
                                const splitUnits = amountToSmallestUnit(s.amount, expense.currency);
                                return sum + (splitUnits / totalUnits) * 100;
                            }, 0);
                            return percentageTotal.toFixed(1);
                        })()}%
                    </p>
                </div>
            )}
        </Stack>
    );
}
