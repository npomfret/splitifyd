import { render, screen, fireEvent } from '../../../test-utils';
import { vi } from 'vitest';
import { ExpenseBasicFields } from '../ExpenseBasicFields';
import { ExpenseCategory } from '@shared/shared-types';

// Mock the CategorySuggestionInput component
vi.mock('../../ui/CategorySuggestionInput', () => ({
  CategorySuggestionInput: ({ value, onChange, label, placeholder }: any) => (
    <div data-testid="category-input">
      <label>{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange((e.target as HTMLInputElement).value)}
        placeholder={placeholder}
      />
    </div>
  )
}));

// Mock the CurrencySelector component
vi.mock('../../ui/CurrencySelector', () => ({
  CurrencySelector: ({ value, onChange, label }: any) => (
    <div data-testid="currency-selector">
      <label>{label}</label>
      <select value={value} onChange={(e) => onChange((e.target as HTMLSelectElement).value)}>
        <option value="USD">USD</option>
        <option value="EUR">EUR</option>
        <option value="GBP">GBP</option>
      </select>
    </div>
  )
}));

// Mock the currency service
vi.mock('../../../app/services/currencyService', () => ({
  CurrencyService: {
    getInstance: () => ({
      getRecentCurrencies: () => ['USD', 'EUR', 'GBP'],
      addToRecentCurrencies: vi.fn()
    })
  }
}));

