import { useNavigation } from '@/hooks/useNavigation';
import { configStore } from '@/stores/config-store';
import { useTranslation } from 'react-i18next';
import { StaticPageLayout } from '../../components/StaticPageLayout';
import { Clickable } from '@/components/ui/Clickable';

export function PricingPage() {
    const { t } = useTranslation();
    const navigation = useNavigation();
    const appName = configStore.appName;
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const canonical = `${baseUrl}/pricing`;

    const structuredData = {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: `${t('pricing.title')} - ${appName}`,
        description: t('pricing.description'),
        url: canonical,
        mainEntity: {
            '@type': 'Product',
            name: appName,
            description: 'Split bills easily with friends and family. Track expenses and settle debts effortlessly.',
            offers: [
                {
                    '@type': 'Offer',
                    name: 'Free Plan',
                    price: '0',
                    priceCurrency: 'USD',
                    description: 'Perfect for personal use with unlimited friends and expense tracking',
                },
            ],
        },
    };

    return (
        <StaticPageLayout title={t('pricing.title')} description={t('pricing.description')} canonical={canonical} structuredData={structuredData}>
            <div class='space-y-8'>
                {/* Pricing Hero */}
                <div class='text-center'>
                    <h2 class='text-2xl font-bold text-text-primary mb-4'>{t('pricing.subtitle')}</h2>
                </div>

                {/* Pricing Cards */}
                <div class='grid grid-cols-1 md:grid-cols-3 gap-8'>
                    {/* Just Getting Started Plan */}
                    <div class='border border-border-default rounded-lg p-6 bg-surface-base'>
                        <div class='text-center'>
                            <h3 class='text-xl font-bold text-text-primary mb-2'>{t('pricing.plans.starter.title')}</h3>
                            <div class='mb-4'>
                                <sup class='text-xl'>$</sup>
                                <span class='text-4xl font-bold'>0</span>
                                <span class='text-text-muted'>/month</span>
                            </div>
                        </div>

                        <ul class='space-y-3 mb-8'>
                            {(t('pricing.plans.starter.features', { returnObjects: true }) as string[]).map((feature: string, index: number) => (
                                <li key={index} class='flex items-start'>
                                    <svg class='w-5 h-5 text-semantic-success mr-3 mt-0.5' fill='currentColor' viewBox='0 0 20 20' aria-hidden='true' focusable='false'>
                                        <path
                                            fill-rule='evenodd'
                                            d='M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z'
                                            clip-rule='evenodd'
                                        />
                                    </svg>
                                    <span>{feature}</span>
                                </li>
                            ))}
                        </ul>

                        <Clickable
                            as='button'
                            type='button'
                            onClick={() => navigation.goToRegister()}
                            className='block w-full bg-interactive-primary text-interactive-primary-foreground text-center py-2 px-4 rounded-lg hover:opacity-90 transition-opacity'
                            aria-label='Get started with free plan'
                            eventName='pricing_plan_select'
                            eventProps={{ plan: 'starter' }}
                        >
                            {t('pricing.plans.starter.button')}
                        </Clickable>
                    </div>

                    {/* I'm Basically a Pro Plan */}
                    <div class='border-2 border-interactive-primary rounded-lg p-6 relative bg-surface-base'>
                        <div class='absolute -top-3 left-1/2 transform -translate-x-1/2 bg-interactive-secondary text-interactive-secondary-foreground px-3 py-1 rounded text-sm'>
                            {t('pricing.plans.pro.badge')}
                        </div>
                        <div class='text-center'>
                            <h3 class='text-xl font-bold text-text-primary mb-2'>{t('pricing.plans.pro.title')}</h3>
                            <div class='mb-4'>
                                <sup class='text-xl'>$</sup>
                                <span class='text-4xl font-bold'>0</span>
                                <span class='text-text-muted'>/month</span>
                            </div>
                        </div>

                        <ul class='space-y-3 mb-8'>
                            {(t('pricing.plans.pro.features', { returnObjects: true }) as string[]).map((feature: string, index: number) => (
                                <li key={index} class='flex items-start'>
                                    <svg class='w-5 h-5 text-semantic-success mr-3 mt-0.5' fill='currentColor' viewBox='0 0 20 20' aria-hidden='true' focusable='false'>
                                        <path
                                            fill-rule='evenodd'
                                            d='M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z'
                                            clip-rule='evenodd'
                                        />
                                    </svg>
                                    <span>{feature}</span>
                                </li>
                            ))}
                        </ul>

                        <Clickable
                            as='button'
                            type='button'
                            onClick={() => navigation.goToRegister()}
                            className='block w-full bg-interactive-primary text-interactive-primary-foreground text-center py-2 px-4 rounded-lg hover:opacity-90 transition-opacity'
                            aria-label='Get started with pro plan'
                            eventName='pricing_plan_select'
                            eventProps={{ plan: 'pro' }}
                        >
                            {t('pricing.plans.pro.button')}
                        </Clickable>
                    </div>

                    {/* I'm a Philanthropist Plan */}
                    <div class='border border-border-default rounded-lg p-6 bg-surface-base'>
                        <div class='text-center'>
                            <h3 class='text-xl font-bold text-text-primary mb-2'>{t('pricing.plans.philanthropist.title')}</h3>
                            <div class='mb-4'>
                                <sup class='text-xl'>$</sup>
                                <span class='text-4xl font-bold'>0</span>
                                <span class='text-text-muted'>/month</span>
                            </div>
                        </div>

                        <ul class='space-y-3 mb-8'>
                            {(t('pricing.plans.philanthropist.features', { returnObjects: true }) as string[]).map((feature: string, index: number) => (
                                <li key={index} class='flex items-start'>
                                    <svg class='w-5 h-5 text-semantic-success mr-3 mt-0.5' fill='currentColor' viewBox='0 0 20 20' aria-hidden='true' focusable='false'>
                                        <path
                                            fill-rule='evenodd'
                                            d='M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z'
                                            clip-rule='evenodd'
                                        />
                                    </svg>
                                    <span>{feature}</span>
                                </li>
                            ))}
                        </ul>

                        <Clickable
                            as='button'
                            type='button'
                            onClick={() => navigation.goToRegister()}
                            className='block w-full bg-interactive-primary text-interactive-primary-foreground text-center py-2 px-4 rounded-lg hover:opacity-90 transition-opacity'
                            aria-label='Get started with philanthropist plan'
                            eventName='pricing_plan_select'
                            eventProps={{ plan: 'philanthropist' }}
                        >
                            {t('pricing.plans.philanthropist.button')}
                        </Clickable>
                    </div>
                </div>

                {/* Transparency Notice */}
                <div class='bg-surface-warning border border-border-warning rounded-lg p-6'>
                    <p class='text-text-primary'>{t('pricing.disclaimer')}</p>
                </div>
            </div>
        </StaticPageLayout>
    );
}
