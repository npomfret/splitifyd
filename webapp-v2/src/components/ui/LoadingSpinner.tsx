import { useTranslation } from 'react-i18next';

interface LoadingSpinnerProps {
    size?: 'sm' | 'md' | 'lg';
    color?: string;
    fullScreen?: boolean;
}

export function LoadingSpinner({ size = 'md', color = 'text-interactive-primary', fullScreen = false }: LoadingSpinnerProps) {
    const { t } = useTranslation();
    const sizeClasses = {
        sm: 'w-4 h-4',
        md: 'w-8 h-8',
        lg: 'w-12 h-12',
    };

    const spinner = (
        <svg
            className={`animate-spin ${sizeClasses[size]} ${color}`}
            xmlns='http://www.w3.org/2000/svg'
            fill='none'
            viewBox='0 0 24 24'
            role='status'
            aria-label={t('uiComponents.loadingSpinner.loading')}
        >
            <circle className='opacity-25' cx='12' cy='12' r='10' stroke='currentColor' strokeWidth='4' />
            <path className='opacity-75' fill='currentColor' d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z' />
        </svg>
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
