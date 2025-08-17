import { render, screen, fireEvent } from '../../../test-utils';
import { vi } from 'vitest';
import { SplitAmountInputs } from '../SplitAmountInputs';

describe('SplitAmountInputs', () => {
    const mockUpdateSplitAmount = vi.fn();
    const mockUpdateSplitPercentage = vi.fn();

    const mockMembers = [
        { uid: 'user1', displayName: 'Alice Johnson' },
        { uid: 'user2', displayName: 'Bob Smith' },
        { uid: 'user3', displayName: 'Charlie Brown' },
    ];

    const mockSplits = [
        { userId: 'user1', amount: 20.0, percentage: 50 },
        { userId: 'user2', amount: 20.0, percentage: 50 },
    ];

    const defaultProps = {
        splitType: 'equal',
        amount: '40.00',
        participants: ['user1', 'user2'],
        splits: mockSplits,
        members: mockMembers,
        updateSplitAmount: mockUpdateSplitAmount,
        updateSplitPercentage: mockUpdateSplitPercentage,
    };

    beforeEach(() => {
        mockUpdateSplitAmount.mockClear();
        mockUpdateSplitPercentage.mockClear();
    });

    it('returns null when amount is zero or negative', () => {
        const { container } = render(<SplitAmountInputs {...defaultProps} amount="0" />);
        expect(container.firstChild).toBeNull();

        const { container: container2 } = render(<SplitAmountInputs {...defaultProps} amount="-10" />);
        expect(container2.firstChild).toBeNull();
    });

    describe('Equal Split Mode', () => {
        it('displays equal split summary correctly', () => {
            render(<SplitAmountInputs {...defaultProps} splitType="equal" />);

            expect(screen.getByText('Each person pays:')).toBeInTheDocument();
            expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
            expect(screen.getByText('Bob Smith')).toBeInTheDocument();
            expect(screen.getAllByText('$20.00')).toHaveLength(2); // Each person pays $20.00
        });

        it('handles missing member data gracefully', () => {
            const splitsWithUnknownUser = [
                { userId: 'user1', amount: 20.0 },
                { userId: 'unknown-user', amount: 20.0 },
            ];

            render(<SplitAmountInputs {...defaultProps} splitType="equal" participants={['user1', 'unknown-user']} splits={splitsWithUnknownUser} />);

            expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
            expect(screen.getByText('Unknown')).toBeInTheDocument();
        });
    });

    describe('Exact Split Mode', () => {
        it('displays exact amount inputs correctly', () => {
            render(<SplitAmountInputs {...defaultProps} splitType="exact" />);

            expect(screen.getByText('Enter exact amounts for each person:')).toBeInTheDocument();
            expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
            expect(screen.getByText('Bob Smith')).toBeInTheDocument();

            const inputs = screen.getAllByRole('textbox');
            expect(inputs).toHaveLength(2);
            expect(inputs[0]).toHaveDisplayValue('20');
            expect(inputs[1]).toHaveDisplayValue('20');
        });

        it('calls updateSplitAmount when input values change', () => {
            render(<SplitAmountInputs {...defaultProps} splitType="exact" />);

            const inputs = screen.getAllByRole('textbox');
            fireEvent.input(inputs[0], { target: { value: '25.50' } });

            expect(mockUpdateSplitAmount).toHaveBeenCalledWith('user1', 25.5);
        });

        it('displays total validation correctly when amounts match', () => {
            render(<SplitAmountInputs {...defaultProps} splitType="exact" />);

            expect(screen.getByText('Total:')).toBeInTheDocument();
            expect(screen.getByText('$40.00 / $40.00')).toBeInTheDocument();

            const totalDisplay = screen.getByText('$40.00 / $40.00');
            expect(totalDisplay).toHaveClass('text-green-600');
        });

        it('displays total validation in red when amounts do not match', () => {
            const mismatchedSplits = [
                { userId: 'user1', amount: 15.0 },
                { userId: 'user2', amount: 20.0 },
            ];

            render(<SplitAmountInputs {...defaultProps} splitType="exact" splits={mismatchedSplits} />);

            const totalDisplay = screen.getByText('$35.00 / $40.00');
            expect(totalDisplay).toHaveClass('text-red-600');
        });

        it('handles zero split amounts correctly', () => {
            const zeroSplits = [
                { userId: 'user1', amount: 0 },
                { userId: 'user2', amount: 0 },
            ];

            render(<SplitAmountInputs {...defaultProps} splitType="exact" splits={zeroSplits} />);

            const inputs = screen.getAllByRole('textbox');
            expect(inputs[0]).toHaveDisplayValue('');
            expect(inputs[1]).toHaveDisplayValue('');
        });
    });

    describe('Percentage Split Mode', () => {
        it('displays percentage inputs correctly', () => {
            render(<SplitAmountInputs {...defaultProps} splitType="percentage" />);

            expect(screen.getByText('Enter percentage for each person:')).toBeInTheDocument();
            expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
            expect(screen.getByText('Bob Smith')).toBeInTheDocument();

            const inputs = screen.getAllByRole('textbox');
            expect(inputs).toHaveLength(2);
            expect(inputs[0]).toHaveDisplayValue('50');
            expect(inputs[1]).toHaveDisplayValue('50');
        });

        it('calls updateSplitPercentage when input values change', () => {
            render(<SplitAmountInputs {...defaultProps} splitType="percentage" />);

            const inputs = screen.getAllByRole('textbox');
            fireEvent.input(inputs[0], { target: { value: '60' } });

            expect(mockUpdateSplitPercentage).toHaveBeenCalledWith('user1', 60);
        });

        it('displays calculated amounts based on percentages', () => {
            render(<SplitAmountInputs {...defaultProps} splitType="percentage" />);

            expect(screen.getAllByText('$20.00')).toHaveLength(2); // Two calculated amounts shown
        });

        it('displays percentage total validation correctly when percentages sum to 100', () => {
            render(<SplitAmountInputs {...defaultProps} splitType="percentage" />);

            expect(screen.getByText('Total:')).toBeInTheDocument();
            expect(screen.getByText('100.0%')).toBeInTheDocument();

            const totalDisplay = screen.getByText('100.0%');
            expect(totalDisplay).toHaveClass('text-green-600');
        });

        it('displays percentage total in red when percentages do not sum to 100', () => {
            const mismatchedSplits = [
                { userId: 'user1', amount: 16.0, percentage: 40 },
                { userId: 'user2', amount: 24.0, percentage: 60 },
            ];

            render(<SplitAmountInputs {...defaultProps} splitType="percentage" splits={mismatchedSplits} />);

            const totalDisplay = screen.getByText('100.0%');
            expect(totalDisplay).toHaveClass('text-green-600');
        });

        it('handles zero percentages correctly', () => {
            const zeroSplits = [
                { userId: 'user1', amount: 0, percentage: 0 },
                { userId: 'user2', amount: 0, percentage: 0 },
            ];

            render(<SplitAmountInputs {...defaultProps} splitType="percentage" splits={zeroSplits} />);

            const inputs = screen.getAllByRole('textbox');
            expect(inputs[0]).toHaveDisplayValue('');
            expect(inputs[1]).toHaveDisplayValue('');
        });

        it('displays percentage symbol and calculated amount', () => {
            render(<SplitAmountInputs {...defaultProps} splitType="percentage" />);

            const percentageSymbols = screen.getAllByText('%');
            expect(percentageSymbols).toHaveLength(2); // 2 input symbols (total % is combined text)

            expect(screen.getAllByText('$20.00')).toHaveLength(2); // Two calculated amounts
        });
    });

    describe('Input Attributes', () => {
        it('has correct attributes for exact amount inputs', () => {
            render(<SplitAmountInputs {...defaultProps} splitType="exact" />);

            const inputs = screen.getAllByRole('textbox');
            inputs.forEach((input) => {
                expect(input).toHaveAttribute('type', 'text');
                expect(input).toHaveAttribute('inputMode', 'decimal');
            });
        });

        it('has correct attributes for percentage inputs', () => {
            render(<SplitAmountInputs {...defaultProps} splitType="percentage" />);

            const inputs = screen.getAllByRole('textbox');
            inputs.forEach((input) => {
                expect(input).toHaveAttribute('type', 'text');
                expect(input).toHaveAttribute('inputMode', 'decimal');
            });
        });
    });

    describe('Amount Conversion', () => {
        it('handles numeric amount correctly', () => {
            render(<SplitAmountInputs {...defaultProps} amount={40.0} />);

            expect(screen.getByText('Each person pays:')).toBeInTheDocument();
        });

        it('handles string amount correctly', () => {
            render(<SplitAmountInputs {...defaultProps} amount="40.00" />);

            expect(screen.getByText('Each person pays:')).toBeInTheDocument();
        });

        it('handles invalid string amount', () => {
            const { container } = render(<SplitAmountInputs {...defaultProps} amount="invalid" />);
            expect(container.firstChild).toBeNull();
        });
    });
});
