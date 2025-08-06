import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@/test-utils';
import { CategorySuggestionInput } from '../CategorySuggestionInput';
import type { ExpenseCategory } from '@shared/types/webapp-shared-types';

// Test categories matching the predefined categories in the app
const mockCategories: ExpenseCategory[] = [
  { name: 'food', displayName: 'Food & Dining', icon: '🍽️' },
  { name: 'transport', displayName: 'Transportation', icon: '🚗' },
  { name: 'entertainment', displayName: 'Entertainment', icon: '🎬' },
  { name: 'utilities', displayName: 'Utilities', icon: '💡' },
  { name: 'shopping', displayName: 'Shopping', icon: '🛒' },
  { name: 'other', displayName: 'Other', icon: '📝' }
];

describe('CategorySuggestionInput', () => {
  const defaultProps = {
    value: '',
    onChange: vi.fn(),
    suggestions: mockCategories,
    placeholder: 'Enter category...'
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('renders input field with placeholder', () => {
      render(<CategorySuggestionInput {...defaultProps} />);
      
      const input = screen.getByRole('combobox');
      expect(input).toBeInTheDocument();
      expect(input).toHaveAttribute('placeholder', 'Enter category...');
    });

    it('renders label when provided', () => {
      render(
        <CategorySuggestionInput
          {...defaultProps}
          label="Category"
          required
        />
      );
      
      expect(screen.getByLabelText(/Category/)).toBeInTheDocument();
      expect(screen.getByText('*')).toBeInTheDocument(); 
    });

    it('displays error message when provided', () => {
      const errorMessage = 'Category is required';
      render(
        <CategorySuggestionInput
          {...defaultProps}
          error={errorMessage}
        />
      );
      
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
      expect(screen.getByRole('combobox')).toHaveAttribute('aria-invalid', 'true');
    });
  });

  describe('Predefined Category Selection', () => {
    it('shows suggestions dropdown when input gains focus', async () => {
      render(<CategorySuggestionInput {...defaultProps} />);
      
      const input = screen.getByRole('combobox');
      fireEvent.focus(input);
      
      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });

      expect(screen.getByText('Food & Dining')).toBeInTheDocument();
      expect(screen.getByText('Transportation')).toBeInTheDocument();
      expect(screen.getByText('Entertainment')).toBeInTheDocument();
    });

    it('filters suggestions based on input text', async () => {
      render(<CategorySuggestionInput {...defaultProps} value="foo" />);
      
      const input = screen.getByRole('combobox');
      fireEvent.focus(input);
      
      await waitFor(() => {
        expect(screen.getByText('Food & Dining')).toBeInTheDocument();
        expect(screen.queryByText('Transportation')).not.toBeInTheDocument();
      });
    });

    it('calls onChange with category name when suggestion is clicked', async () => {
      const mockOnChange = vi.fn();
      render(
        <CategorySuggestionInput
          {...defaultProps}
          onChange={mockOnChange}
        />
      );
      
      const input = screen.getByRole('combobox');
      fireEvent.focus(input);
      
      await waitFor(() => {
        expect(screen.getByText('Food & Dining')).toBeInTheDocument();
      });
      
      fireEvent.click(screen.getByText('Food & Dining'));
      
      expect(mockOnChange).toHaveBeenCalledWith('food');
    });
  });

  describe('Custom Category Input', () => {
    it('accepts custom category text input', () => {
      const mockOnChange = vi.fn();
      render(
        <CategorySuggestionInput
          {...defaultProps}
          onChange={mockOnChange}
        />
      );
      
      const input = screen.getByRole('combobox');
      fireEvent.change(input, { target: { value: 'Custom Category' } });
      
      expect(mockOnChange).toHaveBeenCalledWith('Custom Category');
    });

    it('allows typing custom categories that do not match suggestions', () => {
      const mockOnChange = vi.fn();
      render(
        <CategorySuggestionInput
          {...defaultProps}
          onChange={mockOnChange}
        />
      );
      
      const input = screen.getByRole('combobox');
      fireEvent.change(input, { target: { value: 'Books & Magazines' } });
      
      expect(mockOnChange).toHaveBeenCalledWith('Books & Magazines');
    });

    it('does not show suggestions dropdown when no matches found', async () => {
      render(<CategorySuggestionInput {...defaultProps} value="xyz123" />);
      
      const input = screen.getByRole('combobox');
      fireEvent.focus(input);
      
      await waitFor(() => {
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      });
    });
  });

  describe('Keyboard Navigation', () => {
    it('opens dropdown on arrow down when closed', async () => {
      render(<CategorySuggestionInput {...defaultProps} />);
      
      const input = screen.getByRole('combobox');
      fireEvent.keyDown(input, { key: 'ArrowDown' });
      
      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });
    });

    it('selects highlighted suggestion on Enter', async () => {
      const mockOnChange = vi.fn();
      render(
        <CategorySuggestionInput
          {...defaultProps}
          onChange={mockOnChange}
        />
      );
      
      const input = screen.getByRole('combobox');
      fireEvent.focus(input);
      
      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });
      
      fireEvent.keyDown(input, { key: 'ArrowDown' });
      fireEvent.keyDown(input, { key: 'Enter' });
      
      expect(mockOnChange).toHaveBeenCalledWith('food');
    });

    it('closes dropdown on Escape', async () => {
      render(<CategorySuggestionInput {...defaultProps} />);
      
      const input = screen.getByRole('combobox');
      fireEvent.focus(input);
      
      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });
      
      fireEvent.keyDown(input, { key: 'Escape' });
      
      await waitFor(() => {
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('has correct ARIA attributes', () => {
      render(<CategorySuggestionInput {...defaultProps} />);
      
      const input = screen.getByRole('combobox');
      expect(input).toHaveAttribute('aria-haspopup', 'listbox');
      expect(input).toHaveAttribute('aria-expanded', 'false');
      expect(input).toHaveAttribute('autoComplete', 'off');
    });

    it('updates aria-expanded when dropdown opens', async () => {
      render(<CategorySuggestionInput {...defaultProps} />);
      
      const input = screen.getByRole('combobox');
      fireEvent.focus(input);
      
      await waitFor(() => {
        expect(input).toHaveAttribute('aria-expanded', 'true');
      });
    });
  });

  describe('Edge Cases', () => {
    it('handles empty suggestions array', () => {
      render(
        <CategorySuggestionInput
          {...defaultProps}
          suggestions={[]}
        />
      );
      
      const input = screen.getByRole('combobox');
      fireEvent.focus(input);
      
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    it('handles very long category names', () => {
      const longCategoryName = 'A'.repeat(100);
      const mockOnChange = vi.fn();
      
      render(
        <CategorySuggestionInput
          {...defaultProps}
          onChange={mockOnChange}
        />
      );
      
      const input = screen.getByRole('combobox');
      fireEvent.change(input, { target: { value: longCategoryName } });
      
      expect(mockOnChange).toHaveBeenCalledWith(longCategoryName);
    });

    it('handles special characters in category names', () => {
      const specialCategory = 'Café & Restaurant - 50% off\!';
      const mockOnChange = vi.fn();
      
      render(
        <CategorySuggestionInput
          {...defaultProps}
          onChange={mockOnChange}
        />
      );
      
      const input = screen.getByRole('combobox');
      fireEvent.change(input, { target: { value: specialCategory } });
      
      expect(mockOnChange).toHaveBeenCalledWith(specialCategory);
    });

    it('maintains custom input value when provided via props', () => {
      render(
        <CategorySuggestionInput
          {...defaultProps}
          value="Custom Category"
        />
      );
      
      const input = screen.getByRole('combobox') as HTMLInputElement;
      expect(input.value).toBe('Custom Category');
    });
  });
});
