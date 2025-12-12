import { useMagneticHover } from '@/app/hooks/useMagneticHover';
import { logButtonClick } from '@/utils/browser-logger.ts';
import { cx } from '@/utils/cx.ts';
import { ComponentChildren } from 'preact';
import { SpinnerIcon } from './icons';

interface ButtonProps {
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
    size?: 'sm' | 'md' | 'lg';
    loading?: boolean;
    disabled?: boolean;
    fullWidth?: boolean;
    onClick?: () => void;
    type?: 'button' | 'submit' | 'reset';
    children: ComponentChildren;
    className?: string;
    id?: string;
    ariaLabel?: string;
    dataTestId?: string;
    'aria-describedby'?: string;
    'aria-pressed'?: boolean | 'true' | 'false';
    /**
     * Enable magnetic hover effect (follows cursor).
     * Only works on Aurora theme (disabled on Brutalist).
     * Default: false
     */
    magnetic?: boolean;
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
    dataTestId,
    'aria-describedby': ariaDescribedBy,
    'aria-pressed': ariaPressed,
    magnetic = true, // All buttons magnetic by default (auto-disabled on Brutalist theme)
}: ButtonProps) {
    const isDisabled = disabled || loading;

    // Apply magnetic hover effect if enabled (automatically disabled on Brutalist theme)
    // Always attach ref - the hook and button's disabled state will handle interaction
    const magneticRef = useMagneticHover<HTMLButtonElement>({
        strength: 0.3,
        disabled: isDisabled,
    });

    const buttonRef = magnetic ? magneticRef : undefined;

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
        'inline-flex items-center justify-center font-semibold rounded-md',
        'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base',
        // Polished hover effect (lift + scale) - uses theme CSS variables for timing
        'btn-polished',
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
            // bg-interactive-primary provides solid color fallback, gradient overlays on top
            'bg-interactive-primary text-interactive-primary-foreground shadow-(--shadows-md)',
            // Apply gradient as inline style via arbitrary property for better CSS variable support
            '[background-image:var(--gradient-primary,none)]',
            // magnetic-glow uses --interactive-magnetic-rgb for hover glow (falls back to primary)
            !isDisabled && 'magnetic-glow',
            // focus-glow uses --interactive-glow-rgb for focus ring glow (falls back to primary)
            'focus-visible:ring-interactive-primary focus-glow',
            'transition-shadow duration-200',
        ],
        secondary: [
            // Uses surface-muted for button background
            'bg-surface-muted text-text-primary border border-border-default shadow-sm',
            !isDisabled && 'hover:bg-surface-raised',
            'focus-visible:ring-border-strong',
        ],
        ghost: [
            'bg-transparent',
            // Don't set default text color - inherit from parent or allow className override
            // Uses interactive-ghost token for hover background (falls back to slate-500)
            !isDisabled && 'hover:bg-interactive-ghost/10',
            'focus-visible:ring-interactive-ghost',
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
            ref={buttonRef}
            id={id}
            type={type}
            onClick={handleClick}
            disabled={isDisabled}
            className={buttonClasses}
            aria-label={ariaLabel}
            aria-busy={loading}
            aria-describedby={ariaDescribedBy}
            aria-pressed={ariaPressed}
            data-testid={dataTestId}
        >
            {loading && <SpinnerIcon size={16} className='text-current' />}
            {children}
        </button>
    );
}
