import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/preact';
import { Input } from '@/components/ui/Input.tsx';

describe('Input Component', () => {
    describe('basic rendering', () => {
        it('should render input with default props', () => {
            render(<Input />);

            const input = screen.getByRole('textbox');
            expect(input).toBeInTheDocument();
            expect(input).toHaveAttribute('type', 'text');
            expect(input).toHaveValue('');
        });

        it('should render with specified type', () => {
            render(<Input type="email" />);

            const input = screen.getByRole('textbox');
            expect(input).toBeInTheDocument();
            expect(input).toHaveAttribute('type', 'email');
        });

        it('should render password input', () => {
            render(<Input type="password" />);

            // Password inputs don't have role="textbox"
            const input = screen.getByDisplayValue('');
            expect(input).toBeInTheDocument();
            expect(input).toHaveAttribute('type', 'password');
        });

        it('should render number input', () => {
            render(<Input type="number" />);

            const input = screen.getByRole('spinbutton');
            expect(input).toBeInTheDocument();
            expect(input).toHaveAttribute('type', 'number');
        });
    });

    describe('label and accessibility', () => {
        it('should render with label', () => {
            render(<Input label="Email Address" />);

            const label = screen.getByLabelText('Email Address');
            expect(label).toBeInTheDocument();

            const labelElement = screen.getByText('Email Address');
            expect(labelElement).toBeInTheDocument();
            expect(labelElement.tagName).toBe('LABEL');
        });

        it('should show required indicator when required', () => {
            render(<Input label="Email Address" required />);

            const requiredIndicator = screen.getByTestId('required-indicator');
            expect(requiredIndicator).toBeInTheDocument();
            expect(requiredIndicator).toHaveTextContent('common.required');
            expect(requiredIndicator).toHaveClass('text-red-500', 'ml-1');

            const input = screen.getByRole('textbox');
            expect(input).toBeRequired();
        });

        it('should not show required indicator when not required', () => {
            render(<Input label="Optional Field" required={false} />);

            const requiredIndicator = screen.queryByTestId('required-indicator');
            expect(requiredIndicator).not.toBeInTheDocument();

            const input = screen.getByRole('textbox');
            expect(input).not.toBeRequired();
        });

        it('should generate unique id when not provided', () => {
            const { rerender } = render(<Input label="Field 1" />);
            const input1 = screen.getByRole('textbox');
            const id1 = input1.getAttribute('id');

            rerender(<Input label="Field 2" />);
            const input2 = screen.getByRole('textbox');
            const id2 = input2.getAttribute('id');

            expect(id1).toBeTruthy();
            expect(id2).toBeTruthy();
            expect(id1).not.toBe(id2);
        });

        it('should use provided id', () => {
            render(<Input label="Custom Field" id="custom-id" />);

            const input = screen.getByRole('textbox');
            expect(input).toHaveAttribute('id', 'custom-id');

            const label = screen.getByText('Custom Field');
            expect(label).toHaveAttribute('for', 'custom-id');
        });

        it('should use name as id fallback', () => {
            render(<Input label="Named Field" name="field-name" />);

            const input = screen.getByRole('textbox');
            expect(input).toHaveAttribute('id', 'field-name');
            expect(input).toHaveAttribute('name', 'field-name');

            const label = screen.getByText('Named Field');
            expect(label).toHaveAttribute('for', 'field-name');
        });
    });

    describe('validation and error handling', () => {
        it('should display error message when error prop is provided', () => {
            render(<Input label="Username" error="Username is required" />);

            const errorMessage = screen.getByTestId('input-error-message');
            expect(errorMessage).toBeInTheDocument();
            expect(errorMessage).toHaveTextContent('Username is required');
            expect(errorMessage).toHaveClass('text-red-600');
            expect(errorMessage).toHaveAttribute('role', 'alert');
        });

        it('should not display error message when error prop is not provided', () => {
            render(<Input label="Username" />);

            const errorMessage = screen.queryByTestId('input-error-message');
            expect(errorMessage).not.toBeInTheDocument();
        });

        it('should apply error styling when error is present', () => {
            render(<Input label="Email" error="Invalid email format" />);

            const input = screen.getByRole('textbox');
            expect(input).toHaveClass('border-red-300', 'text-red-900', 'focus:ring-red-500', 'focus:border-red-500');
            expect(input).toHaveAttribute('aria-invalid', 'true');
        });

        it('should apply normal styling when no error', () => {
            render(<Input label="Email" />);

            const input = screen.getByRole('textbox');
            expect(input).toHaveClass('border-gray-300', 'focus:ring-indigo-600', 'focus:border-indigo-600');
            expect(input).toHaveAttribute('aria-invalid', 'false');
        });

        it('should link error message with input via aria-describedby', () => {
            render(<Input label="Password" id="password-input" error="Password too weak" />);

            const input = screen.getByRole('textbox');
            expect(input).toHaveAttribute('aria-describedby', 'password-input-error');

            const errorMessage = screen.getByTestId('input-error-message');
            expect(errorMessage).toHaveAttribute('id', 'password-input-error');
        });

        it('should not have aria-describedby when no error', () => {
            render(<Input label="Password" />);

            const input = screen.getByRole('textbox');
            expect(input).not.toHaveAttribute('aria-describedby');
        });

        it('should handle different types of validation errors', () => {
            const errorTypes = [
                'Required field',
                'Invalid email format',
                'Password must be at least 8 characters',
                'Username already exists',
                'Special characters not allowed',
            ];

            errorTypes.forEach((errorMessage) => {
                const { unmount } = render(<Input label="Test Field" error={errorMessage} />);

                const errorElement = screen.getByTestId('input-error-message');
                expect(errorElement).toBeInTheDocument();
                expect(errorElement).toHaveTextContent(errorMessage);

                unmount();
            });
        });
    });

    describe('disabled state', () => {
        it('should render disabled input', () => {
            render(<Input label="Disabled Field" disabled />);

            const input = screen.getByRole('textbox');
            expect(input).toBeDisabled();
            expect(input).toHaveClass('bg-gray-50', 'text-gray-500', 'cursor-not-allowed');
        });

        it('should render enabled input by default', () => {
            render(<Input label="Enabled Field" />);

            const input = screen.getByRole('textbox');
            expect(input).toBeEnabled();
            expect(input).toHaveClass('bg-white');
            expect(input).not.toHaveClass('cursor-not-allowed');
        });
    });

    describe('user interactions', () => {
        it('should call onChange when value changes', () => {
            const handleChange = vi.fn();
            render(<Input label="Test Field" onChange={handleChange} />);

            const input = screen.getByRole('textbox');
            fireEvent.input(input, { target: { value: 'new value' } });

            expect(handleChange).toHaveBeenCalledWith('new value');
        });

        it('should call onBlur when input loses focus', () => {
            const handleBlur = vi.fn();
            render(<Input label="Test Field" onBlur={handleBlur} />);

            const input = screen.getByRole('textbox');
            fireEvent.blur(input);

            expect(handleBlur).toHaveBeenCalled();
        });

        it('should still call onChange when disabled (fireEvent bypasses disabled state)', () => {
            // Note: fireEvent.input bypasses the disabled attribute in JSDOM
            // This is different from real browser behavior but is how testing-library works
            const handleChange = vi.fn();
            render(<Input label="Disabled Field" onChange={handleChange} disabled />);

            const input = screen.getByRole('textbox');
            expect(input).toBeDisabled();

            // In real browsers, disabled inputs don't fire events, but in tests they do
            fireEvent.input(input, { target: { value: 'new value' } });

            // The component will still call onChange even when disabled in test environment
            expect(handleChange).toHaveBeenCalledWith('new value');
        });

        it('should display current value', () => {
            render(<Input label="Current Value" value="existing text" />);

            const input = screen.getByDisplayValue('existing text');
            expect(input).toBeInTheDocument();
        });

        it('should update value through controlled component', () => {
            const { rerender } = render(<Input label="Controlled" value="initial" />);

            expect(screen.getByDisplayValue('initial')).toBeInTheDocument();

            rerender(<Input label="Controlled" value="updated" />);
            expect(screen.getByDisplayValue('updated')).toBeInTheDocument();
        });
    });

    describe('additional props', () => {
        it('should render with placeholder', () => {
            render(<Input placeholder="Enter your email" />);

            const input = screen.getByPlaceholderText('Enter your email');
            expect(input).toBeInTheDocument();
        });

        it('should render with autoFocus', () => {
            render(<Input autoFocus />);

            const input = screen.getByRole('textbox');
            expect(input).toHaveAttribute('autofocus');
        });

        it('should render with autoComplete', () => {
            render(<Input autoComplete="email" />);

            const input = screen.getByRole('textbox');
            expect(input).toHaveAttribute('autocomplete', 'email');
        });

        it('should render with custom data-testid', () => {
            render(<Input data-testid="custom-input" />);

            const input = screen.getByTestId('custom-input');
            expect(input).toBeInTheDocument();
        });

        it('should apply custom className', () => {
            render(<Input className="custom-class" />);

            const input = screen.getByRole('textbox');
            expect(input).toHaveClass('custom-class');
        });
    });

    describe('integration with semantic form patterns', () => {
        it('should follow validation error requirements from style guide', () => {
            render(<Input label="Email" error="Invalid email" />);

            const errorMessage = screen.getByTestId('input-error-message');

            // Should have role="alert" for error detection
            expect(errorMessage).toHaveAttribute('role', 'alert');

            // Should have proper styling
            expect(errorMessage).toHaveClass('text-red-600');

            // Should not have financial-amount attributes
            expect(errorMessage).not.toHaveAttribute('data-financial-amount');
            expect(errorMessage).not.toHaveAttribute('data-balance');
            expect(errorMessage).not.toHaveAttribute('data-debt');
        });

        it('should be accessible for screen readers', () => {
            render(<Input label="Full Name" required error="Name is required" />);

            const input = screen.getByRole('textbox');
            const label = screen.getByText('Full Name');
            const errorMessage = screen.getByTestId('input-error-message');

            // Proper label association
            expect(label).toHaveAttribute('for', input.getAttribute('id'));

            // Required indicator should be included in label
            const requiredIndicator = screen.getByTestId('required-indicator');
            expect(requiredIndicator).toBeInTheDocument();

            // Error association
            expect(input).toHaveAttribute('aria-invalid', 'true');
            expect(input).toHaveAttribute('aria-describedby');
            expect(errorMessage).toHaveAttribute('role', 'alert');
        });
    });
});