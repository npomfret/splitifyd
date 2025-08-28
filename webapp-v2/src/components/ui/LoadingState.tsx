import { LoadingSpinner } from './LoadingSpinner';
import { useTranslation } from 'react-i18next';

interface LoadingStateProps {
    message?: string;
    fullPage?: boolean;
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}

export function LoadingState({ message, fullPage = false, size = 'md', className = '' }: LoadingStateProps) {
    const { t } = useTranslation();
    const displayMessage = message || t('loadingState.defaultMessage');
    const content = (
        <div className={`flex flex-col items-center justify-center ${className}`}>
            <LoadingSpinner size={size} />
            {displayMessage && (
                <p className="mt-3 text-sm text-gray-600" data-testid="loading-message">
                    {displayMessage}
                </p>
            )}
        </div>
    );

    if (fullPage) {
        return <div className="min-h-screen flex items-center justify-center bg-gray-50">{content}</div>;
    }

    return content;
}
