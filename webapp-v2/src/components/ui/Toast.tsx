import { cx } from '@/utils/cx.ts';
import { useEffect } from 'preact/hooks';
import { AlertTriangleIcon, CheckIcon, InfoIcon, XIcon } from './icons';

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
                return <CheckIcon size={20} />;
            case 'error':
                return <XIcon size={20} />;
            case 'warning':
                return <AlertTriangleIcon size={20} />;
            case 'info':
            default:
                return <InfoIcon size={20} />;
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
<XIcon size={20} />
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
