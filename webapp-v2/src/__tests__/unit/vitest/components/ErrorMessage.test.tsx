import { ErrorMessage } from '@/components/auth/ErrorMessage.tsx';
import { render, screen } from '@testing-library/preact';
import { describe, expect, it } from 'vitest';

describe('ErrorMessage Component', () => {
    describe('error display', () => {
        it('should render error message when error is provided', () => {
            render(<ErrorMessage error='Something went wrong' />);

            const errorElement = screen.getByRole('alert');
            expect(errorElement).toBeInTheDocument();
            expect(errorElement).toHaveTextContent('Something went wrong');
        });

        it('should have proper semantic attributes for accessibility', () => {
            render(<ErrorMessage error='Validation failed' />);

            const errorElement = screen.getByRole('alert');
            expect(errorElement).toBeInTheDocument();
            expect(errorElement).toHaveTextContent('Validation failed');

            // Error message container should be visible
            expect(errorElement).toBeVisible();
        });

        it('should include error icon in the display', () => {
            render(<ErrorMessage error='Network error occurred' />);

            const errorElement = screen.getByRole('alert');
            expect(errorElement).toBeInTheDocument();

            // Check for the SVG icon (uses size prop, not w-4 h-4 classes)
            const icon = errorElement.querySelector('svg');
            expect(icon).toBeInTheDocument();
            expect(icon).toHaveClass('text-semantic-error/80');
            expect(icon).toHaveAttribute('width', '16');
            expect(icon).toHaveAttribute('height', '16');
        });

        it('should apply proper error styling classes', () => {
            render(<ErrorMessage error='Form validation error' />);

            const errorElement = screen.getByRole('alert');
            expect(errorElement).toHaveClass('text-semantic-error');
            expect(errorElement).toHaveClass('text-sm');
            expect(errorElement).toHaveClass('bg-surface-error');
            expect(errorElement).toHaveClass('border');
            expect(errorElement).toHaveClass('border-border-error');
            expect(errorElement).toHaveClass('rounded-md');
            expect(errorElement).toHaveClass('p-3');
        });

        it('should handle different types of error messages', () => {
            const errorTypes = [
                'Validation error: Email is required',
                'Network error: Failed to connect to server',
                'Authentication error: Invalid credentials',
                'Server error: Internal server error (500)',
                'Permission error: Access denied',
            ];

            errorTypes.forEach((errorMessage) => {
                const { unmount } = render(<ErrorMessage error={errorMessage} />);

                const errorElement = screen.getByRole('alert');
                expect(errorElement).toBeInTheDocument();
                expect(errorElement).toHaveTextContent(errorMessage);

                unmount();
            });
        });

        it('should handle very long error messages', () => {
            const longError =
                'This is a very long error message that might occur when the server returns detailed validation information or when multiple validation errors are combined into a single message for display purposes.';

            render(<ErrorMessage error={longError} />);

            const errorElement = screen.getByRole('alert');
            expect(errorElement).toBeInTheDocument();
            expect(errorElement).toHaveTextContent(longError);
        });

        it('should handle error messages with special characters', () => {
            const specialCharError = 'Error: Invalid characters "special" & <script> tags not allowed!';

            render(<ErrorMessage error={specialCharError} />);

            const errorElement = screen.getByRole('alert');
            expect(errorElement).toBeInTheDocument();
            expect(errorElement).toHaveTextContent(specialCharError);
        });
    });

    describe('null/empty error handling', () => {
        it('should not render when error is null', () => {
            render(<ErrorMessage error={null} />);

            const errorElement = screen.queryByRole('alert');
            expect(errorElement).not.toBeInTheDocument();
        });

        it('should not render when error is undefined', () => {
            render(<ErrorMessage error={undefined as any} />);

            const errorElement = screen.queryByRole('alert');
            expect(errorElement).not.toBeInTheDocument();
        });

        it('should not render when error is empty string', () => {
            render(<ErrorMessage error='' />);

            const errorElement = screen.queryByRole('alert');
            expect(errorElement).not.toBeInTheDocument();
        });

        it('should render when error is whitespace-only (considered truthy)', () => {
            render(<ErrorMessage error='   ' />);

            const errorElement = screen.getByRole('alert');
            expect(errorElement).toBeInTheDocument();
            // The browser/DOM will normalize whitespace, so we just check it renders
            const paragraph = errorElement.querySelector('p');
            expect(paragraph).toBeInTheDocument();
        });
    });

    describe('custom className', () => {
        it('should apply default className when none provided', () => {
            render(<ErrorMessage error='Test error' />);

            const errorElement = screen.getByRole('alert');
            expect(errorElement).toBeInTheDocument();

            // Should have the base classes but no additional custom classes
            expect(errorElement).toHaveClass('text-semantic-error', 'text-sm', 'bg-surface-error');
        });

        it('should append custom className to default classes', () => {
            render(<ErrorMessage error='Test error' className='mt-4 font-bold' />);

            const errorElement = screen.getByRole('alert');
            expect(errorElement).toBeInTheDocument();

            // Should have both default and custom classes
            expect(errorElement).toHaveClass('text-semantic-error', 'text-sm', 'bg-surface-error');
            expect(errorElement).toHaveClass('mt-4', 'font-bold');
        });

        it('should handle empty custom className', () => {
            render(<ErrorMessage error='Test error' className='' />);

            const errorElement = screen.getByRole('alert');
            expect(errorElement).toBeInTheDocument();
            expect(errorElement).toHaveClass('text-semantic-error', 'text-sm', 'bg-surface-error');
        });
    });

    describe('component structure', () => {
        it('should have proper HTML structure', () => {
            render(<ErrorMessage error='Structural test error' />);

            const errorElement = screen.getByRole('alert');
            expect(errorElement).toBeInTheDocument();

            // Should be a div container
            expect(errorElement.tagName).toBe('DIV');

            // Should have flex layout
            const flexContainer = errorElement.querySelector('.flex');
            expect(flexContainer).toBeInTheDocument();

            // Should have icon container
            const iconContainer = flexContainer?.querySelector('.shrink-0');
            expect(iconContainer).toBeInTheDocument();

            // Should have text container
            const textContainer = flexContainer?.querySelector('.ml-2');
            expect(textContainer).toBeInTheDocument();

            // Should have paragraph with error text
            const errorText = textContainer?.querySelector('p');
            expect(errorText).toBeInTheDocument();
            expect(errorText).toHaveTextContent('Structural test error');
        });

        it('should have accessible text content structure', () => {
            render(<ErrorMessage error='Accessibility test error' />);

            const errorElement = screen.getByRole('alert');
            const paragraph = errorElement.querySelector('p');

            expect(paragraph).toBeInTheDocument();
            expect(paragraph).toHaveTextContent('Accessibility test error');
        });
    });

    describe('integration with semantic error patterns', () => {
        it('should follow error display requirements from style guide', () => {
            // Based on webapp-and-style-guide.md requirements
            render(<ErrorMessage error='Form validation error' />);

            const errorElement = screen.getByRole('alert');

            // Should have role='alert' for accessibility
            expect(errorElement).toHaveAttribute('role', 'alert');

            // Should have proper styling to distinguish from financial displays
            expect(errorElement).toHaveClass('text-semantic-error');
            expect(errorElement).toHaveClass('bg-surface-error');
            expect(errorElement).toHaveClass('border-border-error');

            // Should not have financial-amount attributes
            expect(errorElement).not.toHaveAttribute('data-financial-amount');
            expect(errorElement).not.toHaveAttribute('data-balance');
            expect(errorElement).not.toHaveAttribute('data-debt');
        });

        it('should be detectable by E2E error collection systems', () => {
            render(<ErrorMessage error='API connection failed' />);

            const errorElement = screen.getByRole('alert');

            // Should be visible for E2E detection
            expect(errorElement).toBeVisible();

            // Should have role='alert' for semantic detection
            expect(errorElement).toHaveAttribute('role', 'alert');

            // Should have red text styling for visual error identification
            expect(errorElement).toHaveClass('text-semantic-error');
        });
    });
});
