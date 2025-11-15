import { logButtonClick } from '@/utils/browser-logger.ts';
import { cx } from '@/utils/cx.ts';
import { JSX } from 'preact';

interface ButtonProps {
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
    size?: 'sm' | 'md' | 'lg';
    loading?: boolean;
    disabled?: boolean;
    fullWidth?: boolean;
    onClick?: () => void;
    type?: 'button' | 'submit' | 'reset';
    children: JSX.Element | JSX.Element[] | string;
    className?: string;
    id?: string;
    ariaLabel?: string;
    'data-testid'?: string;
    'aria-describedby'?: string;
}

export function Button({
    variant = 'primary',
    size = 'md',
    loading = false,
    disabled = false,
    fullWidth = false,
    onClick,
    type = 'button',
    children,
    className = '',
    id,
    ariaLabel,
    'data-testid': dataTestId,
    'aria-describedby': ariaDescribedBy,
}: ButtonProps) {
    const isDisabled = disabled || loading;

    const getButtonText = (): string => {
        if (typeof children === 'string') {
            return children;
        }
        if (ariaLabel) {
            return ariaLabel;
        }
        if (id) {
            return `Button#${id}`;
        }
        return 'Button';
    };

    const handleClick = () => {
        if (!isDisabled && onClick) {
            logButtonClick(getButtonText(), {
                id,
                variant,
                size,
                type,
            });

            onClick();
        }
    };

    const baseClasses = [
        'inline-flex items-center justify-center font-semibold rounded-md transition-colors duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base',
        fullWidth ? 'w-full' : 'inline-flex',
        isDisabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer',
        loading ? 'gap-2' : '',
    ];

    const sizeClasses: Record<NonNullable<ButtonProps['size']>, string> = {
        sm: 'text-sm px-3 py-1.5',
        md: 'text-sm px-4 py-2',
        lg: 'text-base px-6 py-3',
    };

    const variantClasses: Record<NonNullable<ButtonProps['variant']>, Array<string | false>> = {
        primary: [
            'bg-[image:var(--gradient-primary)] text-interactive-primary-foreground shadow-[var(--shadows-md)]',
            !isDisabled && 'hover:shadow-[0_0_20px_rgba(var(--interactive-primary-rgb),0.3)] hover:scale-[1.02]',
            !isDisabled && 'active:scale-[0.98]',
            'focus-visible:ring-interactive-primary',
            'transition-all duration-200',
        ],
        secondary: [
            // Uses surface-muted for button background
            'bg-surface-muted text-text-primary border border-border-default shadow-sm',
            !isDisabled && 'hover:bg-surface-raised',
            'focus-visible:ring-border-strong',
        ],
        ghost: [
            'bg-transparent text-text-primary',
            !isDisabled && 'hover:bg-surface-muted/60',
            'focus-visible:ring-border-default',
        ],
        danger: [
            'bg-semantic-error text-text-inverted shadow-md',
            !isDisabled && 'hover:bg-semantic-error/90',
            'focus-visible:ring-semantic-error',
        ],
    };

    const buttonClasses = cx(...baseClasses, sizeClasses[size], ...variantClasses[variant], className);

    return (
        <button
            id={id}
            type={type}
            onClick={handleClick}
            disabled={isDisabled}
            className={buttonClasses}
            aria-label={ariaLabel}
            aria-busy={loading}
            aria-describedby={ariaDescribedBy}
            data-testid={dataTestId}
            data-logged='true'
        >
            {loading && (
                <svg className='h-4 w-4 animate-spin text-current' viewBox='0 0 24 24' role='presentation' aria-hidden='true' focusable='false' data-testid='loading-spinner'>
                    <circle className='opacity-25' cx='12' cy='12' r='10' stroke='currentColor' strokeWidth='4' />
                    <path className='opacity-75' fill='currentColor' d='M4 12a8 8 0 018-8V0c-6.627 0-12 5.373-12 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z' />
                </svg>
            )}
            {children}
        </button>
    );
}
