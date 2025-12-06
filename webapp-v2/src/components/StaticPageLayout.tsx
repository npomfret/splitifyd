import { ComponentChildren } from 'preact';
import { BaseLayout } from './layout/BaseLayout';
import { Typography } from './ui/Typography';

interface StaticPageLayoutProps {
    title: string;
    description?: string;
    canonical?: string;
    ogImage?: string;
    structuredData?: any;
    children: ComponentChildren;
}

export function StaticPageLayout({ title, description, canonical, ogImage, structuredData, children }: StaticPageLayoutProps) {
    return (
        <BaseLayout title={title} description={description} canonical={canonical} ogImage={ogImage} structuredData={structuredData}>
            {/* Main Content */}
            <main class='max-w-4xl mx-auto px-4 py-12'>
                <div class='bg-surface-muted border-border-default rounded-lg shadow-sm p-8'>
                    <Typography variant='display' className='mb-6'>{title}</Typography>
                    <div class='prose max-w-none text-text-primary prose-headings:text-text-primary prose-a:text-interactive-primary'>{children}</div>
                </div>
            </main>
        </BaseLayout>
    );
}
