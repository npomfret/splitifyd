import { render, screen, fireEvent } from '../../../test-utils';
import { vi } from 'vitest';
import { PayerSelector } from '../PayerSelector';

describe('PayerSelector', () => {
    const mockUpdateField = vi.fn();

    const mockMembers = [
        { uid: 'user1', displayName: 'Alice Johnson' },
        { uid: 'user2', displayName: 'Bob Smith' },
        { uid: 'user3', displayName: 'Charlie Brown' },
    ];

    const defaultProps = {
        members: mockMembers,
        paidBy: '',
        validationErrors: {},
        updateField: mockUpdateField,
    };

    beforeEach(() => {
        mockUpdateField.mockClear();
    });

    it('renders all members as radio options', () => {
        render(<PayerSelector {...defaultProps} />);

        expect(screen.getByText('Who paid?')).toBeInTheDocument();
        expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
        expect(screen.getByText('Bob Smith')).toBeInTheDocument();
        expect(screen.getByText('Charlie Brown')).toBeInTheDocument();

        // Check radio inputs are present
        const radioInputs = screen.getAllByRole('radio');
        expect(radioInputs).toHaveLength(3);
    });

    it('shows selected member correctly', () => {
        render(<PayerSelector {...defaultProps} paidBy="user2" />);

        const bobRadio = screen.getByDisplayValue('user2');
        expect(bobRadio).toBeChecked();

        const aliceRadio = screen.getByDisplayValue('user1');
        const charlieRadio = screen.getByDisplayValue('user3');
        expect(aliceRadio).not.toBeChecked();
        expect(charlieRadio).not.toBeChecked();
    });

    it('calls updateField when a member is selected', () => {
        render(<PayerSelector {...defaultProps} />);

        const aliceRadio = screen.getByDisplayValue('user1');
        fireEvent.click(aliceRadio);

        expect(mockUpdateField).toHaveBeenCalledWith('paidBy', 'user1');
    });

    it('displays validation error when present', () => {
        const propsWithError = {
            ...defaultProps,
            validationErrors: { paidBy: 'Please select who paid for this expense' },
        };

        render(<PayerSelector {...propsWithError} />);

        expect(screen.getByText('Please select who paid for this expense')).toBeInTheDocument();
        const errorText = screen.getByText('Please select who paid for this expense');
        expect(errorText).toHaveClass('text-red-600');
    });

    it('does not display validation error when not present', () => {
        render(<PayerSelector {...defaultProps} />);

        const errorElement = screen.queryByText(/Please select/);
        expect(errorElement).not.toBeInTheDocument();
    });

    it('handles empty members array gracefully', () => {
        render(<PayerSelector {...defaultProps} members={[]} />);

        expect(screen.getByText('Who paid?')).toBeInTheDocument();
        const radioInputs = screen.queryAllByRole('radio');
        expect(radioInputs).toHaveLength(0);
    });

    it('renders member avatars', () => {
        render(<PayerSelector {...defaultProps} />);

        // Avatar component should be rendered for each member
        // We can't easily test the Avatar component itself, but we can check it's in the DOM
        const memberLabels = screen.getAllByRole('radio').map((radio) => radio.closest('label'));

        expect(memberLabels).toHaveLength(3);
        memberLabels.forEach((label) => {
            expect(label).toBeInTheDocument();
        });
    });

    it('applies correct styling for selected member', () => {
        render(<PayerSelector {...defaultProps} paidBy="user1" />);

        const selectedLabel = screen.getByDisplayValue('user1').closest('label');
        expect(selectedLabel).toHaveClass('border-blue-500', 'bg-blue-50');
    });

    it('applies correct styling for unselected members', () => {
        render(<PayerSelector {...defaultProps} paidBy="user1" />);

        const unselectedLabel = screen.getByDisplayValue('user2').closest('label');
        expect(unselectedLabel).toHaveClass('border-gray-300');
        expect(unselectedLabel).not.toHaveClass('border-blue-500', 'bg-blue-50');
    });

    it('includes required asterisk in header', () => {
        render(<PayerSelector {...defaultProps} />);

        const asterisk = screen.getByText('*');
        expect(asterisk).toBeInTheDocument();
        expect(asterisk).toHaveClass('text-red-500');
    });

    it('handles member selection via label click', () => {
        render(<PayerSelector {...defaultProps} />);

        const bobLabel = screen.getByText('Bob Smith').closest('label');
        fireEvent.click(bobLabel!);

        expect(mockUpdateField).toHaveBeenCalledWith('paidBy', 'user2');
    });
});
