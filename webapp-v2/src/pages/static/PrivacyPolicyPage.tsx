import { LoadingSpinner } from '@/components/ui';
import { usePolicy } from '@/hooks/usePolicy.ts';
import { configStore } from '@/stores/config-store';
import { useTranslation } from 'react-i18next';
import { PolicyRenderer } from '../../components/policy/PolicyRenderer';
import { StaticPageLayout } from '../../components/StaticPageLayout';

export function PrivacyPolicyPage() {
    const { t } = useTranslation();
    const { policy, loading, error } = usePolicy('PRIVACY_POLICY');
    const appName = configStore.appName;

    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const canonical = `${baseUrl}/privacy-policy`;

    // Use policy creation date if available, fallback to static date
    const lastUpdated = policy?.createdAt ? new Date(policy.createdAt).toLocaleDateString() : 'January 22, 2025';

    const structuredData = {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: `${t('staticPages.privacyPolicy.title')} - ${appName}`,
        description: t('staticPages.privacyPolicy.description'),
        url: canonical,
        dateModified: lastUpdated,
        publisher: {
            '@type': 'Organization',
            name: appName,
        },
    };

    return (
        <StaticPageLayout title={t('staticPages.privacyPolicy.title')} description={t('staticPages.privacyPolicy.description')} canonical={canonical} structuredData={structuredData}>
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
                                <svg class='h-5 w-5 text-semantic-error/80' viewBox='0 0 20 20' fill='currentColor' aria-hidden='true' focusable='false'>
                                    <path
                                        fill-rule='evenodd'
                                        d='M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z'
                                        clip-rule='evenodd'
                                    />
                                </svg>
                            </div>
                            <div class='ml-3'>
                                <h3 class='text-sm font-medium text-semantic-error' role='alert' data-testid='privacy-policy-error-heading'>
                                    {t('staticPages.privacyPolicy.loadError')}
                                </h3>
                                <div class='mt-2 text-sm text-semantic-error' role='alert' data-testid='privacy-policy-error-message'>
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
