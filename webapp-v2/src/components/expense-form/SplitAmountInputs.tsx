import { getCurrency } from '@/utils/currency';
import { getGroupDisplayName } from '@/utils/displayName';
import { Amount, amountToSmallestUnit, smallestUnitToAmountString, toCurrencyISOCode, toUserId, UserId, ZERO } from '@billsplit-wl/shared';
import { useTranslation } from 'react-i18next';
import { Avatar, CurrencyAmount, Stack } from '../ui';
import type { ExpenseFormMember } from './types';

interface Split { // todo: should these be strongly typed?
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
    members: ExpenseFormMember[];
    updateSplitAmount: (uid: UserId, amount: Amount) => void;
    updateSplitPercentage: (uid: UserId, percentage: number) => void;
}

export function SplitAmountInputs({ splitType, amount, currency, participants, splits, members, updateSplitAmount, updateSplitPercentage }: SplitAmountInputsProps) {
    const { t } = useTranslation();
    const memberMap = members.reduce(
        (acc, member) => {
            acc[member.uid] = member;
            return acc;
        },
        {} as Record<string, ExpenseFormMember>,
    );

    const normalizedAmount = typeof amount === 'string' ? amount.trim() : amount;
    if (!currency || normalizedAmount === '') {
        return null;
    }

    let totalUnits: number;
    try {
        totalUnits = amountToSmallestUnit(normalizedAmount, toCurrencyISOCode(currency));
    } catch {
        return null;
    }

    if (totalUnits <= 0) {
        return null;
    }

    if (splitType === 'exact') {
        return (
            <Stack spacing='md'>
                <p className='text-sm text-text-muted dark:text-text-muted/80'>{t('expenseComponents.splitAmountInputs.exactAmountsInstruction')}</p>
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
                                <Avatar displayName={memberName} userId={toUserId(participantId)} size='sm' />
                                <span className='text-sm font-medium text-text-primary dark:text-text-muted/60'>{memberName}</span>
                            </div>
                            <div className='flex items-center gap-2'>
                                <span className='text-text-muted'>{getCurrency(toCurrencyISOCode(currency))!.symbol}</span>
                                <input
                                    type='text'
                                    inputMode='decimal'
                                    pattern='[0-9]*\.?[0-9]*'
                                    value={split?.amount || ''}
                                    onInput={(e) => {
                                        const value = (e.target as HTMLInputElement).value || ZERO;
                                        updateSplitAmount(toUserId(participantId), value);
                                    }}
                                    className='w-24 px-2 py-1 border border-border-default dark:border-border-strong rounded focus:ring-2 focus:ring-interactive-primary focus:border-interactive-primary dark:bg-text-primary dark:text-text-inverted text-right'
                                    autoComplete='off'
                                />
                            </div>
                        </div>
                    );
                })}
                <div className='pt-2 border-t border-border-default dark:border-border-strong'>
                    <div className='flex justify-between text-sm'>
                        <span className='font-medium text-text-primary dark:text-text-muted/60'>{t('expenseComponents.splitAmountInputs.total')}</span>
                        <span
                            className={`font-medium ${
                                (() => {
                                    const splitUnits = splits.reduce((sum, s) => sum + amountToSmallestUnit(s.amount, toCurrencyISOCode(currency)), 0);
                                    return splitUnits === totalUnits ? 'text-semantic-success dark:text-semantic-success' : 'text-semantic-error dark:text-semantic-error/80';
                                })()
                            }`}
                            data-financial-amount='split-total'
                        >
                            <CurrencyAmount
                                amount={smallestUnitToAmountString(
                                    splits.reduce((sum, s) => sum + amountToSmallestUnit(s.amount, toCurrencyISOCode(currency)), 0),
                                    toCurrencyISOCode(currency),
                                )}
                                currency={toCurrencyISOCode(currency)}
                            />{' '}
                            / <CurrencyAmount amount={amount} currency={toCurrencyISOCode(currency)} />
                        </span>
                    </div>
                </div>
            </Stack>
        );
    }

    if (splitType === 'percentage') {
        const totalPercentage = splits.reduce((sum, s) => sum + (s.percentage || 0), 0);
        const totalPercentageUnits = Math.round(totalPercentage * 1000);
        const percentagesValid = totalPercentageUnits === 100 * 1000;
        return (
            <Stack spacing='md'>
                <p className='text-sm text-text-muted dark:text-text-muted/80'>{t('expenseComponents.splitAmountInputs.percentageInstruction')}</p>
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
                                <Avatar displayName={memberName} userId={toUserId(participantId)} size='sm' />
                                <span className='text-sm font-medium text-text-primary dark:text-text-muted/60'>{memberName}</span>
                            </div>
                            <div className='flex items-center gap-2'>
                                <input
                                    type='text'
                                    inputMode='decimal'
                                    pattern='[0-9]*\.?[0-9]*'
                                    value={split?.percentage || ''}
                                    onInput={(e) => {
                                        const value = parseFloat((e.target as HTMLInputElement).value) || 0;
                                        updateSplitPercentage(toUserId(participantId), value);
                                    }}
                                    className='w-20 px-2 py-1 border border-border-default dark:border-border-strong rounded focus:ring-2 focus:ring-interactive-primary focus:border-interactive-primary dark:bg-text-primary dark:text-text-inverted text-right'
                                    autoComplete='off'
                                />
                                <span className='text-text-muted'>{t('expenseComponents.splitAmountInputs.percentSign')}</span>
                                <span className='text-xs text-text-muted w-16 text-right'>
                                    <CurrencyAmount amount={split?.amount ?? ZERO} currency={toCurrencyISOCode(currency)} />
                                </span>
                            </div>
                        </div>
                    );
                })}
                <div className='pt-2 border-t border-border-default dark:border-border-strong'>
                    <div className='flex justify-between text-sm'>
                        <span className='font-medium text-text-primary dark:text-text-muted/60'>{t('expenseComponents.splitAmountInputs.total')}</span>
                        <span
                            className={`font-medium ${percentagesValid ? 'text-semantic-success dark:text-semantic-success' : 'text-semantic-error dark:text-semantic-error/80'}`}
                            data-financial-amount='percentage-total'
                        >
                            {totalPercentage.toFixed(2)}% / 100%
                        </span>
                    </div>
                </div>
            </Stack>
        );
    }

    if (splitType === 'equal') {
        return (
            <div className='mt-4 p-4 bg-surface-muted dark:bg-text-primary/50 rounded-lg'>
                <p className='text-sm font-medium text-text-primary dark:text-text-muted/60 mb-2'>{t('expenseComponents.splitAmountInputs.equalInstruction')}</p>
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
                                    <Avatar displayName={memberName} userId={toUserId(split.uid)} size='sm' />
                                    <span className='text-sm text-text-muted dark:text-text-muted/80'>{memberName}</span>
                                </div>
                                <span className='text-sm font-medium text-text-primary dark:text-text-inverted'>
                                    <CurrencyAmount amount={split.amount} currency={toCurrencyISOCode(currency)} />
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }

    return null;
}
