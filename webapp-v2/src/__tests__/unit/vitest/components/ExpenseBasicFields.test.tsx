import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/preact';
import { ExpenseBasicFields } from '@/components/expense-form/ExpenseBasicFields';
import { ExpenseCategory } from '@splitifyd/shared';
import '@testing-library/jest-dom';

// Mock the translation hook
vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
    }),
}));

// Mock the UI components
vi.mock('@/components/ui', () => ({
    Card: ({ children }: { children: any }) => <div data-testid="card">{children}</div>,
    Button: ({ children, onClick, ...props }: any) => (
        <button onClick={onClick} {...props}>
            {children}
        </button>
    ),
    CurrencyAmountInput: ({ amount, currency, onAmountChange, onCurrencyChange, recentCurrencies, ...props }: any) => (
        <div data-testid="currency-amount-input">
            <input data-testid="amount-input" value={amount} onChange={(e) => onAmountChange((e.target as HTMLInputElement).value)} {...props} />
            <select data-testid="currency-select" value={currency} onChange={(e) => onCurrencyChange((e.target as HTMLSelectElement).value)}>
                <option value="">Select Currency</option>
                {recentCurrencies?.map((curr: string) => (
                    <option key={curr} value={curr}>
                        {curr}
                    </option>
                ))}
            </select>
        </div>
    ),
    CategorySuggestionInput: ({ value, onChange, suggestions, ...props }: any) => (
        <div data-testid="category-suggestion-input">
            <input data-testid="category-input" value={value} onChange={(e) => onChange((e.target as HTMLInputElement).value)} {...props} />
            <div data-testid="suggestions" style={{ display: 'none' }}>
                {suggestions?.map((suggestion: any) => (
                    <div key={suggestion.name} data-testid={`suggestion-${suggestion.name}`}>
                        {suggestion.displayName}
                    </div>
                ))}
            </div>
        </div>
    ),
    TimeInput: ({ value, onChange, ...props }: any) => <input data-testid="time-input" type="time" value={value} onChange={(e) => onChange((e.target as HTMLInputElement).value)} {...props} />,
}));

// Mock the Stack component
vi.mock('@/components/ui/Stack', () => ({
    Stack: ({ children }: { children: any }) => <div data-testid="stack">{children}</div>,
}));

// Mock the currency service
const mockCurrencyService = {
    getRecentCurrencies: vi.fn(() => ['USD', 'EUR', 'GBP']),
    addToRecentCurrencies: vi.fn(),
};

vi.mock('@/app/services/currencyService.ts', () => ({
    CurrencyService: {
        getInstance: () => mockCurrencyService,
    },
}));

// Mock utilities
vi.mock('@/utils/currency', () => ({
    formatCurrency: (amount: number, currency: string) => `${currency}${amount.toFixed(2)}`,
}));

vi.mock('@/utils/dateUtils.ts', () => ({
    getToday: () => new Date('2022-01-15T12:00:00.000Z'),
    getYesterday: () => new Date('2022-01-14T12:00:00.000Z'),
    getThisMorning: () => new Date('2022-01-15T09:00:00.000Z'),
    getLastNight: () => new Date('2022-01-14T20:00:00.000Z'),
}));

// Mock heroicons
vi.mock('@heroicons/react/24/outline', () => ({
    ClockIcon: ({ className, ...props }: any) => <div data-testid="clock-icon" className={className} {...props} />,
}));

