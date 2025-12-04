import { Clickable } from '@/components/ui/Clickable';
import { useConfig } from '@/hooks/useConfig.ts';
import { useNavigation } from '@/hooks/useNavigation';
import { useTranslation } from 'react-i18next';

export function Footer() {
    const { t } = useTranslation();
    const navigation = useNavigation();
    const config = useConfig();
    const marketingFlags = config?.tenant?.branding?.marketingFlags;
    const showPricingPage = marketingFlags?.showPricingPage ?? false;
    const gridColumnsClass = showPricingPage ? 'md:grid-cols-3' : 'md:grid-cols-2';

    return (
        <footer class='bg-surface-muted border-t border-border-default'>
            <div class='max-w-7xl mx-auto px-4 py-8'>
                <div class={`grid grid-cols-1 ${gridColumnsClass} gap-8`}>
                    {/* Company Info */}
                    <div>
                        <h3 class='font-semibold text-text-primary mb-3'>{t('footer.companyName')}</h3>
                        <p class='text-sm text-text-muted'>{t('footer.companyDescription')}</p>
                    </div>

                    {/* Product Links */}
                    {showPricingPage && (
                        <div>
                            <h3 class='font-semibold text-text-primary mb-3'>{t('footer.productSection')}</h3>
                            <ul class='space-y-2'>
                                <li>
                                    <Clickable
                                        as='button'
                                        type='button'
                                        onClick={() => navigation.goToPricing()}
                                        className='text-sm text-text-muted hover:text-interactive-primary transition-colors'
                                        aria-label='Go to pricing page'
                                        eventName='footer_link_click'
                                        eventProps={{ destination: 'pricing' }}
                                    >
                                        {t('footer.pricing')}
                                    </Clickable>
                                </li>
                            </ul>
                        </div>
                    )}

                    {/* Legal Links */}
                    <div>
                        <h3 class='font-semibold text-text-primary mb-3'>{t('footer.legalSection')}</h3>
                        <ul class='space-y-2'>
                            <li>
                                <Clickable
                                    as='button'
                                    type='button'
                                    onClick={() => navigation.goToTerms()}
                                    className='text-sm text-text-muted hover:text-interactive-primary transition-colors'
                                    aria-label='Go to terms of service'
                                    eventName='footer_link_click'
                                    eventProps={{ destination: 'terms' }}
                                >
                                    {t('footer.termsOfService')}
                                </Clickable>
                            </li>
                            <li>
                                <Clickable
                                    as='button'
                                    type='button'
                                    onClick={() => navigation.goToPrivacyPolicy()}
                                    className='text-sm text-text-muted hover:text-interactive-primary transition-colors'
                                    aria-label='Go to privacy policy'
                                    eventName='footer_link_click'
                                    eventProps={{ destination: 'privacy' }}
                                >
                                    {t('footer.privacyPolicy')}
                                </Clickable>
                            </li>
                            <li>
                                <Clickable
                                    as='button'
                                    type='button'
                                    onClick={() => navigation.goToCookiePolicy()}
                                    className='text-sm text-text-muted hover:text-interactive-primary transition-colors'
                                    aria-label='Go to cookie policy'
                                    eventName='footer_link_click'
                                    eventProps={{ destination: 'cookies' }}
                                >
                                    {t('footer.cookiePolicy')}
                                </Clickable>
                            </li>
                        </ul>
                    </div>
                </div>

                <div class='mt-8 pt-8 border-t border-border-default'>
                    <p class='text-center text-sm text-text-muted'>{t('footer.copyright')}</p>
                </div>
            </div>
        </footer>
    );
}
