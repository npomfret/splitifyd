import { ComponentChildren } from 'preact';
import { useTranslation } from 'react-i18next';
import { SEOHead } from '../SEOHead';
import { Footer } from './Footer';
import { Header } from './Header';

interface BaseLayoutProps {
    children: ComponentChildren;
    title?: string;
    description?: string;
    canonical?: string;
    ogImage?: string;
    structuredData?: any;
    headerVariant?: 'default' | 'minimal' | 'dashboard';
    showHeader?: boolean;
    showFooter?: boolean;
    showHeaderAuth?: boolean;
}

export function BaseLayout(
    { children, title, description, canonical, ogImage, structuredData, headerVariant = 'default', showHeader = true, showFooter = true, showHeaderAuth = true }: BaseLayoutProps,
) {
    const { t } = useTranslation();

    return (
        <div className='min-h-screen flex flex-col'>
            {title && <SEOHead title={title} description={description || title} canonical={canonical} ogImage={ogImage} structuredData={structuredData} />}

            <a
                href='#main-content'
                className='sr-only focus:not-sr-only focus:absolute focus:top-4 focus:start-4 focus:z-60 focus:px-4 focus:py-2 focus:bg-surface-raised focus:text-text-primary focus:rounded-md focus:ring-2 focus:ring-interactive-primary focus:outline-hidden'
            >
                {t('accessibility.skipToContent')}
            </a>

            {showHeader && <Header variant={headerVariant} showAuth={showHeaderAuth} />}

            <main id='main-content' className='flex-1' tabIndex={-1}>
                {children}
            </main>

            {showFooter && <Footer />}
        </div>
    );
}
