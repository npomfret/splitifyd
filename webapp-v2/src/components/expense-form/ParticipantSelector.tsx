import { getGroupDisplayName } from '@/utils/displayName';
import { useTranslation } from 'react-i18next';
import { Avatar, Button, Card } from '../ui';
import { Stack } from '../ui/Stack';

interface Member {//todo: strong these be strongly typed?
    uid: string;
    groupDisplayName: string;
    displayName?: string | null;
}

interface ParticipantSelectorProps {//todo: strong these be strongly typed?
    members: Member[];
    participants: string[];
    paidBy: string;
    validationErrors: any;
    handleParticipantToggle: (memberId: string) => void;
    handleSelectAll: () => void;
    handleSelectNone: () => void;
}

export function ParticipantSelector({ members, participants, paidBy, validationErrors, handleParticipantToggle, handleSelectAll, handleSelectNone }: ParticipantSelectorProps) {
    const { t } = useTranslation();

    return (
        <Card variant='glass' className='border-border-default' data-testid='split-between-section'>
            <Stack spacing='md'>
                <div className='flex items-center justify-between'>
                    <h2 className='text-lg font-semibold text-text-primary'>
                        {t('expenseComponents.participantSelector.label')}{' '}
                        <span className='text-semantic-error' data-testid='required-indicator'>
                            {t('expenseComponents.participantSelector.requiredIndicator')}
                        </span>
                    </h2>
                    <div className='flex gap-2'>
                        <Button type='button' variant='ghost' size='sm' onClick={handleSelectAll}>
                            {t('expenseComponents.participantSelector.selectAll')}
                        </Button>
                        <Button type='button' variant='ghost' size='sm' onClick={handleSelectNone}>
                            {t('expenseComponents.participantSelector.selectNone')}
                        </Button>
                    </div>
                </div>
                <div className='grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3' data-testid='participant-selector-grid'>
                    {members.map((member) => {
                        const isSelected = participants.includes(member.uid);
                        const isPayer = paidBy === member.uid;
                        return (
                            <label
                                key={member.uid}
                                className={`
                  flex items-center space-x-3 p-3 rounded-lg border cursor-pointer transition-colors bg-surface-raised/50 backdrop-blur-sm
                  ${
                                    isSelected
                                        ? 'border-interactive-primary bg-interactive-primary/5 ring-2 ring-interactive-primary/30'
                                        : 'border-border-default hover:bg-surface-muted/60 hover:border-interactive-primary/40'
                                }
                  ${isPayer ? 'ring-2 ring-semantic-success/50' : ''}
                `}
                            >
                                <input
                                    type='checkbox'
                                    checked={isSelected}
                                    onChange={() => handleParticipantToggle(member.uid)}
                                    disabled={isPayer}
                                    className='text-interactive-primary focus:ring-interactive-primary disabled:opacity-50'
                                    autoComplete='off'
                                />
                                <Avatar displayName={getGroupDisplayName(member)} userId={member.uid} size='sm' />
                                <span className='text-sm font-medium text-text-primary flex-1'>
                                    {getGroupDisplayName(member)}
                                    {isPayer && <span className='text-semantic-success ml-1'>{t('expenseComponents.participantSelector.payerSuffix')}</span>}
                                </span>
                            </label>
                        );
                    })}
                </div>
                {validationErrors.participants && (
                    <p className='text-sm text-semantic-error' role='alert' data-testid='validation-error-participants'>
                        {validationErrors.participants}
                    </p>
                )}
            </Stack>
        </Card>
    );
}
