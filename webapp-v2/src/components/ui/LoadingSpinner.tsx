import { useTranslation } from 'react-i18next';
import { SpinnerIcon } from './icons';

interface LoadingSpinnerProps {
    size?: 'sm' | 'md' | 'lg';
    color?: string;
    fullScreen?: boolean;
    testId?: string;
}

export function LoadingSpinner({ size = 'md', color = 'text-interactive-primary', fullScreen = false, testId = 'loading-spinner' }: LoadingSpinnerProps) {
    const { t } = useTranslation();
    const sizeMap = {
        sm: 16,
        md: 32,
        lg: 48,
    };

    const spinner = (
        <span data-testid={testId} role='status' aria-label={t('uiComponents.loadingSpinner.loading')}>
            <SpinnerIcon size={sizeMap[size]} className={color} />
        </span>
    );

    if (fullScreen) {
        return (
            <div className='fixed inset-0 z-50 flex items-center justify-center bg-surface-base bg-opacity-75'>
                <div className='text-center'>
                    {spinner}
                    <p className='mt-2 text-sm text-text-muted'>{t('uiComponents.loadingSpinner.loading')}</p>
                </div>
            </div>
        );
    }

    return spinner;
}
