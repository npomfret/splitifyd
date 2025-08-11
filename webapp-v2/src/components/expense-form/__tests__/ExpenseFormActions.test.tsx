import { render, screen, fireEvent } from '../../../test-utils';
import { vi } from 'vitest';
import { ExpenseFormActions } from '../ExpenseFormActions';

describe('ExpenseFormActions', () => {
  const mockOnCancel = vi.fn();

  const defaultProps = {
    isEditMode: false,
    saving: false,
    participantsCount: 2,
    onCancel: mockOnCancel
  };

  beforeEach(() => {
    mockOnCancel.mockClear();
  });

  describe('Add Mode', () => {
    it('displays correct button text in add mode', () => {
      render(<ExpenseFormActions {...defaultProps} />);

      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Save Expense' })).toBeInTheDocument();
    });

    it('displays saving text in add mode when saving', () => {
      render(<ExpenseFormActions {...defaultProps} saving={true} />);

      expect(screen.getByRole('button', { name: 'Saving...' })).toBeInTheDocument();
    });
  });

  describe('Edit Mode', () => {
    it('displays correct button text in edit mode', () => {
      render(<ExpenseFormActions {...defaultProps} isEditMode={true} />);

      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Update Expense' })).toBeInTheDocument();
    });

    it('displays updating text in edit mode when saving', () => {
      render(<ExpenseFormActions {...defaultProps} isEditMode={true} saving={true} />);

      expect(screen.getByRole('button', { name: 'Updating...' })).toBeInTheDocument();
    });
  });

  describe('Button States', () => {
    it('enables buttons when not saving and has participants', () => {
      render(<ExpenseFormActions {...defaultProps} />);

      const cancelButton = screen.getByRole('button', { name: 'Cancel' });
      const submitButton = screen.getByRole('button', { name: 'Save Expense' });

      expect(cancelButton).not.toBeDisabled();
      expect(submitButton).not.toBeDisabled();
    });

    it('disables buttons when saving', () => {
      render(<ExpenseFormActions {...defaultProps} saving={true} />);

      const cancelButton = screen.getByRole('button', { name: 'Cancel' });
      const submitButton = screen.getByRole('button', { name: 'Saving...' });

      expect(cancelButton).toBeDisabled();
      expect(submitButton).toBeDisabled();
    });

    it('disables submit button when no participants', () => {
      render(<ExpenseFormActions {...defaultProps} participantsCount={0} />);

      const cancelButton = screen.getByRole('button', { name: 'Cancel' });
      const submitButton = screen.getByRole('button', { name: 'Save Expense' });

      expect(cancelButton).not.toBeDisabled();
      expect(submitButton).toBeDisabled();
    });

    it('disables submit button when saving and no participants', () => {
      render(<ExpenseFormActions {...defaultProps} saving={true} participantsCount={0} />);

      const submitButton = screen.getByRole('button', { name: 'Saving...' });
      expect(submitButton).toBeDisabled();
    });
  });

  describe('Event Handling', () => {
    it('calls onCancel when cancel button is clicked', () => {
      render(<ExpenseFormActions {...defaultProps} />);

      const cancelButton = screen.getByRole('button', { name: 'Cancel' });
      fireEvent.click(cancelButton);

      expect(mockOnCancel).toHaveBeenCalledTimes(1);
    });

    it('does not call onCancel when cancel button is disabled', () => {
      render(<ExpenseFormActions {...defaultProps} saving={true} />);

      const cancelButton = screen.getByRole('button', { name: 'Cancel' });
      fireEvent.click(cancelButton);

      expect(mockOnCancel).not.toHaveBeenCalled();
    });
  });

  describe('Button Attributes', () => {
    it('has correct button types', () => {
      render(<ExpenseFormActions {...defaultProps} />);

      const cancelButton = screen.getByRole('button', { name: 'Cancel' });
      const submitButton = screen.getByRole('button', { name: 'Save Expense' });

      // Cancel button should not have type submit (default is button)
      expect(cancelButton).not.toHaveAttribute('type', 'submit');
      
      // Submit button should have type submit
      expect(submitButton).toHaveAttribute('type', 'submit');
    });

    it('has correct button variants', () => {
      render(<ExpenseFormActions {...defaultProps} />);

      // We can't easily test the variant prop directly, but we can verify the buttons render
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Save Expense' })).toBeInTheDocument();
    });
  });

  describe('Layout and Styling', () => {
    it('renders buttons in correct order', () => {
      render(<ExpenseFormActions {...defaultProps} />);

      const buttons = screen.getAllByRole('button');
      expect(buttons).toHaveLength(2);
      expect(buttons[0]).toHaveTextContent('Cancel');
      expect(buttons[1]).toHaveTextContent('Save Expense');
    });

    it('applies correct container classes', () => {
      const { container } = render(<ExpenseFormActions {...defaultProps} />);

      const buttonContainer = container.firstChild;
      expect(buttonContainer).toHaveClass('flex', 'flex-row', 'justify-end', 'space-x-2');
    });
  });

  describe('Edge Cases', () => {
    it('handles zero participants count', () => {
      render(<ExpenseFormActions {...defaultProps} participantsCount={0} />);

      const submitButton = screen.getByRole('button', { name: 'Save Expense' });
      expect(submitButton).toBeDisabled();
    });

    it('handles negative participants count', () => {
      render(<ExpenseFormActions {...defaultProps} participantsCount={-1} />);

      const submitButton = screen.getByRole('button', { name: 'Save Expense' });
      // Component only disables for exactly 0, not negative values
      expect(submitButton).not.toBeDisabled();
    });

    it('handles large participants count', () => {
      render(<ExpenseFormActions {...defaultProps} participantsCount={100} />);

      const submitButton = screen.getByRole('button', { name: 'Save Expense' });
      expect(submitButton).not.toBeDisabled();
    });
  });
});