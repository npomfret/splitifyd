import { cx } from '@/utils/cx.ts';
import type { Ref } from 'preact';
import { useCallback } from 'preact/hooks';
import { useTranslation } from 'react-i18next';
import { FieldError } from './FieldError';
import { ChevronDownIcon } from './icons';

interface SelectOption {
    value: string;
    label: string;
    disabled?: boolean;
}

interface SelectProps {
    label?: string;
    error?: string;
    placeholder?: string;
    disabled?: boolean;
    required?: boolean;
    value?: string;
    onChange?: (value: string) => void;
    onBlur?: () => void;
    options: SelectOption[];
    name?: string;
    id?: string;
    className?: string;
    'data-testid'?: string;
    selectRef?: Ref<HTMLSelectElement>;
}

export function Select({
    label,
    error,
    placeholder,
    disabled = false,
    required = false,
    value = '',
    onChange,
    onBlur,
    options,
    name,
    id,
    className = '',
    'data-testid': dataTestId,
    selectRef,
}: SelectProps) {
    const { t } = useTranslation();
    const selectId = id || name || `select-${Math.random().toString(36).substr(2, 9)}`;

    const handleChange = useCallback(
        (e: Event) => {
            const target = e.target as HTMLSelectElement;
            onChange?.(target.value);
        },
        [onChange],
    );

    const baseSelectClasses = [
        'block w-full rounded-md border border-border-default px-3 py-2 pr-10 shadow-sm',
        'text-text-primary',
        'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-interactive-primary focus-visible:border-interactive-primary',
        'sm:text-sm sm:leading-6 transition-colors duration-200 bg-surface-raised backdrop-blur-xs',
        'appearance-none cursor-pointer',
    ];

    const stateClasses = error
        ? 'border-border-error text-semantic-error focus-visible:ring-semantic-error focus-visible:border-semantic-error'
        : '';
    const disabledClasses = disabled ? 'opacity-60 cursor-not-allowed bg-surface-muted text-text-muted' : '';

    const selectClasses = cx(...baseSelectClasses, stateClasses, disabledClasses, className);

    return (
        <div>
            {label && (
                <label htmlFor={selectId} className='mb-2 block text-sm font-medium text-text-primary'>
                    {label}
                    {required && (
                        <span className='text-semantic-error ml-1' data-testid='required-indicator'>
                            {t('common.required')}
                        </span>
                    )}
                </label>
            )}
            <div className='relative'>
                <select
                    id={selectId}
                    name={name}
                    value={value}
                    onChange={handleChange}
                    onBlur={onBlur}
                    disabled={disabled}
                    required={required}
                    className={selectClasses}
                    aria-invalid={!!error}
                    aria-describedby={error ? `${selectId}-error` : undefined}
                    data-testid={dataTestId}
                    ref={selectRef as Ref<HTMLSelectElement>}
                >
                    {placeholder && (
                        <option value='' disabled>
                            {placeholder}
                        </option>
                    )}
                    {options.map((option) => (
                        <option key={option.value} value={option.value} disabled={option.disabled}>
                            {option.label}
                        </option>
                    ))}
                </select>
                {/* Custom dropdown arrow */}
                <div className='pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3'>
                    <ChevronDownIcon size={20} className='text-text-muted' />
                </div>
            </div>
            {error && (
                <FieldError id={`${selectId}-error`} data-testid='select-error-message'>
                    {error}
                </FieldError>
            )}
        </div>
    );
}
