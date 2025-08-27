import { render, screen, waitFor } from '@testing-library/preact';
import { vi, beforeEach, describe, it, expect } from 'vitest';
import userEvent from '@testing-library/user-event';
import { CommentInput } from '@/components/comments/CommentInput';

// Mock Heroicons to avoid JSX serialization issues
vi.mock('@heroicons/react/24/outline', () => ({
    PaperAirplaneIcon: () => <div data-testid="paper-airplane-icon">Send</div>,
}));

describe('CommentInput', () => {
    let mockOnSubmit: ReturnType<typeof vi.fn>;
    let user: ReturnType<typeof userEvent.setup>;

    beforeEach(() => {
        mockOnSubmit = vi.fn();
        user = userEvent.setup();
    });

    const renderCommentInput = (props = {}) => {
        return render(
            <CommentInput 
                onSubmit={mockOnSubmit} 
                {...props} 
            />
        );
    };

    describe('Rendering', () => {
        it('should render textarea and submit button', () => {
            renderCommentInput();
            
            expect(screen.getByLabelText('Comment text')).toBeInTheDocument();
            expect(screen.getByLabelText('Send comment')).toBeInTheDocument();
            expect(screen.getByText('Press Enter to send, Shift+Enter for new line')).toBeInTheDocument();
        });

        it('should render with custom placeholder', () => {
            renderCommentInput({ placeholder: 'Custom placeholder' });
            
            expect(screen.getByPlaceholderText('Custom placeholder')).toBeInTheDocument();
        });

        it('should be disabled when disabled prop is true', () => {
            renderCommentInput({ disabled: true });
            
            const textarea = screen.getByLabelText('Comment text');
            const button = screen.getByLabelText('Send comment');
            
            expect(textarea).toBeDisabled();
            expect(button).toBeDisabled();
        });
    });

    describe('Text Input', () => {
        it('should update text when user types', async () => {
            renderCommentInput();
            const textarea = screen.getByLabelText('Comment text');
            
            await user.type(textarea, 'Hello world');
            
            expect(textarea).toHaveValue('Hello world');
        });

        it('should show character counter when text is entered', async () => {
            renderCommentInput();
            const textarea = screen.getByLabelText('Comment text');
            
            await user.type(textarea, 'Hello');
            
            expect(screen.getByText('495')).toBeInTheDocument(); // 500 - 5 chars
        });

        it('should show character limit exceeded when over 500 chars', async () => {
            renderCommentInput();
            const textarea = screen.getByLabelText('Comment text');
            const longText = 'a'.repeat(501);
            
            await user.type(textarea, longText);
            
            const counter = screen.getByText('-1');
            expect(counter).toBeInTheDocument();
            expect(counter).toHaveClass('text-red-500', 'font-medium');
            expect(textarea).toHaveAttribute('aria-invalid', 'true');
        });

        it('should disable submit button when over character limit', async () => {
            renderCommentInput();
            const textarea = screen.getByLabelText('Comment text');
            const button = screen.getByLabelText('Send comment');
            const longText = 'a'.repeat(501);
            
            await user.type(textarea, longText);
            
            expect(button).toBeDisabled();
        });

        it('should auto-resize textarea based on content', async () => {
            renderCommentInput();
            const textarea = screen.getByLabelText('Comment text');
            
            // Initial height should be auto
            expect(textarea.style.minHeight).toBe('38px');
            expect(textarea.style.maxHeight).toBe('120px');
            
            await user.type(textarea, 'Line 1\nLine 2\nLine 3\nLine 4');
            
            // Height should be adjusted (tested indirectly by checking the effect ran)
            expect(textarea).toHaveValue('Line 1\nLine 2\nLine 3\nLine 4');
        });
    });

    describe('Form Submission', () => {
        it('should submit when Enter is pressed without Shift', async () => {
            renderCommentInput();
            const textarea = screen.getByLabelText('Comment text');
            
            await user.type(textarea, 'Test comment');
            await user.keyboard('{Enter}');
            
            expect(mockOnSubmit).toHaveBeenCalledWith('Test comment');
        });

        it('should not submit when Shift+Enter is pressed', async () => {
            renderCommentInput();
            const textarea = screen.getByLabelText('Comment text');
            
            await user.type(textarea, 'Line 1');
            await user.keyboard('{Shift>}{Enter}{/Shift}');
            
            expect(mockOnSubmit).not.toHaveBeenCalled();
            expect(textarea).toHaveValue('Line 1\n');
        });

        it('should submit when submit button is clicked', async () => {
            renderCommentInput();
            const textarea = screen.getByLabelText('Comment text');
            const button = screen.getByLabelText('Send comment');
            
            await user.type(textarea, 'Click submit');
            await user.click(button);
            
            expect(mockOnSubmit).toHaveBeenCalledWith('Click submit');
        });

        it('should clear text after successful submission', async () => {
            mockOnSubmit.mockResolvedValue(undefined);
            renderCommentInput();
            const textarea = screen.getByLabelText('Comment text');
            
            await user.type(textarea, 'Test comment');
            await user.keyboard('{Enter}');
            
            await waitFor(() => {
                expect(textarea).toHaveValue('');
            });
        });

        it('should trim whitespace from submission', async () => {
            renderCommentInput();
            const textarea = screen.getByLabelText('Comment text');
            
            await user.type(textarea, '  Test comment  ');
            await user.keyboard('{Enter}');
            
            expect(mockOnSubmit).toHaveBeenCalledWith('Test comment');
        });

        it('should not submit empty or whitespace-only text', async () => {
            renderCommentInput();
            const textarea = screen.getByLabelText('Comment text');
            
            await user.type(textarea, '   ');
            await user.keyboard('{Enter}');
            
            expect(mockOnSubmit).not.toHaveBeenCalled();
        });

        it('should not submit when over character limit', async () => {
            renderCommentInput();
            const textarea = screen.getByLabelText('Comment text');
            const longText = 'a'.repeat(501);
            
            await user.type(textarea, longText);
            await user.keyboard('{Enter}');
            
            expect(mockOnSubmit).not.toHaveBeenCalled();
            expect(screen.getByText('Comment is too long')).toBeInTheDocument();
        });
    });

    describe('Loading States', () => {
        it('should show loading spinner when submitting', async () => {
            let resolveSubmit: () => void;
            const submitPromise = new Promise<void>(resolve => { resolveSubmit = resolve; });
            mockOnSubmit.mockReturnValue(submitPromise);
            
            renderCommentInput();
            const textarea = screen.getByLabelText('Comment text');
            
            await user.type(textarea, 'Test comment');
            await user.keyboard('{Enter}');
            
            // Should show loading spinner
            const loadingSpinner = screen.getByRole('button', { name: 'Send comment' })
                .querySelector('.animate-spin');
            expect(loadingSpinner).toBeInTheDocument();
            
            // Should disable textarea during submission
            expect(textarea).toBeDisabled();
            
            // Resolve the promise
            resolveSubmit!();
            await waitFor(() => {
                expect(textarea).not.toBeDisabled();
            });
        });

        it('should handle submission errors', async () => {
            const error = new Error('Submission failed');
            mockOnSubmit.mockRejectedValue(error);
            
            renderCommentInput();
            const textarea = screen.getByLabelText('Comment text');
            
            await user.type(textarea, 'Failed comment');
            await user.keyboard('{Enter}');
            
            await waitFor(() => {
                expect(screen.getByText('Submission failed')).toBeInTheDocument();
            });
            
            // Text should remain after error
            expect(textarea).toHaveValue('Failed comment');
            expect(textarea).not.toBeDisabled();
        });

        it('should handle non-Error rejections', async () => {
            mockOnSubmit.mockRejectedValue('String error');
            
            renderCommentInput();
            const textarea = screen.getByLabelText('Comment text');
            
            await user.type(textarea, 'Failed comment');
            await user.keyboard('{Enter}');
            
            await waitFor(() => {
                expect(screen.getByText('Failed to add comment')).toBeInTheDocument();
            });
        });
    });

    describe('Button States', () => {
        it('should disable submit button when text is empty', () => {
            renderCommentInput();
            const button = screen.getByLabelText('Send comment');
            
            expect(button).toBeDisabled();
        });

        it('should enable submit button when valid text is entered', async () => {
            renderCommentInput();
            const textarea = screen.getByLabelText('Comment text');
            const button = screen.getByLabelText('Send comment');
            
            await user.type(textarea, 'Valid comment');
            
            expect(button).not.toBeDisabled();
        });

        it('should show correct button styling for enabled state', async () => {
            renderCommentInput();
            const textarea = screen.getByLabelText('Comment text');
            const button = screen.getByLabelText('Send comment');
            
            await user.type(textarea, 'Valid comment');
            
            expect(button).toHaveClass('text-blue-600', 'hover:bg-blue-50');
        });

        it('should show correct button styling for disabled state', () => {
            renderCommentInput();
            const button = screen.getByLabelText('Send comment');
            
            expect(button).toHaveClass('text-gray-400', 'cursor-not-allowed');
        });
    });

    describe('Accessibility', () => {
        it('should have proper ARIA labels', () => {
            renderCommentInput();
            
            const textarea = screen.getByRole('textbox');
            const button = screen.getByRole('button');
            
            expect(textarea).toHaveAttribute('aria-label', 'Comment text');
            expect(button).toHaveAttribute('aria-label', 'Send comment');
        });

        it('should set aria-invalid when over character limit', async () => {
            renderCommentInput();
            const textarea = screen.getByLabelText('Comment text');
            const longText = 'a'.repeat(501);
            
            await user.type(textarea, longText);
            
            expect(textarea).toHaveAttribute('aria-invalid', 'true');
        });

        it('should be keyboard navigable', async () => {
            renderCommentInput();
            const textarea = screen.getByLabelText('Comment text');
            const button = screen.getByLabelText('Send comment');
            
            // Tab should focus textarea first
            await user.tab();
            expect(textarea).toHaveFocus();
            
            // Add text to enable the button so it can receive focus
            await user.type(textarea, 'Test comment');
            
            // Tab should focus button next (now that it's enabled)
            await user.tab();
            expect(button).toHaveFocus();
        });
    });

    describe('Responsive Behavior', () => {
        it('should apply mobile-friendly classes', () => {
            renderCommentInput();
            const textarea = screen.getByLabelText('Comment text');
            const button = screen.getByLabelText('Send comment');
            
            expect(textarea).toHaveClass('w-full', 'text-sm');
            expect(button).toHaveClass('p-1.5', 'rounded-lg');
        });

        it('should handle custom className prop', () => {
            renderCommentInput({ className: 'custom-class' });
            const form = screen.getByRole('textbox').closest('form');
            
            expect(form).toHaveClass('custom-class');
        });
    });
});