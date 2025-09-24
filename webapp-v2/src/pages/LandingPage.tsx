import { useTranslation } from 'react-i18next';
import { BaseLayout } from '../components/layout/BaseLayout';
import { HeroSection } from '../components/landing/HeroSection';
import { FeaturesGrid } from '../components/landing/FeaturesGrid';
import { CTASection } from '../components/landing/CTASection';
import '../styles/landing.css';

export function LandingPage() {
    const { t } = useTranslation();

    return (
        <BaseLayout
            title={t('pages.landingPage.title')}
            description="Say goodbye to awkward IOUs and complex calculations. Our app makes sharing expenses with friends, family, and roommates easy, fair, and transparent. It's 100% free, with no ads and no limits."
        >
            <div class="bg-white">
                <main class="pt-16">
                    <HeroSection />
                    <FeaturesGrid />
                    <CTASection />

                    {/* Transparency Notice */}
                    <section class="transparency-notice py-8 bg-gray-50">
                        <div class="container mx-auto px-4">
                            <div class="transparency-content text-center text-gray-600">
                                <p>
                                    <strong class="text-gray-800">This is a tool for tracking expenses, not for making payments.</strong> To save and manage your expenses, you'll need a free account.
                                    We will never ask for sensitive financial details.
                                </p>
                            </div>
                        </div>
                    </section>
                </main>
            </div>
        </BaseLayout>
    );
}
