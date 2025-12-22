import { cx } from '@/utils/cx.ts';
import type { Ref } from 'preact';
import { useCallback } from 'preact/hooks';
import { useTranslation } from 'react-i18next';
import { FieldError } from './FieldError';
import { formLabel, formTextarea } from './styles';

interface TextareaProps {
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
    className?: string;
    dataTestId?: string;
    textareaRef?: Ref<HTMLTextAreaElement>;
    rows?: number;
    maxLength?: number;
}

export function Textarea({
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
    className = '',
    dataTestId,
    textareaRef,
    rows = 3,
    maxLength,
}: TextareaProps) {
    const { t } = useTranslation();
    const textareaId = id || name || `textarea-${Math.random().toString(36).substr(2, 9)}`;

    const handleChange = useCallback(
        (e: Event) => {
            const target = e.target as HTMLTextAreaElement;
            onChange?.(target.value);
        },
        [onChange],
    );

    const textareaClasses = cx(
        ...formTextarea.base,
        error && formTextarea.error,
        disabled && formTextarea.disabled,
        className,
    );

    return (
        <div>
            {label && (
                <label htmlFor={textareaId} className={formLabel.base}>
                    {label}
                    {required && (
                        <span className={formLabel.required} data-testid='required-indicator'>
                            {t('common.required')}
                        </span>
                    )}
                </label>
            )}
            <div className='relative'>
                <textarea
                    id={textareaId}
                    name={name}
                    value={value}
                    onInput={handleChange}
                    onBlur={onBlur}
                    placeholder={placeholder}
                    disabled={disabled}
                    required={required}
                    rows={rows}
                    maxLength={maxLength}
                    className={textareaClasses}
                    aria-invalid={!!error}
                    aria-describedby={error ? `${textareaId}-error` : undefined}
                    data-testid={dataTestId}
                    ref={textareaRef as Ref<HTMLTextAreaElement>}
                />
            </div>
            {error && (
                <FieldError id={`${textareaId}-error`} dataTestId='textarea-error-message'>
                    {error}
                </FieldError>
            )}
        </div>
    );
}
