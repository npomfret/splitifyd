import { cx } from '@/utils/cx.ts';
import type { Ref } from 'preact';
import { useCallback, useState } from 'preact/hooks';
import { useTranslation } from 'react-i18next';

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
    'data-testid'?: string;
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
    'data-testid': dataTestId,
    inputRef,
}: FloatingInputProps) {
    const { t } = useTranslation();
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

    const baseInputClasses = [
        'block w-full rounded-md border border-border-default px-3 pt-6 pb-2 shadow-sm',
        'text-text-primary placeholder:text-transparent',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-interactive-primary focus-visible:border-interactive-primary',
        'sm:text-sm transition-all duration-[var(--motion-duration-fast)] ease-[var(--motion-easing-standard)]',
        'bg-surface-raised backdrop-blur-sm',
    ];

    const stateClasses = error
        ? 'border-border-error text-semantic-error focus-visible:ring-semantic-error focus-visible:border-semantic-error'
        : '';
    const disabledClasses = disabled ? 'opacity-60 cursor-not-allowed bg-surface-muted text-text-muted' : '';

    const inputClasses = cx(...baseInputClasses, stateClasses, disabledClasses);

    const baseLabelClasses = [
        'absolute left-3 text-text-secondary pointer-events-none',
        'transition-all duration-[var(--motion-duration-fast)] ease-[var(--motion-easing-standard)]',
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
                <p
                    id={`${inputId}-error`}
                    className='mt-2 text-sm text-semantic-error'
                    role='alert'
                    data-testid='input-error-message'
                >
                    {error}
                </p>
            )}
        </div>
    );
}
