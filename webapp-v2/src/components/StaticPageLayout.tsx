import { ComponentChildren } from 'preact';
import { BaseLayout } from './layout/BaseLayout';

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
                <div class='bg-white rounded-lg shadow-sm p-8'>
                    <h1 class='text-3xl font-bold text-gray-900 mb-6'>{title}</h1>
                    <div class='prose prose-gray max-w-none'>{children}</div>
                </div>
            </main>
        </BaseLayout>
    );
}
