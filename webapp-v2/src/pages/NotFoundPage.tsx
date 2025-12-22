import { Clickable } from '@/components/ui/Clickable';
import { navigationService } from '@/services/navigation.service';
import { useComputed } from '@preact/signals';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/app/hooks';

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
        <div className='min-h-screen bg-surface-muted flex items-center justify-center'>
            <div className='text-center'>
                <h1 className='text-6xl font-bold text-text-primary mb-4'>
                    {t('notFoundPage.title')}
                </h1>
                <p className='text-xl text-text-muted mb-4'>
                    {isGroupPath ? t('notFoundPage.groupNotFound') : t('notFoundPage.pageNotFound')}
                </p>
                <p className='help-text mb-8'>
                    {isGroupPath ? t('notFoundPage.groupNotFoundDescription') : t('notFoundPage.pageNotFoundDescription')}
                </p>
                <div className='space-x-4'>
                    {isAuthenticated.value
                        ? (
                            <Clickable
                                as='button'
                                onClick={() => navigationService.goToDashboard()}
                                className='px-6 py-3 bg-interactive-primary text-interactive-primary-foreground rounded-lg hover:bg-interactive-primary/90 transition-colors inline-block'
                                aria-label='Go to dashboard'
                                eventName='not_found_navigate'
                                eventProps={{ destination: 'dashboard' }}
                            >
                                {t('notFoundPage.goToDashboard')}
                            </Clickable>
                        )
                        : (
                            <Clickable
                                as='button'
                                onClick={() => navigationService.goHome()}
                                className='px-6 py-3 bg-interactive-primary text-interactive-primary-foreground rounded-lg hover:bg-interactive-primary/90 transition-colors inline-block'
                                aria-label='Go to home page'
                                eventName='not_found_navigate'
                                eventProps={{ destination: 'home' }}
                            >
                                {t('notFoundPage.goHome')}
                            </Clickable>
                        )}
                </div>
            </div>
        </div>
    );
}
