import { render, screen, waitFor } from '@testing-library/preact';
import { vi, beforeEach, describe, it, expect } from 'vitest';
import userEvent from '@testing-library/user-event';
import { CommentInput } from '@/components/comments/CommentInput';

// Mock Heroicons to avoid JSX serialization issues
vi.mock('@heroicons/react/24/outline', () => ({
    PaperAirplaneIcon: () => <div data-testid="paper-airplane-icon">Send</div>,
}));

describe('CommentInput - Core Functionality', () => {
    let mockOnSubmit: ReturnType<typeof vi.fn>;
    let user: ReturnType<typeof userEvent.setup>;

    beforeEach(() => {
        mockOnSubmit = vi.fn();
        user = userEvent.setup();
    });

    const renderCommentInput = (props = {}) => {
        return render(<CommentInput onSubmit={mockOnSubmit} {...props} />);
    };

    describe('User Interactions', () => {
        it('should render form elements and allow text input', async () => {
            renderCommentInput();

            const textarea = screen.getByLabelText('Comment text');
            const button = screen.getByLabelText('Send comment');

            expect(textarea).toBeInTheDocument();
            expect(button).toBeInTheDocument();

            await user.type(textarea, 'Test comment');
            expect(textarea).toHaveValue('Test comment');
        });

        it('should enforce character limit and disable submit when exceeded', async () => {
            renderCommentInput();
            const textarea = screen.getByLabelText('Comment text');
            const button = screen.getByLabelText('Send comment');
            const longText = 'a'.repeat(501);

            await user.type(textarea, longText);

            expect(screen.getByText('-1')).toBeInTheDocument(); // Over limit indicator
            expect(button).toBeDisabled();
            expect(textarea).toHaveAttribute('aria-invalid', 'true');
        });

        it('should handle disabled state', () => {
            renderCommentInput({ disabled: true });

            expect(screen.getByLabelText('Comment text')).toBeDisabled();
            expect(screen.getByLabelText('Send comment')).toBeDisabled();
        });

        it('should submit via Enter key and button click', async () => {
            renderCommentInput();
            const textarea = screen.getByLabelText('Comment text');
            const button = screen.getByLabelText('Send comment');

            // Test Enter key submission
            await user.type(textarea, 'Test comment');
            await user.keyboard('{Enter}');

            expect(mockOnSubmit).toHaveBeenCalledWith('Test comment');

            // Test button click (need to clear and add new text)
            mockOnSubmit.mockClear();
            await user.clear(textarea);
            await user.type(textarea, 'Button click test');
            await user.click(button);

            expect(mockOnSubmit).toHaveBeenCalledWith('Button click test');
        });

        it('should handle Shift+Enter for new lines without submitting', async () => {
            renderCommentInput();
            const textarea = screen.getByLabelText('Comment text');

            await user.type(textarea, 'Line 1');
            await user.keyboard('{Shift>}{Enter}{/Shift}');

            expect(mockOnSubmit).not.toHaveBeenCalled();
            expect(textarea).toHaveValue('Line 1\n');
        });

        it('should handle loading and error states', async () => {
            const error = new Error('Submission failed');
            mockOnSubmit.mockRejectedValueOnce(error);

            renderCommentInput();
            const textarea = screen.getByLabelText('Comment text');

            await user.type(textarea, 'Failed comment');
            await user.keyboard('{Enter}');

            await waitFor(() => {
                expect(screen.getByText('Submission failed')).toBeInTheDocument();
            });

            expect(textarea).toHaveValue('Failed comment');
        });

        it('should validate text input and prevent empty submissions', async () => {
            renderCommentInput();
            const textarea = screen.getByLabelText('Comment text');

            // Empty text should not submit
            await user.keyboard('{Enter}');
            expect(mockOnSubmit).not.toHaveBeenCalled();

            // Whitespace only should not submit
            await user.type(textarea, '   ');
            await user.keyboard('{Enter}');
            expect(mockOnSubmit).not.toHaveBeenCalled();

            // Valid text should trim and submit
            await user.clear(textarea);
            await user.type(textarea, '  Valid comment  ');
            await user.keyboard('{Enter}');
            expect(mockOnSubmit).toHaveBeenCalledWith('Valid comment');
        });
    });
});
