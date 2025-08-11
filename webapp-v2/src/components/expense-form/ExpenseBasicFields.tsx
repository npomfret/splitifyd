import { Card, CategorySuggestionInput } from '../ui';
import { Stack } from '../ui/Stack';
import { ExpenseCategory } from '@shared/types/webapp-shared-types';

interface ExpenseBasicFieldsProps {
  description: string;
  amount: string | number;
  date: string;
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
  date,
  category,
  validationErrors,
  updateField,
  handleAmountChange,
  getRecentAmounts,
  PREDEFINED_EXPENSE_CATEGORIES
}: ExpenseBasicFieldsProps) {
  const recentAmounts = getRecentAmounts();
  
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
        
        {/* Amount and Category */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Amount ($) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              value={amount || ''}
              onInput={handleAmountChange}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="0.00"
              step="0.01"
              min="0.01"
              inputMode="decimal"
              required
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
                      ${amt.toFixed(2)}
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            {validationErrors.amount && (
              <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                {validationErrors.amount}
              </p>
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
        </div>
      </Stack>
    </Card>
  );
}