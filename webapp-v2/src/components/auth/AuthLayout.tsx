import { ComponentChildren } from 'preact';
import { BaseLayout } from '../layout/BaseLayout';

interface AuthLayoutProps {
    title: string;
    description?: string;
    children: ComponentChildren;
}

export function AuthLayout({ title, description, children }: AuthLayoutProps) {
    return (
        <BaseLayout title={title} description={description || `${title} - Splitifyd`} headerVariant="minimal">
            <main class="flex-1 flex items-center justify-center px-4 py-12">
                <div class="w-full max-w-md">
                    <div class="bg-white rounded-lg shadow-md border p-8">
                        <h1 class="text-2xl font-bold text-gray-900 text-center mb-8">{title}</h1>
                        {children}
                    </div>
                </div>
            </main>
        </BaseLayout>
    );
}
