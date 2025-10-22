import type { Ref } from 'preact';
import { useCallback } from 'preact/hooks';
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
        'block',
        'w-full',
        'rounded-md',
        'border',
        'px-3',
        'py-2',
        'text-gray-900',
        'shadow-sm',
        'placeholder:text-gray-400',
        'focus:outline-none',
        'focus:ring-2',
        'sm:text-sm',
        'sm:leading-6',
        'transition-colors',
        'duration-200',
    ];

    const stateClasses = error ? 'border-red-300 text-red-900 focus:ring-red-500 focus:border-red-500' : 'border-gray-300 focus:ring-indigo-600 focus:border-indigo-600';

    const disabledClasses = disabled ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : 'bg-white';

    const inputClasses = [...baseInputClasses, stateClasses, disabledClasses, className].filter(Boolean).join(' ');

    return (
        <div>
            {label && (
                <label htmlFor={inputId} className='block text-sm font-medium leading-6 text-gray-900 mb-2'>
                    {label}
                    {required && (
                        <span className='text-red-500 ml-1' data-testid='required-indicator'>
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
                <p id={`${inputId}-error`} className='mt-2 text-sm text-red-600' role='alert' data-testid='input-error-message'>
                    {error}
                </p>
            )}
        </div>
    );
}
