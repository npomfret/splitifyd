import type { Ref } from 'preact';
import { useCallback } from 'preact/hooks';
import { cx } from '@/utils/cx.ts';
import { useTranslation } from 'react-i18next';

interface InputProps {
    type?: 'text' | 'email' | 'password' | 'number';
    label?: string;
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

export function Input({
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
}: InputProps) {
    const { t } = useTranslation();
    const inputId = id || name || `input-${Math.random().toString(36).substr(2, 9)}`;

    const handleChange = useCallback(
        (e: Event) => {
            const target = e.target as HTMLInputElement;
            onChange?.(target.value);
        },
        [onChange],
    );

    const baseInputClasses = [
        'block w-full rounded-md border border-border-default px-3 py-2 shadow-sm',
        'text-text-primary placeholder:text-text-muted/70',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-interactive-primary focus-visible:border-interactive-primary',
        'sm:text-sm sm:leading-6 transition-colors duration-200 bg-surface-raised backdrop-blur-sm',
    ];

    const stateClasses = error ? 'border-border-error text-semantic-error focus-visible:ring-semantic-error focus-visible:border-semantic-error' : '';
    const disabledClasses = disabled ? 'opacity-60 cursor-not-allowed bg-surface-muted text-text-muted' : '';

    const inputClasses = cx(...baseInputClasses, stateClasses, disabledClasses, className);

    return (
        <div>
            {label && (
                <label htmlFor={inputId} className='mb-2 block text-sm font-medium text-text-primary'>
                    {label}
                    {required && (
                        <span className='text-semantic-error ml-1' data-testid='required-indicator'>
                            {t('common.required')}
                        </span>
                    )}
                </label>
            )}
            <div className='relative'>
                <input
                    type={type}
                    id={inputId}
                    name={name}
                    value={value}
                    onInput={handleChange}
                    onBlur={onBlur}
                    placeholder={placeholder}
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
            </div>
            {error && (
                <p id={`${inputId}-error`} className='mt-2 text-sm text-semantic-error' role='alert' data-testid='input-error-message'>
                    {error}
                </p>
            )}
        </div>
    );
}
