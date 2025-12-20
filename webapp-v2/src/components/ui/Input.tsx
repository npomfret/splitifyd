import { cx } from '@/utils/cx.ts';
import type { Ref } from 'preact';
import { useCallback } from 'preact/hooks';
import { useTranslation } from 'react-i18next';
import { FieldError } from './FieldError';
import { formInput, formLabel } from './styles';

interface InputProps {
    type?: 'text' | 'email' | 'password' | 'number' | 'date';
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
    dataTestId?: string;
    inputRef?: Ref<HTMLInputElement>;
    /** Maximum value for date inputs */
    max?: string;
    /** Maximum character length */
    maxLength?: number;
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
    dataTestId,
    inputRef,
    max,
    maxLength,
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

    const inputClasses = cx(
        ...formInput.base,
        error && formInput.error,
        disabled && formInput.disabled,
        className,
    );

    return (
        <div>
            {label && (
                <label htmlFor={inputId} className={formLabel.base}>
                    {label}
                    {required && (
                        <span className={formLabel.required} data-testid='required-indicator'>
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
                    max={max}
                    maxLength={maxLength}
                    className={inputClasses}
                    aria-invalid={!!error}
                    aria-describedby={error ? `${inputId}-error` : undefined}
                    data-testid={dataTestId}
                    ref={inputRef as Ref<HTMLInputElement>}
                />
            </div>
            {error && (
                <FieldError id={`${inputId}-error`} dataTestId='input-error-message'>
                    {error}
                </FieldError>
            )}
        </div>
    );
}