describe('ExpenseBasicFields', () => {
  const mockUpdateField = vi.fn();
  const mockHandleAmountChange = vi.fn();
  const mockGetRecentAmounts = vi.fn(() => [25.50, 45.00, 12.75]);

  const mockCategories: ExpenseCategory[] = [
    { name: 'food', displayName: 'Food & Drinks', icon: '🍽️' },
    { name: 'transport', displayName: 'Transportation', icon: '🚗' },
    { name: 'entertainment', displayName: 'Entertainment', icon: '🎬' }
  ];

  const defaultProps = {
    description: '',
    amount: '',
    currency: 'USD',
    date: '2024-01-15',
    time: '',
    category: '',
    validationErrors: {},
    updateField: mockUpdateField,
    handleAmountChange: mockHandleAmountChange,
    getRecentAmounts: mockGetRecentAmounts,
    PREDEFINED_EXPENSE_CATEGORIES: mockCategories
  };

  beforeEach(() => {
    mockUpdateField.mockClear();
    mockHandleAmountChange.mockClear();
    mockGetRecentAmounts.mockClear();
  });

  it('renders all basic fields correctly', () => {
    render(<ExpenseBasicFields {...defaultProps} />);

    expect(screen.getByText('Expense Details')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('What was this expense for?')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('0.00')).toBeInTheDocument();
    expect(screen.getByDisplayValue('2024-01-15')).toBeInTheDocument();
    expect(screen.getByTestId('category-input')).toBeInTheDocument();
  });

  it('displays current values correctly', () => {
    const propsWithValues = {
      ...defaultProps,
      description: 'Dinner at restaurant',
      amount: '45.50',
      date: '2024-01-15',
      time: '18:30',
      category: 'Food & Drinks'
    };

    render(<ExpenseBasicFields {...propsWithValues} />);

    expect(screen.getByDisplayValue('Dinner at restaurant')).toBeInTheDocument();
    expect(screen.getByDisplayValue('45.50')).toBeInTheDocument();
    expect(screen.getByDisplayValue('2024-01-15')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Food & Drinks')).toBeInTheDocument();
  });

  it('calls updateField when description changes', () => {
    render(<ExpenseBasicFields {...defaultProps} />);

    const descriptionInput = screen.getByPlaceholderText('What was this expense for?');
    fireEvent.input(descriptionInput, { target: { value: 'New expense' } });

    expect(mockUpdateField).toHaveBeenCalledWith('description', 'New expense');
  });

  it('calls handleAmountChange when amount changes', () => {
    render(<ExpenseBasicFields {...defaultProps} />);

    const amountInput = screen.getByPlaceholderText('0.00');
    fireEvent.input(amountInput, { target: { value: '25.50' } });

    expect(mockHandleAmountChange).toHaveBeenCalled();
  });

  it('calls updateField when date changes', () => {
    render(<ExpenseBasicFields {...defaultProps} />);

    const dateInput = screen.getByDisplayValue('2024-01-15');
    fireEvent.input(dateInput, { target: { value: '2024-02-01' } });

    expect(mockUpdateField).toHaveBeenCalledWith('date', '2024-02-01');
  });

  it('displays validation errors correctly', () => {
    const propsWithErrors = {
      ...defaultProps,
      validationErrors: {
        description: 'Description is required',
        amount: 'Amount must be greater than 0',
        date: 'Invalid date'
      }
    };

    render(<ExpenseBasicFields {...propsWithErrors} />);

    expect(screen.getByText('Description is required')).toBeInTheDocument();
    expect(screen.getByText('Amount must be greater than 0')).toBeInTheDocument();
    expect(screen.getByText('Invalid date')).toBeInTheDocument();
  });

  it('applies error styling when validation errors exist', () => {
    const propsWithErrors = {
      ...defaultProps,
      validationErrors: {
        description: 'Description is required',
        date: 'Invalid date'
      }
    };

    render(<ExpenseBasicFields {...propsWithErrors} />);

    const descriptionInput = screen.getByPlaceholderText('What was this expense for?');
    const dateInput = screen.getByDisplayValue('2024-01-15');
    
    expect(descriptionInput).toHaveClass('border-red-500');
    expect(dateInput).toHaveClass('border-red-500');
  });

  it('displays recent amounts buttons when available', () => {
    render(<ExpenseBasicFields {...defaultProps} />);

    expect(screen.getByText('Recent amounts:')).toBeInTheDocument();
    expect(screen.getByText('$25.50')).toBeInTheDocument();
    expect(screen.getByText('$45.00')).toBeInTheDocument();
    expect(screen.getByText('$12.75')).toBeInTheDocument();
  });

  it('does not display recent amounts when none available', () => {
    const propsNoRecent = {
      ...defaultProps,
      getRecentAmounts: vi.fn(() => [])
    };

    render(<ExpenseBasicFields {...propsNoRecent} />);

    expect(screen.queryByText('Recent amounts:')).not.toBeInTheDocument();
  });

  it('calls updateField when recent amount button is clicked', () => {
    render(<ExpenseBasicFields {...defaultProps} />);

    const recentAmountButton = screen.getByText('$25.50');
    fireEvent.click(recentAmountButton);

    expect(mockUpdateField).toHaveBeenCalledWith('amount', 25.50);
  });

  it('includes required asterisks on required fields', () => {
    render(<ExpenseBasicFields {...defaultProps} />);

    const asterisks = screen.getAllByText('*');
    expect(asterisks).toHaveLength(3); // Description, Amount, Date
    
    asterisks.forEach(asterisk => {
      expect(asterisk).toHaveClass('text-red-500');
    });
  });

  it('has correct input attributes', () => {
    render(<ExpenseBasicFields {...defaultProps} />);

    const descriptionInput = screen.getByPlaceholderText('What was this expense for?');
    expect(descriptionInput).toHaveAttribute('type', 'text');
    expect(descriptionInput).toHaveAttribute('required');
    expect(descriptionInput).toHaveAttribute('placeholder', 'What was this expense for?');

    const amountInput = screen.getByPlaceholderText('0.00');
    expect(amountInput).toHaveAttribute('type', 'number');
    expect(amountInput).toHaveAttribute('required');
    expect(amountInput).toHaveAttribute('step', '0.01');
    expect(amountInput).toHaveAttribute('min', '0.01');
    expect(amountInput).toHaveAttribute('inputMode', 'decimal');

    const dateInput = screen.getByDisplayValue('2024-01-15');
    expect(dateInput).toHaveAttribute('type', 'date');
    expect(dateInput).toHaveAttribute('required');
  });

  it('handles numeric amount values correctly', () => {
    const propsWithNumericAmount = {
      ...defaultProps,
      amount: 42.50
    };

    render(<ExpenseBasicFields {...propsWithNumericAmount} />);

    expect(screen.getByDisplayValue('42.5')).toBeInTheDocument();
  });

  it('handles empty amount values correctly', () => {
    const propsWithEmptyAmount = {
      ...defaultProps,
      amount: 0
    };

    render(<ExpenseBasicFields {...propsWithEmptyAmount} />);

    const amountInput = screen.getByPlaceholderText('0.00');
    expect(amountInput).toHaveValue(null); // Empty number input shows as null
  });
});