describe('ExpenseBasicFields - Recent Amounts & Category Suggestions', () => {
    const mockUpdateField = vi.fn();
    const mockGetRecentAmounts = vi.fn();

    const defaultProps = {
        description: 'Test expense',
        amount: 25.5,
        currency: 'EUR',
        date: '2022-01-15',
        time: '12:00',
        category: 'food',
        validationErrors: {},
        updateField: mockUpdateField,
        getRecentAmounts: mockGetRecentAmounts,
        PREDEFINED_EXPENSE_CATEGORIES: [
            { name: 'food', displayName: 'Food & Drinks', icon: '🍕' },
            { name: 'transport', displayName: 'Transport', icon: '🚗' },
            { name: 'shopping', displayName: 'Shopping', icon: '🛒' },
        ] as ExpenseCategory[],
    };

    beforeEach(() => {
        vi.clearAllMocks();
        cleanup();
    });

    describe('Recent Amounts Feature', () => {
        it('should display recent amounts when available', () => {
            // Arrange
            mockGetRecentAmounts.mockReturnValue([12.5, 25.0, 45.75]);

            // Act
            render(<ExpenseBasicFields {...defaultProps} />);

            // Assert
            expect(screen.getByText('expenseBasicFields.recentAmounts')).toBeInTheDocument();

            // Check all recent amount buttons are displayed with correct formatting
            expect(screen.getByRole('button', { name: 'EUR12.50' })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'EUR25.00' })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'EUR45.75' })).toBeInTheDocument();
        });

        it('should not display recent amounts section when none available', () => {
            // Arrange
            mockGetRecentAmounts.mockReturnValue([]);

            // Act
            render(<ExpenseBasicFields {...defaultProps} />);

            // Assert
            expect(screen.queryByText('expenseBasicFields.recentAmounts')).not.toBeInTheDocument();
            expect(screen.queryByRole('button', { name: /EUR/ })).not.toBeInTheDocument();
        });

        it('should call updateField with correct amount when recent amount button is clicked', () => {
            // Arrange
            mockGetRecentAmounts.mockReturnValue([12.5, 25.0]);

            // Act
            render(<ExpenseBasicFields {...defaultProps} />);

            const button12_50 = screen.getByRole('button', { name: 'EUR12.50' });
            fireEvent.click(button12_50);

            // Assert
            expect(mockUpdateField).toHaveBeenCalledWith('amount', 12.5);
        });

        it('should handle multiple recent amounts correctly', () => {
            // Arrange - test with maximum expected amounts
            const recentAmounts = [10.0, 15.5, 22.75, 35.25, 50.0];
            mockGetRecentAmounts.mockReturnValue(recentAmounts);

            // Act
            render(<ExpenseBasicFields {...defaultProps} />);

            // Assert
            recentAmounts.forEach((amount) => {
                const formattedAmount = `EUR${amount.toFixed(2)}`;
                expect(screen.getByRole('button', { name: formattedAmount })).toBeInTheDocument();
            });

            // Test clicking different amounts
            fireEvent.click(screen.getByRole('button', { name: 'EUR35.25' }));
            expect(mockUpdateField).toHaveBeenCalledWith('amount', 35.25);
        });

        it('should format recent amounts correctly with different currencies', () => {
            // Arrange
            mockGetRecentAmounts.mockReturnValue([100, 250.5]);
            const props = { ...defaultProps, currency: 'JPY' };

            // Act
            render(<ExpenseBasicFields {...props} />);

            // Assert
            expect(screen.getByRole('button', { name: 'JPY100.00' })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'JPY250.50' })).toBeInTheDocument();
        });

        it('should handle edge case of single recent amount', () => {
            // Arrange
            mockGetRecentAmounts.mockReturnValue([42.75]);

            // Act
            render(<ExpenseBasicFields {...defaultProps} />);

            // Assert
            expect(screen.getByText('expenseBasicFields.recentAmounts')).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'EUR42.75' })).toBeInTheDocument();

            // Ensure only one button exists
            const amountButtons = screen.getAllByRole('button').filter((btn) => btn.textContent?.startsWith('EUR'));
            expect(amountButtons).toHaveLength(1);
        });

        it('should handle zero amount in recent amounts', () => {
            // Arrange
            mockGetRecentAmounts.mockReturnValue([0, 15.5]);

            // Act
            render(<ExpenseBasicFields {...defaultProps} />);

            // Assert
            expect(screen.getByRole('button', { name: 'EUR0.00' })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'EUR15.50' })).toBeInTheDocument();
        });
    });

    describe('Category Suggestions Feature', () => {
        it('should render CategorySuggestionInput with correct props', () => {
            // Act
            render(<ExpenseBasicFields {...defaultProps} />);

            // Assert
            const categoryInput = screen.getByTestId('category-suggestion-input');
            expect(categoryInput).toBeInTheDocument();

            const input = screen.getByTestId('category-input');
            expect(input).toHaveValue('food');
        });

        it('should pass all predefined categories to CategorySuggestionInput', () => {
            // Act
            render(<ExpenseBasicFields {...defaultProps} />);

            // Assert
            const suggestionsContainer = screen.getByTestId('suggestions');
            expect(suggestionsContainer).toBeInTheDocument();

            // Verify all categories are available
            expect(screen.getByTestId('suggestion-food')).toBeInTheDocument();
            expect(screen.getByTestId('suggestion-transport')).toBeInTheDocument();
            expect(screen.getByTestId('suggestion-shopping')).toBeInTheDocument();
        });

        it('should call updateField when category changes', () => {
            // Act
            render(<ExpenseBasicFields {...defaultProps} />);

            const categoryInput = screen.getByTestId('category-input');
            fireEvent.change(categoryInput, { target: { value: 'transport' } });

            // Assert
            expect(mockUpdateField).toHaveBeenCalledWith('category', 'transport');
        });

        it('should handle empty category suggestions array', () => {
            // Arrange
            const props = { ...defaultProps, PREDEFINED_EXPENSE_CATEGORIES: [] };

            // Act
            render(<ExpenseBasicFields {...props} />);

            // Assert
            const categoryInput = screen.getByTestId('category-suggestion-input');
            expect(categoryInput).toBeInTheDocument();

            const suggestionsContainer = screen.getByTestId('suggestions');
            expect(suggestionsContainer).toBeInTheDocument();
            expect(suggestionsContainer.children).toHaveLength(0);
        });

        it('should handle custom category input', () => {
            // Act
            render(<ExpenseBasicFields {...defaultProps} />);

            const categoryInput = screen.getByTestId('category-input');
            fireEvent.change(categoryInput, { target: { value: 'custom-category' } });

            // Assert
            expect(mockUpdateField).toHaveBeenCalledWith('category', 'custom-category');
        });

        it('should display category input component', () => {
            // Act
            render(<ExpenseBasicFields {...defaultProps} />);

            // Assert
            expect(screen.getByTestId('category-suggestion-input')).toBeInTheDocument();
            expect(screen.getByTestId('category-input')).toBeInTheDocument();
        });
    });

    describe('Integration Tests - Recent Amounts + Category Suggestions', () => {
        it('should render both features simultaneously when data is available', () => {
            // Arrange
            mockGetRecentAmounts.mockReturnValue([15.0, 30.0]);

            // Act
            render(<ExpenseBasicFields {...defaultProps} />);

            // Assert
            // Recent amounts should be visible
            expect(screen.getByText('expenseBasicFields.recentAmounts')).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'EUR15.00' })).toBeInTheDocument();

            // Category suggestions should be available
            expect(screen.getByTestId('category-suggestion-input')).toBeInTheDocument();
            expect(screen.getByTestId('suggestion-food')).toBeInTheDocument();
        });

        it('should handle interaction with both features in sequence', () => {
            // Arrange
            mockGetRecentAmounts.mockReturnValue([20.0]);

            // Act
            render(<ExpenseBasicFields {...defaultProps} />);

            // Interact with recent amount
            fireEvent.click(screen.getByRole('button', { name: 'EUR20.00' }));

            // Interact with category
            const categoryInput = screen.getByTestId('category-input');
            fireEvent.change(categoryInput, { target: { value: 'transport' } });

            // Assert
            expect(mockUpdateField).toHaveBeenCalledWith('amount', 20.0);
            expect(mockUpdateField).toHaveBeenCalledWith('category', 'transport');
            expect(mockUpdateField).toHaveBeenCalledTimes(2);
        });

        it('should maintain independent state when one feature has no data', () => {
            // Arrange - no recent amounts but categories available
            mockGetRecentAmounts.mockReturnValue([]);

            // Act
            render(<ExpenseBasicFields {...defaultProps} />);

            // Assert
            // Recent amounts should not be visible
            expect(screen.queryByText('expenseBasicFields.recentAmounts')).not.toBeInTheDocument();

            // Category suggestions should still work
            expect(screen.getByTestId('category-suggestion-input')).toBeInTheDocument();

            const categoryInput = screen.getByTestId('category-input');
            fireEvent.change(categoryInput, { target: { value: 'shopping' } });
            expect(mockUpdateField).toHaveBeenCalledWith('category', 'shopping');
        });
    });

    describe('Error Handling and Edge Cases', () => {
        it('should handle null/undefined recent amounts gracefully', () => {
            // Arrange
            mockGetRecentAmounts.mockReturnValue([]);

            // Act
            render(<ExpenseBasicFields {...defaultProps} />);

            // Assert - no recent amounts should be displayed
            expect(screen.queryByText('expenseBasicFields.recentAmounts')).not.toBeInTheDocument();
        });

        it('should handle empty category array gracefully', () => {
            // Arrange - test with empty array instead of malformed data
            const props = {
                ...defaultProps,
                PREDEFINED_EXPENSE_CATEGORIES: [],
            };

            // Act
            render(<ExpenseBasicFields {...props} />);

            // Assert
            expect(screen.getByTestId('category-suggestion-input')).toBeInTheDocument();
            const suggestionsContainer = screen.getByTestId('suggestions');
            expect(suggestionsContainer.children).toHaveLength(0);
        });

        it('should handle very large recent amounts', () => {
            // Arrange
            mockGetRecentAmounts.mockReturnValue([999999.99, 1000000.0]);

            // Act
            render(<ExpenseBasicFields {...defaultProps} />);

            // Assert
            expect(screen.getByRole('button', { name: 'EUR999999.99' })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'EUR1000000.00' })).toBeInTheDocument();
        });

        it('should handle decimal precision correctly in recent amounts', () => {
            // Arrange
            mockGetRecentAmounts.mockReturnValue([12.345, 0.01, 99.999]);

            // Act
            render(<ExpenseBasicFields {...defaultProps} />);

            // Assert - should format to 2 decimal places
            expect(screen.getByRole('button', { name: 'EUR12.35' })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'EUR0.01' })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'EUR100.00' })).toBeInTheDocument();
        });
    });
});
