import { useEffect, useRef } from 'preact/hooks';
import { useTranslation } from 'react-i18next';
import { Button } from './Button';

interface ConfirmDialogProps {
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm: () => void;
    onCancel: () => void;
    variant?: 'danger' | 'warning' | 'info';
    loading?: boolean;
    'data-testid'?: string;
}

export function ConfirmDialog({ isOpen, title, message, confirmText, cancelText, onConfirm, onCancel, variant = 'info', loading = false, 'data-testid': dataTestId }: ConfirmDialogProps) {
    const { t } = useTranslation();
    const modalRef = useRef<HTMLDivElement>(null);

    // Handle escape key to close modal
    useEffect(() => {
        if (!isOpen) return;

        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !loading) {
                onCancel();
            }
        };

        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [isOpen, onCancel, loading]);

    // Handle click outside modal to close
    const handleBackdropClick = (e: Event) => {
        if (e.target === e.currentTarget && !loading) {
            onCancel();
        }
    };

    if (!isOpen) return null;

    const getVariantStyles = () => {
        switch (variant) {
            case 'danger':
                return {
                    icon: 'text-red-600',
                    iconBg: 'bg-red-100',
                    button: 'danger' as const,
                };
            case 'warning':
                return {
                    icon: 'text-yellow-600',
                    iconBg: 'bg-yellow-100',
                    button: 'primary' as const,
                };
            default:
                return {
                    icon: 'text-blue-600',
                    iconBg: 'bg-blue-100',
                    button: 'primary' as const,
                };
        }
    };

    const styles = getVariantStyles();

    return (
        <div className='fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50' onClick={handleBackdropClick} data-testid={dataTestId}>
            <div className='relative top-20 mx-auto p-6 border w-96 shadow-lg rounded-md bg-white dark:bg-gray-800' ref={modalRef} data-testid='confirmation-dialog'>
                {/* Icon */}
                <div className={`mx-auto flex items-center justify-center h-12 w-12 rounded-full ${styles.iconBg} mb-4`}>
                    {variant === 'danger'
                        ? (
                            <svg className={`h-6 w-6 ${styles.icon}`} fill='none' viewBox='0 0 24 24' stroke='currentColor'>
                                <path
                                    strokeLinecap='round'
                                    strokeLinejoin='round'
                                    strokeWidth={2}
                                    d='M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z'
                                />
                            </svg>
                        )
                        : variant === 'warning'
                        ? (
                            <svg className={`h-6 w-6 ${styles.icon}`} fill='none' viewBox='0 0 24 24' stroke='currentColor'>
                                <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' />
                            </svg>
                        )
                        : (
                            <svg className={`h-6 w-6 ${styles.icon}`} fill='none' viewBox='0 0 24 24' stroke='currentColor'>
                                <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' />
                            </svg>
                        )}
                </div>

                {/* Content */}
                <div className='text-center'>
                    <h3 className='text-lg font-medium text-gray-900 dark:text-white mb-2'>{title}</h3>
                    <p className='text-sm text-gray-500 dark:text-gray-400 mb-6' data-testid={message.includes('outstanding balance') ? 'balance-error-message' : undefined}>
                        {message}
                    </p>
                </div>

                {/* Actions */}
                <div className='flex items-center justify-end space-x-3'>
                    <Button variant='secondary' onClick={onCancel} disabled={loading} data-testid='cancel-button'>
                        {cancelText || t('ui.confirmDialog.cancel')}
                    </Button>
                    <Button variant={styles.button} onClick={onConfirm} loading={loading} data-testid='confirm-button'>
                        {confirmText || t('ui.confirmDialog.confirm')}
                    </Button>
                </div>
            </div>
        </div>
    );
}
