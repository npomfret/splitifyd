import { formatCurrency, getCurrency } from '@/utils/currency';
import { getGroupDisplayName } from '@/utils/displayName';
import { Amount, amountToSmallestUnit, smallestUnitToAmountString, ZERO } from '@splitifyd/shared';
import { useTranslation } from 'react-i18next';
import { Avatar } from '../ui';

interface Member {
    uid: string;
    displayName: string;
    groupDisplayName: string;
}

interface Split {
    uid: string;
    amount: Amount;
    percentage?: number;
}

interface SplitAmountInputsProps {
    splitType: string;
    amount: Amount;
    currency: string;
    participants: string[];
    splits: Split[];
    members: Member[];
    updateSplitAmount: (uid: string, amount: Amount) => void;
    updateSplitPercentage: (uid: string, percentage: number) => void;
}

export function SplitAmountInputs({ splitType, amount, currency, participants, splits, members, updateSplitAmount, updateSplitPercentage }: SplitAmountInputsProps) {
    const { t } = useTranslation();
    const memberMap = members.reduce(
        (acc, member) => {
            acc[member.uid] = member;
            return acc;
        },
        {} as Record<string, Member>,
    );

    const totalUnits = currency ? amountToSmallestUnit(amount, currency) : 0;

    if (totalUnits <= 0 || !currency) {
        return null;
    }

    if (splitType === 'exact') {
        return (
            <div className='space-y-3'>
                <p className='text-sm text-gray-600 dark:text-gray-400'>{t('expenseComponents.splitAmountInputs.exactAmountsInstruction')}</p>
                {participants.map((participantId) => {
                    const member = memberMap[participantId];
                    if (!member) {
                        throw new Error(`SplitAmountInputs: participant ${participantId} not found`);
                    }
                    const memberName = getGroupDisplayName(member);
                    const split = splits.find((s) => s.uid === participantId);
                    return (
                        <div key={participantId} className='flex items-center justify-between gap-3'>
                            <div className='flex items-center gap-2 flex-1'>
                                <Avatar displayName={memberName} userId={participantId} size='sm' />
                                <span className='text-sm font-medium text-gray-700 dark:text-gray-300'>{memberName}</span>
                            </div>
                            <div className='flex items-center gap-2'>
                                <span className='text-gray-500'>{getCurrency(currency)!.symbol}</span>
                                <input
                                    type='text'
                                    inputMode='decimal'
                                    pattern='[0-9]*\.?[0-9]*'
                                    value={split?.amount || ''}
                                    onInput={(e) => {
                                        const value = (e.target as HTMLInputElement).value || ZERO;
                                        updateSplitAmount(participantId, value);
                                    }}
                                    className='w-24 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white text-right'
                                    autoComplete='off'
                                />
                            </div>
                        </div>
                    );
                })}
                <div className='pt-2 border-t border-gray-200 dark:border-gray-700'>
                    <div className='flex justify-between text-sm'>
                        <span className='font-medium text-gray-700 dark:text-gray-300'>{t('expenseComponents.splitAmountInputs.total')}</span>
                        <span
                            className={`font-medium ${
                                (() => {
                                    const splitUnits = splits.reduce((sum, s) => sum + amountToSmallestUnit(s.amount, currency), 0);
                                    return splitUnits === totalUnits ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';
                                })()
                            }`}
                            data-financial-amount='split-total'
                        >
                            {formatCurrency(
                                smallestUnitToAmountString(splits.reduce((sum, s) => sum + amountToSmallestUnit(s.amount, currency), 0), currency),
                                currency,
                            )} / {formatCurrency(amount, currency)}
                        </span>
                    </div>
                </div>
            </div>
        );
    }

    if (splitType === 'percentage') {
        const totalPercentage = splits.reduce((sum, s) => sum + (s.percentage || 0), 0);
        const totalPercentageUnits = Math.round(totalPercentage * 1000);
        const percentagesValid = totalPercentageUnits === 100 * 1000;
        return (
            <div className='space-y-3'>
                <p className='text-sm text-gray-600 dark:text-gray-400'>{t('expenseComponents.splitAmountInputs.percentageInstruction')}</p>
                {participants.map((participantId) => {
                    const member = memberMap[participantId];
                    if (!member) {
                        throw new Error(`SplitAmountInputs: participant ${participantId} not found`);
                    }
                    const memberName = getGroupDisplayName(member);
                    const split = splits.find((s) => s.uid === participantId);
                    return (
                        <div key={participantId} className='flex items-center justify-between gap-3'>
                            <div className='flex items-center gap-2 flex-1'>
                                <Avatar displayName={memberName} userId={participantId} size='sm' />
                                <span className='text-sm font-medium text-gray-700 dark:text-gray-300'>{memberName}</span>
                            </div>
                            <div className='flex items-center gap-2'>
                                <input
                                    type='text'
                                    inputMode='decimal'
                                    pattern='[0-9]*\.?[0-9]*'
                                    value={split?.percentage || ''}
                                    onInput={(e) => {
                                        const value = parseFloat((e.target as HTMLInputElement).value) || 0;
                                        updateSplitPercentage(participantId, value);
                                    }}
                                    className='w-20 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white text-right'
                                    autoComplete='off'
                                />
                                <span className='text-gray-500'>{t('expenseComponents.splitAmountInputs.percentSign')}</span>
                                <span className='text-xs text-gray-500 w-16 text-right'>{formatCurrency(split?.amount ?? ZERO, currency)}</span>
                            </div>
                        </div>
                    );
                })}
                <div className='pt-2 border-t border-gray-200 dark:border-gray-700'>
                    <div className='flex justify-between text-sm'>
                        <span className='font-medium text-gray-700 dark:text-gray-300'>{t('expenseComponents.splitAmountInputs.total')}</span>
                        <span
                            className={`font-medium ${percentagesValid ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}
                            data-financial-amount='percentage-total'
                        >
                            {totalPercentage.toFixed(2)}% / 100%
                        </span>
                    </div>
                </div>
            </div>
        );
    }

    if (splitType === 'equal') {
        return (
            <div className='mt-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg'>
                <p className='text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>{t('expenseComponents.splitAmountInputs.equalInstruction')}</p>
                <div className='space-y-1'>
                    {splits.map((split) => {
                        const member = memberMap[split.uid];
                        if (!member) {
                            throw new Error(`SplitAmountInputs: member ${split.uid} not found`);
                        }
                        const memberName = getGroupDisplayName(member);
                        return (
                            <div key={split.uid} className='flex items-center justify-between gap-2'>
                                <div className='flex items-center gap-2'>
                                    <Avatar displayName={memberName} userId={split.uid} size='sm' />
                                    <span className='text-sm text-gray-600 dark:text-gray-400'>{memberName}</span>
                                </div>
                                <span className='text-sm font-medium text-gray-900 dark:text-white'>{formatCurrency(split.amount, currency)}</span>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }

    return null;
}
