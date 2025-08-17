import { FeatureCard } from './FeatureCard';

const features: Array<{
    icon: string;
    title: string;
    description: string;
    iconColor: 'default' | 'green';
}> = [
    {
        icon: '/images/icons/groups.svg',
        title: 'Smart Group Management',
        description: 'Create groups for any occasion. Easily add members and track shared expenses in one place, keeping everyone on the same page.',
        iconColor: 'default',
    },
    {
        icon: '/images/icons/splitting.svg',
        title: 'Flexible Splitting',
        description: "Split bills equally, by exact amounts, or by percentages. We handle all the complex math, so you don't have to.",
        iconColor: 'default',
    },
    {
        icon: '/images/icons/simplify.svg',
        title: 'Debt Simplification',
        description: 'Our algorithm minimizes transactions, showing you the simplest way to settle up, saving everyone time and hassle.',
        iconColor: 'default',
    },
    {
        icon: '/images/icons/free.svg',
        title: '100% Free to Use',
        description: 'Our service is and always will be free. No hidden fees or premium tiers—just a powerful, accessible tool for everyone.',
        iconColor: 'green',
    },
    {
        icon: '/images/icons/unlimited.svg',
        title: 'Unlimited Use',
        description: 'Create as many groups, add as many friends, and track as many expenses as you need. No restrictions, no limits.',
        iconColor: 'green',
    },
    {
        icon: '/images/icons/no-ads.svg',
        title: 'Zero Ads, Ever',
        description: 'Enjoy a clean, focused experience. We will never sell your data or clutter your screen with ads. Your privacy is our priority.',
        iconColor: 'green',
    },
];

export function FeaturesGrid() {
    return (
        <section class="features py-20 bg-gray-50">
            <div class="container mx-auto px-4">
                <h2 class="text-3xl md:text-4xl font-bold text-center text-gray-900 mb-12">Everything You Need, Nothing You Don't</h2>

                <div class="feature-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {features.map((feature, index) => (
                        <FeatureCard key={index} {...feature} delay={index * 100} />
                    ))}
                </div>
            </div>
        </section>
    );
}
