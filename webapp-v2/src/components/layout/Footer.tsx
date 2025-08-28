import { useTranslation } from 'react-i18next';
import { useNavigation } from '@/hooks/useNavigation';

export function Footer() {
    const { t } = useTranslation();
    const navigation = useNavigation();
    return (
        <footer class="bg-gray-100 border-t border-gray-200">
            <div class="max-w-7xl mx-auto px-4 py-8">
                <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {/* Company Info */}
                    <div>
                        <h3 class="font-semibold text-gray-900 mb-3">{t('footer.companyName')}</h3>
                        <p class="text-sm text-gray-600">{t('footer.companyDescription')}</p>
                    </div>

                    {/* Product Links */}
                    <div>
                        <h3 class="font-semibold text-gray-900 mb-3">{t('footer.productSection')}</h3>
                        <ul class="space-y-2">
                            <li>
                                <button 
                                    onClick={() => navigation.goToPricing()}
                                    class="text-sm text-gray-600 hover:text-purple-600 transition-colors" 
                                    data-testid="footer-pricing-link"
                                >
                                    {t('footer.pricing')}
                                </button>
                            </li>
                        </ul>
                    </div>

                    {/* Legal Links */}
                    <div>
                        <h3 class="font-semibold text-gray-900 mb-3">{t('footer.legalSection')}</h3>
                        <ul class="space-y-2">
                            <li>
                                <button 
                                    onClick={() => navigation.goToTerms()}
                                    class="text-sm text-gray-600 hover:text-purple-600 transition-colors" 
                                    data-testid="footer-terms-link"
                                >
                                    {t('footer.termsOfService')}
                                </button>
                            </li>
                            <li>
                                <button 
                                    onClick={() => navigation.goToPrivacyPolicy()}
                                    class="text-sm text-gray-600 hover:text-purple-600 transition-colors" 
                                    data-testid="footer-privacy-link"
                                >
                                    {t('footer.privacyPolicy')}
                                </button>
                            </li>
                            <li>
                                <button 
                                    onClick={() => navigation.goToCookiePolicy()}
                                    class="text-sm text-gray-600 hover:text-purple-600 transition-colors" 
                                    data-testid="footer-cookies-link"
                                >
                                    {t('footer.cookiePolicy')}
                                </button>
                            </li>
                        </ul>
                    </div>
                </div>

                <div class="mt-8 pt-8 border-t border-gray-200">
                    <p class="text-center text-sm text-gray-500">{t('footer.copyright')}</p>
                </div>
            </div>
        </footer>
    );
}
