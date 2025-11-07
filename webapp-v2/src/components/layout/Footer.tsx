import { useNavigation } from '@/hooks/useNavigation';
import { useConfig } from '@/hooks/useConfig.ts';
import { useTranslation } from 'react-i18next';

export function Footer() {
    const { t } = useTranslation();
    const navigation = useNavigation();
    const config = useConfig();
    const marketingFlags = config?.tenant?.branding?.marketingFlags;
    const showPricingPage = marketingFlags?.showPricingPage ?? false;
    const gridColumnsClass = showPricingPage ? 'md:grid-cols-3' : 'md:grid-cols-2';

    return (
        <footer class='bg-gray-100 border-t border-primary-100'>
            <div class='max-w-7xl mx-auto px-4 py-8'>
                <div class={`grid grid-cols-1 ${gridColumnsClass} gap-8`}>
                    {/* Company Info */}
                    <div>
                        <h3 class='font-semibold text-gray-900 mb-3'>{t('footer.companyName')}</h3>
                        <p class='text-sm text-gray-600'>{t('footer.companyDescription')}</p>
                    </div>

                    {/* Product Links */}
                    {showPricingPage && (
                        <div>
                            <h3 class='font-semibold text-gray-900 mb-3'>{t('footer.productSection')}</h3>
                            <ul class='space-y-2'>
                                <li>
                                    <button
                                        onClick={() => navigation.goToPricing()}
                                        class='text-sm text-gray-600 hover:text-primary transition-colors'
                                        data-testid='footer-pricing-link'
                                    >
                                        {t('footer.pricing')}
                                    </button>
                                </li>
                            </ul>
                        </div>
                    )}

                    {/* Legal Links */}
                    <div>
                        <h3 class='font-semibold text-gray-900 mb-3'>{t('footer.legalSection')}</h3>
                        <ul class='space-y-2'>
                            <li>
                                <button onClick={() => navigation.goToTerms()} class='text-sm text-gray-600 hover:text-primary transition-colors' data-testid='footer-terms-link'>
                                    {t('footer.termsOfService')}
                                </button>
                            </li>
                            <li>
                                <button onClick={() => navigation.goToPrivacyPolicy()} class='text-sm text-gray-600 hover:text-primary transition-colors' data-testid='footer-privacy-link'>
                                    {t('footer.privacyPolicy')}
                                </button>
                            </li>
                            <li>
                                <button onClick={() => navigation.goToCookiePolicy()} class='text-sm text-gray-600 hover:text-primary transition-colors' data-testid='footer-cookies-link'>
                                    {t('footer.cookiePolicy')}
                                </button>
                            </li>
                        </ul>
                    </div>
                </div>

                <div class='mt-8 pt-8 border-t border-primary-100'>
                    <p class='text-center text-sm text-gray-500'>{t('footer.copyright')}</p>
                </div>
            </div>
        </footer>
    );
}
