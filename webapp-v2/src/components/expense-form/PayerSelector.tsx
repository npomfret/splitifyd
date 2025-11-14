import { getGroupDisplayName } from '@/utils/displayName';
import { useTranslation } from 'react-i18next';
import { Avatar, Card } from '../ui';
import { Stack } from '../ui/Stack';

interface Member {
    uid: string;
    groupDisplayName: string;
    displayName?: string | null;
}

interface PayerSelectorProps {
    members: Member[];
    paidBy: string;
    validationErrors: any;
    updateField: (field: string, value: any) => void;
}

export function PayerSelector({ members, paidBy, validationErrors, updateField }: PayerSelectorProps) {
    const { t } = useTranslation();
    return (
        <Card data-testid='who-paid-section'>
            <Stack spacing='md'>
                <h2 className='text-lg font-semibold text-text-primary dark:text-white'>
                    {t('expenseComponents.payerSelector.label')}{' '}
                    <span className='text-semantic-error' data-testid='required-indicator'>
                        {t('expenseComponents.payerSelector.requiredIndicator')}
                    </span>
                </h2>
                <div className='grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3'>
                    {members.map((member) => (
                        <label
                            key={member.uid}
                            className={`
                flex items-center space-x-3 p-3 rounded-lg border cursor-pointer transition-colors
                ${paidBy === member.uid ? 'border-interactive-primary bg-interactive-primary/10 dark:bg-interactive-primary/20' : 'border-border-default dark:border-border-strong hover:bg-surface-muted dark:hover:bg-text-primary'}
              `}
                        >
                            <input
                                type='radio'
                                name='paidBy'
                                value={member.uid}
                                checked={paidBy === member.uid}
                                onChange={() => updateField('paidBy', member.uid)}
                                className='text-interactive-primary focus:ring-interactive-primary'
                                autoComplete='off'
                            />
                            <Avatar displayName={getGroupDisplayName(member)} userId={member.uid} size='sm' />
                            <span className='text-sm font-medium text-text-primary dark:text-white'>{getGroupDisplayName(member)}</span>
                        </label>
                    ))}
                </div>
                {validationErrors.paidBy && (
                    <p className='text-sm text-semantic-error dark:text-semantic-error/80' role='alert' data-testid='validation-error-paidBy'>
                        {validationErrors.paidBy}
                    </p>
                )}
            </Stack>
        </Card>
    );
}
