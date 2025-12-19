import { cx } from '@/utils/cx.ts';
import type { ComponentChildren, Ref } from 'preact';
import { FieldError } from './FieldError';

interface CheckboxProps {
    /** Checkbox label (can be a string or JSX) */
    label?: string | ComponentChildren;
    /** Checked state */
    checked: boolean;
    /** Change handler */
    onChange: (checked: boolean) => void;
    /** Disabled state */
    disabled?: boolean;
    /** Error message */
    error?: string;
    /** Name attribute */
    name?: string;
    /** ID attribute */
    id?: string;
    /** Additional CSS classes */
    className?: string;
    /** Test ID */
    dataTestId?: string;
    /** Ref for the input element */
    inputRef?: Ref<HTMLInputElement>;
}

/**
 * Checkbox component
 *
 * An accessible checkbox component using semantic tokens from the theme system.
 * Supports labels, error states, and disabled states.
 *
 * @example
 * <Checkbox
 *   label="Remember me"
 *   checked={rememberMe}
 *   onChange={setRememberMe}
 * />
 *
 * @example
 * <Checkbox
 *   label="I agree to the terms"
 *   checked={agreed}
 *   onChange={setAgreed}
 *   error="You must agree to continue"
 * />
 */
export function Checkbox({
    label,
    checked,
    onChange,
    disabled = false,
    error,
    name,
    id,
    className = '',
    dataTestId,
    inputRef,
}: CheckboxProps) {
    const checkboxId = id || name || `checkbox-${Math.random().toString(36).substr(2, 9)}`;

    const handleChange = (e: Event) => {
        const target = e.currentTarget as HTMLInputElement;
        onChange(target.checked);
    };

    const checkboxClasses = cx(
        'h-4 w-4 rounded border border-border-default',
        'text-interactive-primary',
        'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-interactive-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base',
        'transition-colors',
        disabled && 'opacity-60 cursor-not-allowed',
        error && 'border-border-error focus-visible:ring-semantic-error',
    );

    const labelClasses = cx(
        'flex items-center gap-2',
        disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
    );

    const Wrapper = label ? 'label' : 'div';

    return (
        <div className={className}>
            <Wrapper className={labelClasses} htmlFor={label ? checkboxId : undefined}>
                <input
                    type='checkbox'
                    id={checkboxId}
                    name={name}
                    checked={checked}
                    onChange={handleChange}
                    disabled={disabled}
                    className={checkboxClasses}
                    aria-invalid={!!error}
                    aria-describedby={error ? `${checkboxId}-error` : undefined}
                    data-testid={dataTestId}
                    ref={inputRef as Ref<HTMLInputElement>}
                />
                {label && (
                    <span className='text-sm text-text-primary select-none'>
                        {label}
                    </span>
                )}
            </Wrapper>
            {error && (
                <FieldError id={`${checkboxId}-error`} dataTestId='checkbox-error-message'>
                    {error}
                </FieldError>
            )}
        </div>
    );
}
