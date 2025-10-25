import { navigationService } from '@/services/navigation.service';
import { useComputed } from '@preact/signals';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../app/hooks/useAuth';

interface NotFoundPageProps {
    path?: string;
}

export function NotFoundPage({ path }: NotFoundPageProps) {
    const { t } = useTranslation();
    const authStore = useAuth();
    const isAuthenticated = useComputed(() => !!authStore?.user);

    // Check if this is a group-related 404
    const isGroupPath = path?.includes('/groups/');

    return (
        <div className='min-h-screen bg-gray-50 flex items-center justify-center'>
            <div className='text-center' data-testid='error-container'>
                <h1 className='text-6xl font-bold text-gray-900 mb-4' data-testid='not-found-title'>
                    {t('notFoundPage.title')}
                </h1>
                <p className='text-xl text-gray-600 mb-4' data-testid='not-found-subtitle'>
                    {isGroupPath ? t('notFoundPage.groupNotFound') : t('notFoundPage.pageNotFound')}
                </p>
                <p className='text-sm text-gray-500 mb-8' data-testid='not-found-description'>
                    {isGroupPath ? t('notFoundPage.groupNotFoundDescription') : t('notFoundPage.pageNotFoundDescription')}
                </p>
                <div className='space-x-4'>
                    {isAuthenticated.value
                        ? (
                            <button
                                onClick={() => navigationService.goToDashboard()}
                                className='px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors inline-block'
                                data-testid='go-to-dashboard-link'
                            >
                                {t('notFoundPage.goToDashboard')}
                            </button>
                        )
                        : (
                            <button
                                onClick={() => navigationService.goHome()}
                                className='px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors inline-block'
                                data-testid='go-home-link'
                            >
                                {t('notFoundPage.goHome')}
                            </button>
                        )}
                </div>
            </div>
        </div>
    );
}
