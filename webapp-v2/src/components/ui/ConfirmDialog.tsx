import { useEffect } from 'preact/hooks';
import { useTranslation } from 'react-i18next';
import { Button } from './Button';
import { Modal } from './Modal';
import { Surface } from './Surface';
import { Typography } from './Typography';

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
    if (!isOpen) return null;

    const getVariantStyles = () => {
        switch (variant) {
            case 'danger':
                return {
                    icon: 'text-semantic-error',
                    iconBg: 'bg-surface-error',
                    button: 'danger' as const,
                };
            case 'warning':
                return {
                    icon: 'text-semantic-warning',
                    iconBg: 'bg-surface-warning',
                    button: 'primary' as const,
                };
            default:
                return {
                    icon: 'text-interactive-primary',
                    iconBg: 'bg-interactive-primary/10',
                    button: 'primary' as const,
                };
        }
    };

    const styles = getVariantStyles();

    const messageTestId = message.includes('outstanding balance') ? 'balance-error-message' : 'confirm-dialog-message';

    return (
        <Modal
            open={isOpen}
            onClose={loading ? undefined : onCancel}
            labelledBy='confirm-dialog-title'
            describedBy='confirm-dialog-description'
            data-testid={dataTestId}
        >
            <Surface padding='lg' shadow='md' border='default' className='space-y-6' data-testid='confirmation-dialog'>
                <div className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full ${styles.iconBg}`}>
                    {variant === 'danger'
                        ? (
                            <svg className={`h-6 w-6 ${styles.icon}`} fill='none' viewBox='0 0 24 24' stroke='currentColor' aria-hidden='true' focusable='false'>
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
                            <svg className={`h-6 w-6 ${styles.icon}`} fill='none' viewBox='0 0 24 24' stroke='currentColor' aria-hidden='true' focusable='false'>
                                <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' />
                            </svg>
                        )
                        : (
                            <svg className={`h-6 w-6 ${styles.icon}`} fill='none' viewBox='0 0 24 24' stroke='currentColor' aria-hidden='true' focusable='false'>
                                <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' />
                            </svg>
                        )}
                </div>

                <div className='space-y-2 text-center'>
                    <Typography as='h3' variant='heading' id='confirm-dialog-title'>
                        {title}
                    </Typography>
                    <Typography variant='caption' id='confirm-dialog-description' data-testid={messageTestId}>
                        {message}
                    </Typography>
                </div>

                <div className='flex items-center justify-end gap-3'>
                    <Button variant='secondary' onClick={onCancel} disabled={loading} data-testid='cancel-button'>
                        {cancelText || t('ui.confirmDialog.cancel')}
                    </Button>
                    <Button variant={styles.button} onClick={onConfirm} loading={loading} data-testid='confirm-button'>
                        {confirmText || t('ui.confirmDialog.confirm')}
                    </Button>
                </div>
            </Surface>
        </Modal>
    );
}
