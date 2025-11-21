import { cx } from '@/utils/cx.ts';
import type { ComponentChildren } from 'preact';

interface FormFieldProps {
    label?: string;
    error?: string;
    helperText?: string;
    required?: boolean;
    htmlFor?: string;
    children: ComponentChildren;
    className?: string;
    'data-testid'?: string;
}

/**
 * FormField - A compound wrapper component for form inputs
 *
 * Provides consistent layout and styling for:
 * - Label
 * - Input (Input, FloatingInput, Select, Radio, Checkbox, Switch)
 * - Helper text
 * - Error messages
 * - Required indicator
 *
 * @example
 * <FormField label="Email" error={emailError} helperText="We'll never share your email" required>
 *   <Input type="email" value={email} onChange={setEmail} />
 * </FormField>
 */
export function FormField({
    label,
    error,
    helperText,
    required = false,
    htmlFor,
    children,
    className = '',
    'data-testid': dataTestId,
}: FormFieldProps) {
    const fieldId = htmlFor || `form-field-${Math.random().toString(36).substr(2, 9)}`;
    const hasError = !!error;

    const containerClasses = cx('space-y-2', className);

    const labelClasses = cx(
        'block text-sm font-medium',
        hasError ? 'text-semantic-error' : 'text-text-primary',
    );

    const helperTextClasses = cx('text-sm', hasError ? 'text-semantic-error' : 'text-text-muted');

    return (
        <div className={containerClasses} data-testid={dataTestId}>
            {label && (
                <label htmlFor={fieldId} className={labelClasses}>
                    {label}
                    {required && <span className='text-semantic-error ml-1'>*</span>}
                </label>
            )}

            <div>{children}</div>

            {(helperText || error) && (
                <div className={helperTextClasses} role={hasError ? 'alert' : undefined}>
                    {error || helperText}
                </div>
            )}
        </div>
    );
}
