import { cx } from '@/utils/cx.ts';
import { useEffect } from 'preact/hooks';

export type ToastType = 'info' | 'success' | 'warning' | 'error';

export interface ToastData {
    id: string;
    type: ToastType;
    title?: string;
    message: string;
    duration?: number;
    dismissible?: boolean;
}

interface ToastProps extends ToastData {
    onDismiss: (id: string) => void;
}

/**
 * Toast component
 *
 * Individual toast notification using semantic tokens.
 * Displays a temporary message with optional title and dismiss button.
 *
 * This component is typically not used directly. Use the `toast` utility instead.
 *
 * @example
 * // Don't use this directly
 * <Toast
 *   id="abc"
 *   type="success"
 *   message="Changes saved"
 *   onDismiss={handleDismiss}
 * />
 *
 * // Instead, use the toast utility:
 * import { toast } from '@/components/ui/toast-service';
 * toast.success('Changes saved');
 */
export function Toast({
    id,
    type,
    title,
    message,
    duration = 5000,
    dismissible = true,
    onDismiss,
}: ToastProps) {
    useEffect(() => {
        if (duration > 0) {
            const timer = setTimeout(() => {
                onDismiss(id);
            }, duration);

            return () => clearTimeout(timer);
        }
    }, [id, duration, onDismiss]);

    const getTypeStyles = (type: ToastType) => {
        switch (type) {
            case 'success':
                return {
                    container: 'bg-semantic-success/10 border-semantic-success/20',
                    icon: 'text-semantic-success',
                    text: 'text-semantic-success',
                };
            case 'error':
                return {
                    container: 'bg-semantic-error/10 border-semantic-error/20',
                    icon: 'text-semantic-error',
                    text: 'text-semantic-error',
                };
            case 'warning':
                return {
                    container: 'bg-semantic-warning/10 border-semantic-warning/20',
                    icon: 'text-semantic-warning',
                    text: 'text-semantic-warning',
                };
            case 'info':
            default:
                return {
                    container: 'bg-interactive-primary/10 border-interactive-primary/20',
                    icon: 'text-interactive-primary',
                    text: 'text-interactive-primary',
                };
        }
    };

    const styles = getTypeStyles(type);

    const containerClasses = cx(
        'pointer-events-auto w-full max-w-sm rounded-lg border shadow-lg',
        'bg-surface-raised backdrop-blur-sm',
        'transform transition-all duration-300 ease-in-out',
        'animate-slide-in-right',
        styles.container,
    );

    const getIcon = (type: ToastType) => {
        switch (type) {
            case 'success':
                return (
                    <svg className='h-5 w-5' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
                        <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M5 13l4 4L19 7' />
                    </svg>
                );
            case 'error':
                return (
                    <svg className='h-5 w-5' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
                        <path
                            strokeLinecap='round'
                            strokeLinejoin='round'
                            strokeWidth={2}
                            d='M6 18L18 6M6 6l12 12'
                        />
                    </svg>
                );
            case 'warning':
                return (
                    <svg className='h-5 w-5' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
                        <path
                            strokeLinecap='round'
                            strokeLinejoin='round'
                            strokeWidth={2}
                            d='M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z'
                        />
                    </svg>
                );
            case 'info':
            default:
                return (
                    <svg className='h-5 w-5' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
                        <path
                            strokeLinecap='round'
                            strokeLinejoin='round'
                            strokeWidth={2}
                            d='M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
                        />
                    </svg>
                );
        }
    };

    return (
        <div className={containerClasses} role='alert' data-testid={`toast-${type}`}>
            <div className='p-4'>
                <div className='flex items-start'>
                    <div className={cx('flex-shrink-0', styles.icon)}>
                        {getIcon(type)}
                    </div>
                    <div className='ml-3 flex-1'>
                        {title && (
                            <p className={cx('text-sm font-medium', styles.text)}>
                                {title}
                            </p>
                        )}
                        <p className={cx('text-sm', title ? 'mt-1 text-text-muted' : styles.text)}>
                            {message}
                        </p>
                    </div>
                    {dismissible && (
                        <div className='ml-4 flex flex-shrink-0'>
                            <button
                                type='button'
                                className={cx(
                                    'inline-flex rounded-md',
                                    'text-text-muted hover:text-text-primary',
                                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-interactive-primary',
                                    'transition-colors',
                                )}
                                onClick={() => onDismiss(id)}
                                aria-label='Dismiss'
                            >
                                <svg className='h-5 w-5' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
                                    <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M6 18L18 6M6 6l12 12' />
                                </svg>
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
