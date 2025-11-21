import { cx } from '@/utils/cx.ts';
import { useCallback } from 'preact/hooks';

export interface RadioOption {
    value: string;
    label: string;
    description?: string;
    disabled?: boolean;
}

interface RadioProps {
    label?: string;
    error?: string;
    options: RadioOption[];
    value?: string;
    onChange?: (value: string) => void;
    disabled?: boolean;
    required?: boolean;
    name: string;
    className?: string;
    'data-testid'?: string;
    orientation?: 'vertical' | 'horizontal';
}

export function Radio({
    label,
    error,
    options,
    value = '',
    onChange,
    disabled = false,
    required = false,
    name,
    className = '',
    'data-testid': dataTestId,
    orientation = 'vertical',
}: RadioProps) {
    const handleChange = useCallback(
        (e: Event) => {
            const target = e.target as HTMLInputElement;
            onChange?.(target.value);
        },
        [onChange],
    );

    const radioGroupClasses = cx(
        'space-y-3',
        orientation === 'horizontal' && 'flex flex-wrap gap-4 space-y-0',
        className,
    );

    return (
        <div>
            {label && (
                <div className='mb-3'>
                    <span className='block text-sm font-medium text-text-primary'>
                        {label}
                        {required && <span className='text-semantic-error ml-1'>*</span>}
                    </span>
                </div>
            )}
            <div className={radioGroupClasses} role='radiogroup' data-testid={dataTestId}>
                {options.map((option, index) => {
                    const optionId = `${name}-${option.value}`;
                    const isChecked = value === option.value;
                    const isDisabled = disabled || option.disabled;

                    const optionClasses = cx(
                        'relative flex items-start',
                        isDisabled && 'opacity-60 cursor-not-allowed',
                    );

                    const radioClasses = cx(
                        'h-4 w-4 border border-border-default text-interactive-primary',
                        'focus-visible:ring-2 focus-visible:ring-interactive-primary focus-visible:ring-offset-2',
                        'transition-colors duration-[var(--motion-duration-fast)]',
                        isDisabled ? 'cursor-not-allowed bg-surface-muted' : 'cursor-pointer bg-surface-raised',
                    );

                    const labelClasses = cx(
                        'ml-3 text-sm',
                        isDisabled ? 'cursor-not-allowed text-text-muted' : 'cursor-pointer text-text-primary',
                    );

                    return (
                        <div key={option.value} className={optionClasses}>
                            <div className='flex h-6 items-center'>
                                <input
                                    id={optionId}
                                    name={name}
                                    type='radio'
                                    value={option.value}
                                    checked={isChecked}
                                    onChange={handleChange}
                                    disabled={isDisabled}
                                    required={required && index === 0}
                                    className={radioClasses}
                                    aria-describedby={option.description ? `${optionId}-description` : undefined}
                                    data-testid={`${dataTestId}-option-${option.value}`}
                                />
                            </div>
                            <div className='ml-3 text-sm leading-6'>
                                <label htmlFor={optionId} className={labelClasses}>
                                    {option.label}
                                </label>
                                {option.description && (
                                    <p id={`${optionId}-description`} className='text-text-muted mt-0.5'>
                                        {option.description}
                                    </p>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
            {error && (
                <p className='mt-2 text-sm text-semantic-error' role='alert' data-testid='radio-error-message'>
                    {error}
                </p>
            )}
        </div>
    );
}
