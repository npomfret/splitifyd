import { cx } from '@/utils/cx.ts';
import type { Ref } from 'preact';
import { useCallback } from 'preact/hooks';
import { useTranslation } from 'react-i18next';
import { FieldError } from './FieldError';
import { ChevronDownIcon } from './icons';
import { formLabel, formSelect } from './styles';

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
    dataTestId?: string;
    selectRef?: Ref<HTMLSelectElement>;
    /** Accessible label for screen readers when no visible label is provided */
    'aria-label'?: string;
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
    dataTestId,
    selectRef,
    'aria-label': ariaLabel,
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

    const selectClasses = cx(
        ...formSelect.base,
        error && formSelect.error,
        disabled && formSelect.disabled,
        className,
    );

    return (
        <div>
            {label && (
                <label htmlFor={selectId} className={formLabel.base}>
                    {label}
                    {required && (
                        <span className={formLabel.required} data-testid='required-indicator'>
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
                    aria-label={ariaLabel}
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
                <div className='pointer-events-none absolute inset-y-0 end-0 flex items-center pe-3'>
                    <ChevronDownIcon size={20} className='text-text-muted' />
                </div>
            </div>
            {error && (
                <FieldError id={`${selectId}-error`} dataTestId='select-error-message'>
                    {error}
                </FieldError>
            )}
        </div>
    );
}
