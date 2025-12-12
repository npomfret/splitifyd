import { signal } from '@preact/signals';
import { useState } from 'preact/hooks';
import { useTranslation } from 'react-i18next';
import { CheckCircleIcon, InfoCircleIcon, WarningIcon, XCircleIcon, XIcon } from './icons';
import { Tooltip } from './Tooltip';

interface AlertProps {
    type: 'info' | 'success' | 'warning' | 'error';
    title?: string;
    message: string;
    dismissible?: boolean;
    onDismiss?: () => void;
    dataTestId?: string;
}

export function Alert({ type, title, message, dismissible = false, onDismiss, dataTestId }: AlertProps) {
    const { t } = useTranslation();
    // Component-local signal - initialized within useState to avoid stale state across instances
    const [isVisibleSignal] = useState(() => signal(true));

    if (!isVisibleSignal.value) return null;

    const handleDismiss = () => {
        isVisibleSignal.value = false;
        onDismiss?.();
    };

    const typeStyles = {
        info: {
            bg: 'bg-interactive-primary/10',
            border: 'border-interactive-primary/30',
            text: 'text-interactive-primary',
            icon: <InfoCircleIcon size={20} className='mr-2' />,
        },
        success: {
            bg: 'bg-interactive-accent/10',
            border: 'border-semantic-success/40',
            text: 'text-semantic-success',
            icon: <CheckCircleIcon size={20} className='mr-2' />,
        },
        warning: {
            bg: 'bg-surface-warning',
            border: 'border-border-warning',
            text: 'text-semantic-warning',
            icon: <WarningIcon size={20} className='mr-2' />,
        },
        error: {
            bg: 'bg-surface-error',
            border: 'border-border-error',
            text: 'text-semantic-error',
            icon: <XCircleIcon size={20} className='mr-2' />,
        },
    };

    const styles = typeStyles[type];

    return (
        <div className={`${styles.bg} ${styles.border} ${styles.text} border rounded-lg p-4`} role='alert' data-testid={dataTestId}>
            <div className='flex items-start'>
                {styles.icon}
                <div className='flex-1'>
                    {title && <h4 className='font-medium mb-1'>{title}</h4>}
                    <p className='text-sm'>{message}</p>
                </div>
                {dismissible && (
                    <Tooltip content={t('ui.alert.dismiss')}>
                        <button
                            onClick={handleDismiss}
                            className={`ml-4 ${styles.text} hover:opacity-70 focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-current`}
                            aria-label={t('ui.alert.dismiss')}
                        >
                            <XIcon size={20} />
                        </button>
                    </Tooltip>
                )}
            </div>
        </div>
    );
}
