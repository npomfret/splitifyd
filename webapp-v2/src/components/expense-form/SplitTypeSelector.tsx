import { useTranslation } from 'react-i18next';
import { Card } from '../ui';
import { Stack } from '../ui/Stack';

interface SplitTypeSelectorProps {
    splitType: string;
    updateField: (field: string, value: any) => void;
}

export function SplitTypeSelector({ splitType, updateField }: SplitTypeSelectorProps) {
    const { t } = useTranslation();
    return (
        <Card variant='glass' className='border-border-default' data-testid='how-to-split-section'>
            <Stack spacing='md'>
                <h2 className='text-lg font-semibold text-text-primary'>{t('expenseComponents.splitTypeSelector.label')}</h2>
                <div className='grid grid-cols-3 gap-3'>
                    <label
                        className={`
            flex items-center justify-center p-3 rounded-lg border cursor-pointer transition-colors text-center bg-surface-raised/50 backdrop-blur-sm
            ${
                            splitType === 'equal'
                                ? 'border-interactive-primary bg-interactive-primary/5 ring-2 ring-interactive-primary/30'
                                : 'border-border-default hover:bg-surface-muted/60 hover:border-interactive-primary/40'
                        }
          `}
                    >
                        <input type='radio' name='splitType' value='equal' checked={splitType === 'equal'} onChange={() => updateField('splitType', 'equal')} className='sr-only' autoComplete='off' />
                        <span className='text-sm font-medium text-text-primary'>{t('expenseComponents.splitTypeSelector.equal')}</span>
                    </label>

                    <label
                        className={`
            flex items-center justify-center p-3 rounded-lg border cursor-pointer transition-colors text-center bg-surface-raised/50 backdrop-blur-sm
            ${
                            splitType === 'exact'
                                ? 'border-interactive-primary bg-interactive-primary/5 ring-2 ring-interactive-primary/30'
                                : 'border-border-default hover:bg-surface-muted/60 hover:border-interactive-primary/40'
                        }
          `}
                    >
                        <input type='radio' name='splitType' value='exact' checked={splitType === 'exact'} onChange={() => updateField('splitType', 'exact')} className='sr-only' autoComplete='off' />
                        <span className='text-sm font-medium text-text-primary'>{t('expenseComponents.splitTypeSelector.exactAmounts')}</span>
                    </label>

                    <label
                        className={`
            flex items-center justify-center p-3 rounded-lg border cursor-pointer transition-colors text-center bg-surface-raised/50 backdrop-blur-sm
            ${
                            splitType === 'percentage'
                                ? 'border-interactive-primary bg-interactive-primary/5 ring-2 ring-interactive-primary/30'
                                : 'border-border-default hover:bg-surface-muted/60 hover:border-interactive-primary/40'
                        }
          `}
                    >
                        <input
                            type='radio'
                            name='splitType'
                            value='percentage'
                            checked={splitType === 'percentage'}
                            onChange={() => updateField('splitType', 'percentage')}
                            className='sr-only'
                            autoComplete='off'
                        />
                        <span className='text-sm font-medium text-text-primary'>{t('expenseComponents.splitTypeSelector.percentage')}</span>
                    </label>
                </div>
            </Stack>
        </Card>
    );
}
