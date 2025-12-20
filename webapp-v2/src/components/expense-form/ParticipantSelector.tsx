import { getGroupDisplayName } from '@/utils/displayName';
import { toUserId, UserId } from '@billsplit-wl/shared';
import { useTranslation } from 'react-i18next';
import { Button, Card, MemberDisplay, Typography } from '../ui';
import { Stack } from '../ui/Stack';
import type { ExpenseFormMember } from './types';

interface ParticipantSelectorProps {
    members: ExpenseFormMember[];
    participants: string[];
    paidBy: string;
    validationErrors: any;
    handleParticipantToggle: (memberId: UserId) => void;
    handleSelectAll: () => void;
    handleSelectNone: () => void;
}

export function ParticipantSelector({ members, participants, paidBy, validationErrors, handleParticipantToggle, handleSelectAll, handleSelectNone }: ParticipantSelectorProps) {
    const { t } = useTranslation();

    return (
        <Card variant='glass' className='border-border-default' ariaLabel={t('expenseComponents.participantSelector.label')}>
            <Stack spacing='md'>
                <div className='flex items-center justify-between'>
                    <Typography variant='subheading' as='h2'>
                        {t('expenseComponents.participantSelector.label')}{' '}
                        <span className='text-semantic-error' data-testid='required-indicator'>
                            {t('expenseComponents.participantSelector.requiredIndicator')}
                        </span>
                    </Typography>
                    <div className='flex gap-2'>
                        <Button type='button' variant='ghost' size='sm' onClick={handleSelectAll}>
                            {t('expenseComponents.participantSelector.selectAll')}
                        </Button>
                        <Button type='button' variant='ghost' size='sm' onClick={handleSelectNone}>
                            {t('expenseComponents.participantSelector.selectNone')}
                        </Button>
                    </div>
                </div>
                <div className='grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3'>
                    {members.map((member) => {
                        const isSelected = participants.includes(member.uid);
                        const isPayer = paidBy === member.uid;
                        return (
                            <label
                                key={member.uid}
                                className={`
                  flex items-center space-x-3 p-3 rounded-lg border cursor-pointer transition-colors bg-surface-subtle backdrop-blur-xs
                  ${
                                    isSelected
                                        ? 'border-interactive-primary bg-interactive-primary/5 ring-2 ring-interactive-primary/30'
                                        : 'border-border-default hover:bg-surface-muted hover:border-interactive-primary/40'
                                }
                  ${isPayer ? 'ring-2 ring-semantic-success/50' : ''}
                `}
                            >
                                <input
                                    type='checkbox'
                                    checked={isSelected}
                                    onChange={() => handleParticipantToggle(toUserId(member.uid))}
                                    disabled={isPayer}
                                    className='text-interactive-primary focus:ring-interactive-primary disabled:opacity-50'
                                    autoComplete='off'
                                />
                                <MemberDisplay
                                    displayName={getGroupDisplayName(member)}
                                    userId={toUserId(member.uid)}
                                    suffix={isPayer && <span className='text-semantic-success ml-1'>{t('expenseComponents.participantSelector.payerSuffix')}</span>}
                                    className='flex-1'
                                />
                            </label>
                        );
                    })}
                </div>
                {validationErrors.participants && (
                    <p className='text-sm text-semantic-error' role='alert'>
                        {validationErrors.participants}
                    </p>
                )}
            </Stack>
        </Card>
    );
}
