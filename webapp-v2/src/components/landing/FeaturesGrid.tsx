import { useTranslation } from 'react-i18next';
import { FeatureCard } from './FeatureCard';

export function FeaturesGrid() {
    const { t } = useTranslation();

    const features: Array<{
        icon: string;
        title: string;
        description: string;
        iconColor: 'default' | 'green';
    }> = [
        {
            icon: '/images/icons/groups.svg',
            title: t('landing.features.smartGroupManagement.title'),
            description: t('landing.features.smartGroupManagement.description'),
            iconColor: 'default',
        },
        {
            icon: '/images/icons/splitting.svg',
            title: t('landing.features.flexibleSplitting.title'),
            description: t('landing.features.flexibleSplitting.description'),
            iconColor: 'default',
        },
        {
            icon: '/images/icons/simplify.svg',
            title: t('landing.features.debtSimplification.title'),
            description: t('landing.features.debtSimplification.description'),
            iconColor: 'default',
        },
        {
            icon: '/images/icons/free.svg',
            title: t('landing.features.freeToUse.title'),
            description: t('landing.features.freeToUse.description'),
            iconColor: 'green',
        },
        {
            icon: '/images/icons/unlimited.svg',
            title: t('landing.features.unlimitedUse.title'),
            description: t('landing.features.unlimitedUse.description'),
            iconColor: 'green',
        },
        {
            icon: '/images/icons/no-ads.svg',
            title: t('landing.features.noAds.title'),
            description: t('landing.features.noAds.description'),
            iconColor: 'green',
        },
    ];

    return (
        <section class='features py-20 bg-surface-muted'>
            <div class='container mx-auto px-4'>
                <h2 class='text-3xl md:text-4xl font-bold text-center text-text-primary mb-12'>{t('landing.features.sectionTitle')}</h2>

                <div class='feature-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8'>
                    {features.map((feature, index) => <FeatureCard key={index} {...feature} delay={index * 100} />)}
                </div>
            </div>
        </section>
    );
}
