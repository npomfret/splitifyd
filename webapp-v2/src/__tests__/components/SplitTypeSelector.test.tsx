import { render, screen, fireEvent } from '../../test-utils';
import { vi } from 'vitest';
import { SplitTypeSelector } from '../../components/expense-form/SplitTypeSelector';

describe('SplitTypeSelector', () => {
    const mockUpdateField = vi.fn();

    const defaultProps = {
        splitType: 'equal',
        updateField: mockUpdateField,
    };

    beforeEach(() => {
        mockUpdateField.mockClear();
    });

    it('renders all split type options', () => {
        render(<SplitTypeSelector {...defaultProps} />);

        expect(screen.getByText('How to split')).toBeInTheDocument();
        expect(screen.getByText('Equal')).toBeInTheDocument();
        expect(screen.getByText('Exact amounts')).toBeInTheDocument();
        expect(screen.getByText('Percentage')).toBeInTheDocument();

        const radioInputs = screen.getAllByRole('radio');
        expect(radioInputs).toHaveLength(3);
    });

    it('shows equal split as selected by default', () => {
        render(<SplitTypeSelector {...defaultProps} />);

        const equalRadio = screen.getByDisplayValue('equal');
        const exactRadio = screen.getByDisplayValue('exact');
        const percentageRadio = screen.getByDisplayValue('percentage');

        expect(equalRadio).toBeChecked();
        expect(exactRadio).not.toBeChecked();
        expect(percentageRadio).not.toBeChecked();
    });

    it('shows exact split as selected when splitType is exact', () => {
        render(<SplitTypeSelector {...defaultProps} splitType="exact" />);

        const equalRadio = screen.getByDisplayValue('equal');
        const exactRadio = screen.getByDisplayValue('exact');
        const percentageRadio = screen.getByDisplayValue('percentage');

        expect(equalRadio).not.toBeChecked();
        expect(exactRadio).toBeChecked();
        expect(percentageRadio).not.toBeChecked();
    });

    it('shows percentage split as selected when splitType is percentage', () => {
        render(<SplitTypeSelector {...defaultProps} splitType="percentage" />);

        const equalRadio = screen.getByDisplayValue('equal');
        const exactRadio = screen.getByDisplayValue('exact');
        const percentageRadio = screen.getByDisplayValue('percentage');

        expect(equalRadio).not.toBeChecked();
        expect(exactRadio).not.toBeChecked();
        expect(percentageRadio).toBeChecked();
    });

    it('calls updateField when equal option is selected', () => {
        render(<SplitTypeSelector {...defaultProps} splitType="exact" />);

        const equalRadio = screen.getByDisplayValue('equal');
        fireEvent.change(equalRadio);

        expect(mockUpdateField).toHaveBeenCalledWith('splitType', 'equal');
    });

    it('calls updateField when exact option is selected', () => {
        render(<SplitTypeSelector {...defaultProps} />);

        const exactRadio = screen.getByDisplayValue('exact');
        fireEvent.change(exactRadio);

        expect(mockUpdateField).toHaveBeenCalledWith('splitType', 'exact');
    });

    it('calls updateField when percentage option is selected', () => {
        render(<SplitTypeSelector {...defaultProps} />);

        const percentageRadio = screen.getByDisplayValue('percentage');
        fireEvent.change(percentageRadio);

        expect(mockUpdateField).toHaveBeenCalledWith('splitType', 'percentage');
    });

    it('calls updateField when labels are clicked', () => {
        render(<SplitTypeSelector {...defaultProps} />);

        const exactLabel = screen.getByText('Exact amounts').closest('label');
        fireEvent.click(exactLabel!);

        expect(mockUpdateField).toHaveBeenCalledWith('splitType', 'exact');
    });

    it('applies correct styling for selected option', () => {
        render(<SplitTypeSelector {...defaultProps} splitType="exact" />);

        const selectedLabel = screen.getByDisplayValue('exact').closest('label');
        expect(selectedLabel).toHaveClass('border-blue-500', 'bg-blue-50');
    });

    it('applies correct styling for unselected options', () => {
        render(<SplitTypeSelector {...defaultProps} splitType="exact" />);

        const unselectedLabel = screen.getByDisplayValue('equal').closest('label');
        expect(unselectedLabel).toHaveClass('border-gray-300');
        expect(unselectedLabel).not.toHaveClass('border-blue-500', 'bg-blue-50');
    });

    it('has proper radio button grouping', () => {
        render(<SplitTypeSelector {...defaultProps} />);

        const radioInputs = screen.getAllByRole('radio');
        radioInputs.forEach((radio) => {
            expect(radio).toHaveAttribute('name', 'splitType');
        });
    });

    it('renders with grid layout', () => {
        const { container } = render(<SplitTypeSelector {...defaultProps} />);

        const gridContainer = container.querySelector('.grid-cols-3');
        expect(gridContainer).toBeInTheDocument();
    });

    it('has proper accessibility attributes', () => {
        render(<SplitTypeSelector {...defaultProps} />);

        const radioInputs = screen.getAllByRole('radio');
        radioInputs.forEach((radio) => {
            expect(radio).toHaveAttribute('type', 'radio');
            expect(radio).toHaveAttribute('name', 'splitType');
        });
    });

    it('handles unknown splitType gracefully', () => {
        render(<SplitTypeSelector {...defaultProps} splitType={'unknown' as any} />);

        const radioInputs = screen.getAllByRole('radio');
        radioInputs.forEach((radio) => {
            expect(radio).not.toBeChecked();
        });
    });
});
