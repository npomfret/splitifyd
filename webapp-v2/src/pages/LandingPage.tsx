import { useConfig } from '@/hooks/useConfig.ts';
import { useTranslation } from 'react-i18next';
import { CTASection } from '../components/landing/CTASection';
import { FeaturesGrid } from '../components/landing/FeaturesGrid';
import { HeroSection } from '../components/landing/HeroSection';
import { BaseLayout } from '../components/layout/BaseLayout';
import '../styles/landing.css';

export function LandingPage() {
    const { t } = useTranslation();
    const config = useConfig();
    const marketingFlags = config?.tenant?.branding?.marketingFlags ?? {};
    const showMarketingContent = marketingFlags.showMarketingContent ?? false;

    return (
        <BaseLayout title={t('pages.landingPage.title')} description={t('pages.landingPage.description')}>
            <div class='bg-surface-muted'>
                <main class='pt-16'>
                    <HeroSection />
                    {showMarketingContent && (
                        <>
                            <FeaturesGrid />
                            <CTASection />
                        </>
                    )}

                    {/* Transparency Notice */}
                    <section class='transparency-notice py-8 bg-surface-muted'>
                        <div class='container mx-auto px-4'>
                            <div class='transparency-content text-center text-text-muted'>
                                <p>
                                    <strong class='text-text-primary'>{t('pages.landingPage.transparencyNotice.bold')}</strong> {t('pages.landingPage.transparencyNotice.text')}
                                </p>
                            </div>
                        </div>
                    </section>
                </main>
            </div>
        </BaseLayout>
    );
}
