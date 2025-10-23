import { CurrencyService } from '@/app/services/currencyService.ts';
import { getLastNight, getThisMorning, getToday, getYesterday } from '@/utils/dateUtils.ts';
import { ClockIcon } from '@heroicons/react/24/outline';
import { Amount, ExpenseCategory } from '@splitifyd/shared';
import { useTranslation } from 'react-i18next';
import { Button, Card, CategorySuggestionInput, CurrencyAmount, CurrencyAmountInput, TimeInput, Tooltip } from '../ui';
import { Stack } from '../ui/Stack';

interface ExpenseBasicFieldsProps {
    description: string;
    amount: Amount;
    currency: string;
    date: string;
    time: string;
    category: string;
    validationErrors: Record<string, string>;
    updateField: (field: string, value: any) => void;
    validateOnBlur: (field: string) => void;
    getRecentAmounts: () => Amount[];
    PREDEFINED_EXPENSE_CATEGORIES: ExpenseCategory[];
}

export function ExpenseBasicFields(
    { description, amount, currency, date, time, category, validationErrors, updateField, validateOnBlur, getRecentAmounts, PREDEFINED_EXPENSE_CATEGORIES }: ExpenseBasicFieldsProps,
) {
    const { t } = useTranslation();
    const recentAmounts = getRecentAmounts();
    const currencyService = CurrencyService.getInstance();
    const recentCurrencies = currencyService.getRecentCurrencies();

    return (
        <Card data-testid='expense-details-section'>
            <Stack spacing='md'>
                <h2 className='text-lg font-semibold text-gray-900 dark:text-white'>{t('expenseBasicFields.title')}</h2>

                {/* Description */}
                <div>
                    <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'>
                        {t('expenseBasicFields.descriptionLabel')}{' '}
                        <span className='text-red-500' data-testid='required-indicator'>
                            *
                        </span>
                    </label>
                    <input
                        type='text'
                        name='expense-description'
                        value={description}
                        onInput={(e) => updateField('description', (e.target as HTMLInputElement).value)}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white ${
                            validationErrors.description ? 'border-red-500 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'
                        }`}
                        placeholder={t('expenseBasicFields.descriptionPlaceholder')}
                        required
                        autoComplete='off'
                    />
                    {validationErrors.description && (
                        <p className='text-sm text-red-600 dark:text-red-400 mt-1' role='alert' data-testid='validation-error-description'>
                            {validationErrors.description}
                        </p>
                    )}
                </div>

                {/* Amount with Currency and Category */}
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
                                currencyService.addToRecentCurrencies(value);
                            }}
                            label={t('expenseBasicFields.amountLabel')}
                            required
                            placeholder='0.00'
                            error={validationErrors.amount || validationErrors.currency}
                            recentCurrencies={recentCurrencies}
                        />

                        {/* Recent amounts buttons */}
                        {/* when the form first renders the currency and amount are empty */}
                        {recentAmounts.length > 0 && amount && currency && (
                            <div className='mt-2'>
                                <p className='text-xs text-gray-600 dark:text-gray-400 mb-1'>{t('expenseBasicFields.recentAmounts')}</p>
                                <div className='flex flex-wrap gap-1'>
                                    {recentAmounts.map((amt, index) => (
                                        <button
                                            key={index}
                                            type='button'
                                            onClick={() => updateField('amount', amt)}
                                            className='px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors'
                                        >
                                            <CurrencyAmount amount={amt} currency={currency} />
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Category */}
                    <div>
                        <CategorySuggestionInput
                            value={category}
                            onChange={(value) => updateField('category', value)}
                            suggestions={PREDEFINED_EXPENSE_CATEGORIES}
                            label={t('expenseBasicFields.categoryLabel')}
                            placeholder={t('expenseBasicFields.categoryPlaceholder')}
                            className='dark:bg-gray-700 dark:text-white dark:border-gray-600'
                        />
                    </div>
                </div>

                {/* Date and Time */}
                <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                    {/* Date */}
                    <div>
                        <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'>
                            {t('expenseBasicFields.dateLabel')}{' '}
                            <span className='text-red-500' data-testid='required-indicator'>
                                *
                            </span>
                        </label>
                        <input
                            type='date'
                            value={date}
                            onInput={(e) => updateField('date', (e.target as HTMLInputElement).value)}
                            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white ${
                                validationErrors.date ? 'border-red-500 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'
                            }`}
                            required
                            autoComplete='off'
                        />
                        {validationErrors.date && (
                            <p className='text-sm text-red-600 dark:text-red-400 mt-1' role='alert' data-testid='validation-error-date'>
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
                                    className='dark:bg-gray-700 dark:text-white dark:border-gray-600'
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
                                            className='p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors'
                                            aria-label={t('expenseBasicFields.addSpecificTime')}
                                        >
                                            <ClockIcon className='h-5 w-5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200' aria-hidden='true' />
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
