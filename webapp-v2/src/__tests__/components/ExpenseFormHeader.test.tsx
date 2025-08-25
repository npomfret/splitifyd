import { render, screen, fireEvent } from '../../test-utils';
import { vi } from 'vitest';
import { ExpenseFormHeader } from '../../components/expense-form/ExpenseFormHeader';
import translation from '../../locales/en/translation.json' with { type: 'json' };

// Mock useTranslation hook
vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => {
            const keys = key.split('.');
            let result: any = translation;
            for (const k of keys) {
                result = result[k];
            }
            return result || key;
        },
    }),
}));

describe('ExpenseFormHeader', () => {
    const mockOnCancel = vi.fn();

    beforeEach(() => {
        mockOnCancel.mockClear();
    });

    it('displays add mode header correctly', () => {
        render(<ExpenseFormHeader isEditMode={false} groupName="Trip to Paris" onCancel={mockOnCancel} />);

        expect(screen.getByText(translation.expenseFormHeader.addExpense)).toBeInTheDocument();
        expect(screen.getByText('Trip to Paris')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: translation.expenseFormHeader.cancel })).toBeInTheDocument();
    });

    it('displays edit mode header correctly', () => {
        render(<ExpenseFormHeader isEditMode={true} groupName="Weekend Getaway" onCancel={mockOnCancel} />);

        expect(screen.getByText(translation.expenseFormHeader.editExpense)).toBeInTheDocument();
        expect(screen.getByText('Weekend Getaway')).toBeInTheDocument();
    });

    it('calls onCancel when cancel button is clicked', () => {
        render(<ExpenseFormHeader isEditMode={false} groupName="Test Group" onCancel={mockOnCancel} />);

        const cancelButton = screen.getByRole('button', { name: translation.expenseFormHeader.cancel });
        fireEvent.click(cancelButton);

        expect(mockOnCancel).toHaveBeenCalledTimes(1);
    });

    it('handles long group names gracefully', () => {
        const longGroupName = 'This is a very long group name that might overflow the layout';

        render(<ExpenseFormHeader isEditMode={false} groupName={longGroupName} onCancel={mockOnCancel} />);

        expect(screen.getByText(longGroupName)).toBeInTheDocument();
    });

    it('renders with correct styling classes', () => {
        const { container } = render(<ExpenseFormHeader isEditMode={false} groupName="Test Group" onCancel={mockOnCancel} />);

        const headerContainer = container.querySelector('.bg-white');
        expect(headerContainer).toBeInTheDocument();

        const title = screen.getByText(translation.expenseFormHeader.addExpense);
        expect(title).toHaveClass('text-2xl', 'font-bold');

        const groupName = screen.getByText('Test Group');
        expect(groupName).toHaveClass('text-sm', 'text-gray-600');
    });
});
