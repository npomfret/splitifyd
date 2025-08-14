import { Card, CategorySuggestionInput, CurrencyAmountInput, TimeInput, Button } from '../ui';
import { Stack } from '../ui/Stack';
import { ExpenseCategory } from '@shared/shared-types';
import { CurrencyService } from '../../app/services/currencyService';
import { formatCurrency } from '../../utils/currency';
import { getToday, getYesterday, getThisMorning, getLastNight } from '../../utils/dateUtils';

interface ExpenseBasicFieldsProps {
  description: string;
  amount: string | number;
  currency: string;
  date: string;
  time: string;
  category: string;
  validationErrors: any;
  updateField: (field: string, value: any) => void;
  handleAmountChange: (e: Event) => void;
  getRecentAmounts: () => number[];
  PREDEFINED_EXPENSE_CATEGORIES: ExpenseCategory[];
}

export function ExpenseBasicFields({
  description,
  amount,
  currency,
  date,
  time,
  category,
  validationErrors,
  updateField,
  handleAmountChange,
  getRecentAmounts,
  PREDEFINED_EXPENSE_CATEGORIES
}: ExpenseBasicFieldsProps) {
  const recentAmounts = getRecentAmounts();
  const currencyService = CurrencyService.getInstance();
  const recentCurrencies = currencyService.getRecentCurrencies();
  
  return (
    <Card>
      <Stack spacing="md">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Expense Details
        </h2>
        
        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Description <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={description}
            onInput={(e) => updateField('description', (e.target as HTMLInputElement).value)}
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white ${
              validationErrors.description 
                ? 'border-red-500 dark:border-red-500' 
                : 'border-gray-300 dark:border-gray-600'
            }`}
            placeholder="What was this expense for?"
            required
          />
          {validationErrors.description && (
            <p className="text-sm text-red-600 dark:text-red-400 mt-1">
              {validationErrors.description}
            </p>
          )}
        </div>
        
        {/* Amount with Currency and Category */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Combined Amount and Currency */}
          <div>
            <CurrencyAmountInput
              amount={amount || ''}
              currency={currency}
              onAmountChange={(value) => {
                const numValue = parseFloat(value) || 0;
                updateField('amount', numValue);
              }}
              onCurrencyChange={(value) => {
                updateField('currency', value);
                currencyService.addToRecentCurrencies(value);
              }}
              label="Amount"
              required
              placeholder="0.00"
              error={validationErrors.amount || validationErrors.currency}
              recentCurrencies={recentCurrencies}
            />
            
            {/* Recent amounts buttons */}
            {recentAmounts.length > 0 && (
              <div className="mt-2">
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Recent amounts:</p>
                <div className="flex flex-wrap gap-1">
                  {recentAmounts.map((amt, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => updateField('amount', amt)}
                      className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                    >
                      {formatCurrency(amt, currency)}
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
              label="Category"
              placeholder="Enter or select a category..."
              className="dark:bg-gray-700 dark:text-white dark:border-gray-600"
            />
          </div>
        </div>
        
        {/* Date and Time */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={date}
              onInput={(e) => updateField('date', (e.target as HTMLInputElement).value)}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white ${
                validationErrors.date 
                  ? 'border-red-500 dark:border-red-500' 
                  : 'border-gray-300 dark:border-gray-600'
              }`}
              required
            />
            {validationErrors.date && (
              <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                {validationErrors.date}
              </p>
            )}
            
            {/* Convenience Date Buttons */}
            <div className="mt-2 flex flex-wrap gap-1">
              <Button
                variant="ghost"
                size="sm"
                type="button"
                onClick={() => {
                  const today = getToday();
                  const dateStr = today.toISOString().split('T')[0];
                  updateField('date', dateStr);
                }}
                className="text-xs"
              >
                Today
              </Button>
              <Button
                variant="ghost"
                size="sm"
                type="button"
                onClick={() => {
                  const yesterday = getYesterday();
                  const dateStr = yesterday.toISOString().split('T')[0];
                  updateField('date', dateStr);
                }}
                className="text-xs"
              >
                Yesterday
              </Button>
              <Button
                variant="ghost"
                size="sm"
                type="button"
                onClick={() => {
                  const thisMorning = getThisMorning();
                  const dateStr = thisMorning.toISOString().split('T')[0];
                  const timeStr = '09:00';
                  updateField('date', dateStr);
                  updateField('time', timeStr);
                }}
                className="text-xs"
              >
                This Morning
              </Button>
              <Button
                variant="ghost"
                size="sm"
                type="button"
                onClick={() => {
                  const lastNight = getLastNight();
                  const dateStr = lastNight.toISOString().split('T')[0];
                  const timeStr = '20:00';
                  updateField('date', dateStr);
                  updateField('time', timeStr);
                }}
                className="text-xs"
              >
                Last Night
              </Button>
            </div>
          </div>

          {/* Time */}
          <div>
            <TimeInput
              value={time}
              onChange={(newTime) => updateField('time', newTime)}
              label="Time"
              error={validationErrors.time}
              className="dark:bg-gray-700 dark:text-white dark:border-gray-600"
            />
          </div>
        </div>
      </Stack>
    </Card>
  );
}