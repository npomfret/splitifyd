import { cx } from '@/utils/cx.ts';
import type { Ref } from 'preact';
import { useCallback, useState } from 'preact/hooks';
import { FieldError } from './FieldError';
import { formFloatingInput } from './styles';

interface FloatingInputProps {
    type?: 'text' | 'email' | 'password' | 'number';
    label: string;
    error?: string;
    placeholder?: string;
    disabled?: boolean;
    required?: boolean;
    value?: string;
    onChange?: (value: string) => void;
    onBlur?: () => void;
    name?: string;
    id?: string;
    autoFocus?: boolean;
    className?: string;
    autoComplete?: string;
    dataTestId?: string;
    inputRef?: Ref<HTMLInputElement>;
}

export function FloatingInput({
    type = 'text',
    label,
    error,
    placeholder,
    disabled = false,
    required = false,
    value = '',
    onChange,
    onBlur,
    name,
    id,
    autoFocus = false,
    className = '',
    autoComplete = 'off',
    dataTestId,
    inputRef,
}: FloatingInputProps) {
    const [isFocused, setIsFocused] = useState(false);
    const inputId = id || name || `floating-input-${Math.random().toString(36).substr(2, 9)}`;

    const hasValue = value && value.length > 0;
    const isLabelFloating = isFocused || hasValue;

    const handleChange = useCallback(
        (e: Event) => {
            const target = e.target as HTMLInputElement;
            onChange?.(target.value);
        },
        [onChange],
    );

    const handleFocus = useCallback(() => {
        setIsFocused(true);
    }, []);

    const handleBlur = useCallback(() => {
        setIsFocused(false);
        onBlur?.();
    }, [onBlur]);

    const containerClasses = cx('relative', className);

    const inputClasses = cx(
        ...formFloatingInput.base,
        error && formFloatingInput.error,
        disabled && formFloatingInput.disabled,
    );

    const baseLabelClasses = [
        'absolute start-3 text-text-secondary pointer-events-none',
        'transition-all duration-(--motion-duration-fast) ease-(--motion-easing-standard)',
        'origin-left',
    ];

    const labelPositionClasses = isLabelFloating
        ? 'top-1.5 text-xs font-medium'
        : 'top-1/2 -translate-y-1/2 text-sm';

    const labelFocusClasses = isFocused && !error ? 'text-interactive-primary' : '';
    const labelErrorClasses = error ? 'text-semantic-error' : '';

    const labelClasses = cx(...baseLabelClasses, labelPositionClasses, labelFocusClasses, labelErrorClasses);

    return (
        <div className={containerClasses}>
            <div className='relative'>
                <input
                    type={type}
                    id={inputId}
                    name={name}
                    value={value}
                    onInput={handleChange}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                    placeholder={placeholder || label}
                    disabled={disabled}
                    required={required}
                    autoFocus={autoFocus}
                    autoComplete={autoComplete}
                    className={inputClasses}
                    aria-invalid={!!error}
                    aria-describedby={error ? `${inputId}-error` : undefined}
                    data-testid={dataTestId}
                    ref={inputRef as Ref<HTMLInputElement>}
                />
                <label htmlFor={inputId} className={labelClasses}>
                    {label}
                    {required && (
                        <span className='ml-1' data-testid='required-indicator'>
                            *
                        </span>
                    )}
                </label>
            </div>
            {error && (
                <FieldError id={`${inputId}-error`} dataTestId='input-error-message'>
                    {error}
                </FieldError>
            )}
        </div>
    );
}
