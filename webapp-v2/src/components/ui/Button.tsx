import { logButtonClick } from '@/utils/browser-logger.ts';
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

    // Extract text content from children for logging
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
            // Log the button click
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
        'inline-flex',
        'items-center',
        'justify-center',
        'font-medium',
        'rounded-md',
        'transition-all',
        'duration-200',
        'focus:outline-none',
        'focus:ring-2',
        'focus:ring-offset-2',
        fullWidth ? 'w-full' : '',
    ];

    const sizeClasses = {
        sm: 'px-3 py-1.5 text-sm',
        md: 'px-4 py-2 text-sm',
        lg: 'px-6 py-3 text-base',
    };

    const variantClasses = {
        primary: ['bg-indigo-600', 'text-white', 'hover:bg-indigo-700', 'focus:ring-indigo-500', isDisabled ? 'opacity-50 cursor-not-allowed' : ''],
        secondary: ['bg-white', 'text-gray-700', 'border', 'border-gray-300', 'hover:bg-gray-50', 'focus:ring-indigo-500', isDisabled ? 'opacity-50 cursor-not-allowed' : ''],
        ghost: ['bg-transparent', 'text-gray-700', 'hover:bg-gray-100', 'focus:ring-gray-500', isDisabled ? 'opacity-50 cursor-not-allowed' : ''],
        danger: ['bg-red-600', 'text-white', 'hover:bg-red-700', 'focus:ring-red-500', isDisabled ? 'opacity-50 cursor-not-allowed' : ''],
    };

    const buttonClasses = [...baseClasses, sizeClasses[size], ...variantClasses[variant], className].filter(Boolean).join(' ');

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
                <svg className='animate-spin -ml-1 mr-2 h-4 w-4' fill='none' viewBox='0 0 24 24' aria-hidden='true' focusable='false'>
                    <circle className='opacity-25' cx='12' cy='12' r='10' stroke='currentColor' strokeWidth='4' />
                    <path className='opacity-75' fill='currentColor' d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z' />
                </svg>
            )}
            {children}
        </button>
    );
}
