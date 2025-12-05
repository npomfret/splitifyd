import { useEffect } from 'preact/hooks';
import { useTranslation } from 'react-i18next';
import { Button } from './Button';
import { AlertTriangleIcon, ExclamationCircleIcon, InfoIcon } from './icons';
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
                        ? <AlertTriangleIcon size={24} className={styles.icon} />
                        : variant === 'warning'
                        ? <ExclamationCircleIcon size={24} className={styles.icon} />
                        : <InfoIcon size={24} className={styles.icon} />}
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
