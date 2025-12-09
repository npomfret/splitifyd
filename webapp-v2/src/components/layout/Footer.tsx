import { Clickable } from '@/components/ui/Clickable';
import { useConfig } from '@/hooks/useConfig.ts';
import { useTranslation } from 'react-i18next';

export function Footer() {
    const { t } = useTranslation();
    const config = useConfig();
    const footerLinks = config?.tenant?.brandingTokens?.tokens?.footer?.links ?? [];
    const legal = config?.tenant?.brandingTokens?.tokens?.legal;
    const hasFooterLinks = footerLinks.length > 0;

    return (
        <footer class='bg-surface-muted border-t border-border-default'>
            <div class='max-w-7xl mx-auto px-4 py-8'>
                <div class={`grid grid-cols-1 ${hasFooterLinks ? 'md:grid-cols-2' : ''} gap-8`}>
                    {/* Company Info - always shown */}
                    <div>
                        <h3 class='font-semibold text-text-primary mb-3'>
                            {legal?.appName ?? t('footer.companyName')}
                        </h3>
                        <p class='text-sm text-text-muted'>{t('footer.companyDescription')}</p>
                    </div>

                    {/* Footer Links - dynamically rendered from tenant config */}
                    {hasFooterLinks && (
                        <div>
                            <h3 class='font-semibold text-text-primary mb-3'>{t('footer.linksSection')}</h3>
                            <ul class='space-y-2'>
                                {footerLinks.map((link) => (
                                    <li key={link.id}>
                                        <Clickable
                                            as='a'
                                            href={link.url}
                                            target='_blank'
                                            rel='noopener noreferrer'
                                            className='text-sm text-text-muted hover:text-interactive-primary transition-colors'
                                            aria-label={`Open ${link.label} in new tab`}
                                            eventName='footer_link_click'
                                            eventProps={{ destination: link.id }}
                                        >
                                            {link.label}
                                        </Clickable>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>

                <div class='mt-8 pt-8 border-t border-border-default'>
                    <p class='text-center text-sm text-text-muted'>{t('footer.copyright')}</p>
                </div>
            </div>
        </footer>
    );
}
