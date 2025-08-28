import { useComputed } from '@preact/signals';
import { useAuth } from '../app/hooks/useAuth';
import { useTranslation } from 'react-i18next';

interface NotFoundPageProps {
    path?: string;
}

export function NotFoundPage({ path }: NotFoundPageProps) {
    const { t } = useTranslation();
    const authStore = useAuth();
    const isAuthenticated = useComputed(() => !!authStore?.user);

    // Check if this is a group-related 404
    const isGroupPath = path?.includes('/groups/') || path?.includes('/group/');

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
            <div className="text-center">
                <h1 className="text-6xl font-bold text-gray-900 mb-4" data-testid="not-found-title">
                    {t('notFoundPage.title')}
                </h1>
                <p className="text-xl text-gray-600 mb-4" data-testid="not-found-subtitle">
                    {isGroupPath ? t('notFoundPage.groupNotFound') : t('notFoundPage.pageNotFound')}
                </p>
                <p className="text-sm text-gray-500 mb-8" data-testid="not-found-description">
                    {isGroupPath ? t('notFoundPage.groupNotFoundDescription') : t('notFoundPage.pageNotFoundDescription')}
                </p>
                <div className="space-x-4">
                    {isAuthenticated.value ? (
                        <a href="/dashboard" className="px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors inline-block" data-testid="go-to-dashboard-link">
                            {t('notFoundPage.goToDashboard')}
                        </a>
                    ) : (
                        <a href="/" className="px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors inline-block" data-testid="go-home-link">
                            {t('notFoundPage.goHome')}
                        </a>
                    )}
                </div>
            </div>
        </div>
    );
}
