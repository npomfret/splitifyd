import { LoadingSpinner } from '@/components/ui';
import { XCircleIcon } from '@/components/ui/icons';
import { usePolicy } from '@/hooks/usePolicy.ts';
import { configStore } from '@/stores/config-store';
import { useTranslation } from 'react-i18next';
import { PolicyRenderer } from '../../components/policy/PolicyRenderer';
import { StaticPageLayout } from '../../components/StaticPageLayout';

export function CookiePolicyPage() {
    const { t } = useTranslation();
    const { policy, loading, error } = usePolicy('COOKIE_POLICY');
    const appName = configStore.appName;

    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const canonical = `${baseUrl}/cookies`;

    // Use policy creation date if available, fallback to static date
    const lastUpdated = policy?.createdAt ? new Date(policy.createdAt).toLocaleDateString() : 'January 22, 2025';

    const structuredData = {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: `${t('staticPages.cookiePolicy.title')} - ${appName}`,
        description: t('staticPages.cookiePolicy.description'),
        url: canonical,
        dateModified: lastUpdated,
        publisher: {
            '@type': 'Organization',
            name: appName,
        },
    };

    return (
        <StaticPageLayout title={t('staticPages.cookiePolicy.title')} description={t('staticPages.cookiePolicy.description')} canonical={canonical} structuredData={structuredData}>
            <div class='space-y-6'>
                <div class='text-sm text-text-muted mb-8'>
                    {t('staticPages.common.lastUpdated')} {lastUpdated}
                </div>

                {loading && (
                    <div class='flex justify-center py-12'>
                        <LoadingSpinner size='md' />
                    </div>
                )}

                {error && (
                    <div class='bg-surface-error border border-border-error rounded-md p-4'>
                        <div class='flex'>
                            <div class='flex-shrink-0'>
                                <XCircleIcon size={20} className='text-semantic-error/80' />
                            </div>
                            <div class='ml-3'>
                                <h3 class='text-sm font-medium text-semantic-error' role='alert' data-testid='cookie-policy-error-heading'>
                                    {t('staticPages.cookiePolicy.loadError')}
                                </h3>
                                <div class='mt-2 text-sm text-semantic-error' role='alert' data-testid='cookie-policy-error-message'>
                                    <p>{error}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {policy && <PolicyRenderer content={policy.text} />}
            </div>
        </StaticPageLayout>
    );
}
