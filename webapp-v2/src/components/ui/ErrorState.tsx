import { useTranslation } from 'react-i18next';
import { AlertTriangleIcon } from './icons';

interface ErrorStateProps {
    error: string | Error | unknown;
    title?: string;
    onRetry?: () => void;
    fullPage?: boolean;
    className?: string;
}

export function ErrorState({ error, title, onRetry, fullPage = false, className = '' }: ErrorStateProps) {
    const { t } = useTranslation();
    const defaultTitle = title || t('errorState.defaultTitle');
    // Extract error message from various error types
    const getErrorMessage = (err: unknown): string => {
        if (typeof err === 'string') return err;
        if (err instanceof Error) return err.message;
        if (err && typeof err === 'object' && 'message' in err) {
            return String(err.message);
        }
        return t('errorState.unexpectedError');
    };

    const errorMessage = getErrorMessage(error);

    const content = (
        <div className={`text-center ${className}`} role='alert' aria-live='assertive'>
            {/* Error Icon */}
            <div className='mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-surface-error'>
                <AlertTriangleIcon size={24} className='text-semantic-error' />
            </div>

            {/* Error Title */}
            <h3 className='mt-4 text-lg font-medium text-text-primary' data-testid='error-title'>
                {defaultTitle}
            </h3>

            {/* Error Message */}
            <p className='mt-2 text-sm text-text-muted' data-testid='error-message'>
                {errorMessage}
            </p>

            {/* Retry Button */}
            {onRetry && (
                <div className='mt-6'>
                    <button
                        onClick={onRetry}
                        className='inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-interactive-primary-foreground bg-interactive-primary hover:bg-interactive-primary/90 focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-interactive-primary'
                        data-testid='error-retry-button'
                    >
                        {t('errorState.tryAgainButton')}
                    </button>
                </div>
            )}
        </div>
    );

    if (fullPage) {
        return <div className='min-h-screen flex items-center justify-center bg-surface-muted py-12 px-4 sm:px-6 lg:px-8'>{content}</div>;
    }

    return content;
}
