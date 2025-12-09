import { CurrencyService } from '@/app/services/currencyService.ts';
import { getLastNight, getThisMorning, getToday, getYesterday } from '@/utils/dateUtils.ts';
import { Amount, ExpenseLabel, ISOString, toCurrencyISOCode } from '@billsplit-wl/shared';
import type { RecentAmount } from '@billsplit-wl/shared';
import { ClockIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import { Button, Card, CurrencyAmount, CurrencyAmountInput, MultiLabelInput, TimeInput, Tooltip } from '../ui';
import { Stack } from '../ui/Stack';

interface ExpenseBasicFieldsProps {
    description: string;
    amount: Amount;
    currency: string;
    date: string;
    time: string;
    labels: ExpenseLabel[];
    validationErrors: Record<string, string>;
    updateField: (field: string, value: any) => void;
    validateOnBlur: (field: string) => void;
    recentAmounts: RecentAmount[];
    recentlyUsedLabels?: Record<ExpenseLabel, ISOString>;
    permittedCurrencies?: string[];
}

export function ExpenseBasicFields(
    { description, amount, currency, date, time, labels, validationErrors, updateField, validateOnBlur, recentAmounts, recentlyUsedLabels, permittedCurrencies }: ExpenseBasicFieldsProps,
) {
    const { t } = useTranslation();
    const currencyService = CurrencyService.getInstance();
    const recentCurrencies = currencyService.getRecentCurrencies();

    return (
        <Card variant='glass' className='border-border-default' ariaLabel={t('expenseBasicFields.title')}>
            <Stack spacing='lg'>
                <h2 className='text-lg font-semibold text-text-primary'>{t('expenseBasicFields.title')}</h2>

                {/* Description */}
                <div>
                    <label className='block text-sm font-medium text-text-primary mb-1'>
                        {t('expenseBasicFields.descriptionLabel')}{' '}
                        <span className='text-semantic-error' data-testid='required-indicator'>
                            *
                        </span>
                    </label>
                    <input
                        type='text'
                        name='expense-description'
                        value={description}
                        onInput={(e) => updateField('description', (e.target as HTMLInputElement).value)}
                        className={`w-full px-3 py-2 border rounded-lg bg-surface-raised backdrop-blur-xs text-text-primary placeholder:text-text-muted/70 focus:ring-2 focus:ring-interactive-primary focus:border-interactive-primary transition-colors duration-200 ${
                            validationErrors.description ? 'border-semantic-error' : 'border-border-default'
                        }`}
                        placeholder={t('expenseBasicFields.descriptionPlaceholder')}
                        required
                        autoComplete='off'
                    />
                    {validationErrors.description && (
                        <p className='text-sm text-semantic-error mt-1' role='alert' data-testid='validation-error-description'>
                            {validationErrors.description}
                        </p>
                    )}
                </div>

                {/* Amount with Currency and Label */}
                <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                    {/* Combined Amount and Currency */}
                    <div>
                        <CurrencyAmountInput
                            amount={amount ?? ''}
                            currency={currency}
                            onAmountChange={(value) => {
                                updateField('amount', value);
                            }}
                            onAmountBlur={() => validateOnBlur('amount')}
                            onCurrencyChange={(value) => {
                                updateField('currency', value);
                                currencyService.addToRecentCurrencies(toCurrencyISOCode(value));
                            }}
                            label={t('expenseBasicFields.amountLabel')}
                            required
                            placeholder='0.00'
                            error={validationErrors.amount || validationErrors.currency}
                            recentCurrencies={recentCurrencies}
                            permittedCurrencies={permittedCurrencies}
                        />

                        {/* Recent amounts buttons - show latest 3, clicking fills both currency and amount */}
                        {recentAmounts.length > 0 && (
                            <div className='mt-2'>
                                <p className='text-xs text-text-muted mb-1'>{t('expenseBasicFields.recentAmounts')}</p>
                                <div className='flex flex-wrap gap-1'>
                                    {recentAmounts.map((recent, index) => (
                                        <button
                                            key={index}
                                            type='button'
                                            onClick={() => {
                                                updateField('currency', recent.currency);
                                                updateField('amount', recent.amount);
                                                currencyService.addToRecentCurrencies(recent.currency);
                                            }}
                                            className='px-2 py-1 text-xs bg-surface-base/50 border border-border-default/50 text-text-primary rounded hover:bg-surface-muted hover:border-interactive-primary/40 transition-all duration-200'
                                        >
                                            <CurrencyAmount amount={recent.amount} currency={recent.currency} />
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Labels */}
                    <div>
                        <MultiLabelInput
                            values={labels}
                            onChange={(values) => updateField('labels', values)}
                            recentlyUsedLabels={recentlyUsedLabels}
                            suggestedLabels={t('suggestedLabels', { returnObjects: true }) as string[]}
                            label={t('expenseBasicFields.labelsLabel')}
                            placeholder={t('expenseBasicFields.labelsPlaceholder')}
                            error={validationErrors.labels}
                            maxLabels={3}
                        />
                    </div>
                </div>

                {/* Date and Time */}
                <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                    {/* Date */}
                    <div>
                        <label htmlFor='expense-date-input' className='block text-sm font-medium text-text-primary mb-1'>
                            {t('expenseBasicFields.dateLabel')}{' '}
                            <span className='text-semantic-error' data-testid='required-indicator'>
                                *
                            </span>
                        </label>
                        <input
                            id='expense-date-input'
                            type='date'
                            value={date}
                            onInput={(e) => updateField('date', (e.target as HTMLInputElement).value)}
                            className={`w-full px-3 py-2 border rounded-lg bg-surface-raised backdrop-blur-xs text-text-primary focus:ring-2 focus:ring-interactive-primary focus:border-interactive-primary transition-colors duration-200 ${
                                validationErrors.date ? 'border-semantic-error' : 'border-border-default'
                            }`}
                            required
                            autoComplete='off'
                        />
                        {validationErrors.date && (
                            <p className='text-sm text-semantic-error mt-1' role='alert' data-testid='validation-error-date'>
                                {validationErrors.date}
                            </p>
                        )}

                        {/* Convenience Date Buttons */}
                        <div className='mt-2 flex flex-wrap gap-1'>
                            <Button
                                variant='ghost'
                                size='sm'
                                type='button'
                                onClick={() => {
                                    const today = getToday();
                                    const dateStr = today.toISOString().split('T')[0];
                                    updateField('date', dateStr);
                                    // Keep default noon time, no need to update
                                }}
                                className='text-xs'
                            >
                                {t('expenseBasicFields.today')}
                            </Button>
                            <Button
                                variant='ghost'
                                size='sm'
                                type='button'
                                onClick={() => {
                                    const yesterday = getYesterday();
                                    const dateStr = yesterday.toISOString().split('T')[0];
                                    updateField('date', dateStr);
                                    // Keep default noon time, no need to update
                                }}
                                className='text-xs'
                            >
                                {t('expenseBasicFields.yesterday')}
                            </Button>
                            <Button
                                variant='ghost'
                                size='sm'
                                type='button'
                                onClick={() => {
                                    const thisMorning = getThisMorning();
                                    const dateStr = thisMorning.toISOString().split('T')[0];
                                    const timeStr = '09:00';
                                    updateField('date', dateStr);
                                    updateField('time', timeStr);
                                    // Time is not noon, field will auto-show
                                }}
                                className='text-xs'
                            >
                                {t('expenseBasicFields.thisMorning')}
                            </Button>
                            <Button
                                variant='ghost'
                                size='sm'
                                type='button'
                                onClick={() => {
                                    const lastNight = getLastNight();
                                    const dateStr = lastNight.toISOString().split('T')[0];
                                    const timeStr = '20:00';
                                    updateField('date', dateStr);
                                    updateField('time', timeStr);
                                    // Time is not noon, field will auto-show
                                }}
                                className='text-xs'
                            >
                                {t('expenseBasicFields.lastNight')}
                            </Button>
                        </div>
                    </div>

                    {/* Time - Conditionally shown */}
                    <div>
                        {/* Show time field if time is not noon (12:00) */}
                        {time !== '12:00'
                            ? (
                                <TimeInput
                                    value={time}
                                    onChange={(newTime) => updateField('time', newTime)}
                                    label={t('expenseBasicFields.timeLabel')}
                                    error={validationErrors.time}
                                />
                            )
                            : (
                                /* Show clock icon button when time field is hidden */
                                <div className='flex items-center h-[68px]'>
                                    <Tooltip content={t('expenseBasicFields.addSpecificTime')}>
                                        <button
                                            type='button'
                                            onClick={() => {
                                                // Set a non-noon time to trigger field visibility
                                                // Use current time as a sensible default
                                                const now = new Date();
                                                const hours = now.getHours().toString().padStart(2, '0');
                                                const minutes = now.getMinutes().toString().padStart(2, '0');
                                                updateField('time', `${hours}:${minutes}`);
                                            }}
                                            className='p-2 rounded-lg hover:bg-surface-muted transition-colors'
                                            aria-label={t('expenseBasicFields.addSpecificTime')}
                                        >
                                            <ClockIcon className='h-5 w-5 text-text-muted hover:text-text-primary' aria-hidden='true' />
                                        </button>
                                    </Tooltip>
                                </div>
                            )}
                    </div>
                </div>
            </Stack>
        </Card>
    );
}
