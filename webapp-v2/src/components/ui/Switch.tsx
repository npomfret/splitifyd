import { cx } from '@/utils/cx.ts';
import { useCallback } from 'preact/hooks';

interface SwitchProps {
    label?: string;
    description?: string;
    checked?: boolean;
    onChange?: (checked: boolean) => void;
    disabled?: boolean;
    name?: string;
    id?: string;
    className?: string;
    dataTestId?: string;
}

export function Switch({
    label,
    description,
    checked = false,
    onChange,
    disabled = false,
    name,
    id,
    className = '',
    dataTestId,
}: SwitchProps) {
    const switchId = id || name || `switch-${Math.random().toString(36).substr(2, 9)}`;

    const handleChange = useCallback(
        (e: Event) => {
            const target = e.target as HTMLInputElement;
            onChange?.(target.checked);
        },
        [onChange],
    );

    const containerClasses = cx('relative flex items-start', className);

    const switchClasses = cx(
        'relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent',
        'transition-colors duration-(--motion-duration-fast) ease-(--motion-easing-standard)',
        'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-interactive-primary focus-visible:ring-offset-2',
        disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
        checked ? 'bg-interactive-primary' : 'bg-border-default',
    );

    const toggleClasses = cx(
        'pointer-events-none inline-block h-5 w-5 rounded-full bg-surface-base shadow-sm ring-0',
        'transition-transform duration-(--motion-duration-fast) ease-(--motion-easing-standard)',
        checked ? 'translate-x-5' : 'translate-x-0',
    );

    const labelClasses = cx(
        'ml-3 text-sm',
        disabled ? 'cursor-not-allowed text-text-muted' : 'cursor-pointer text-text-primary',
    );

    return (
        <div className={containerClasses}>
            <div className='flex h-6 items-center'>
                <input
                    type='checkbox'
                    role='switch'
                    id={switchId}
                    name={name}
                    checked={checked}
                    onChange={handleChange}
                    disabled={disabled}
                    className='sr-only'
                    aria-checked={checked}
                    aria-describedby={description ? `${switchId}-description` : undefined}
                    data-testid={dataTestId}
                />
                <label htmlFor={switchId} className={switchClasses}>
                    <span className={toggleClasses} aria-hidden='true' />
                </label>
            </div>
            {(label || description) && (
                <div className='ml-3'>
                    {label && (
                        <label htmlFor={switchId} className={labelClasses}>
                            {label}
                        </label>
                    )}
                    {description && (
                        <p id={`${switchId}-description`} className='help-text'>
                            {description}
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}
