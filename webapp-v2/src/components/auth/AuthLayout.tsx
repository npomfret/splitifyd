import { ComponentChildren } from 'preact';
import { useTranslation } from 'react-i18next';
import { BaseLayout } from '../layout/BaseLayout';
import { Card, Typography } from '../ui';

interface AuthLayoutProps {
    title: string;
    description?: string;
    children: ComponentChildren;
}

export function AuthLayout({ title, description, children }: AuthLayoutProps) {
    const { t } = useTranslation();
    return (
        <BaseLayout title={title} description={description || `${title}${t('authLayout.titleSuffix')}`} headerVariant='minimal'>
            <main class='flex-1 bg-surface-muted flex items-center justify-center px-4 py-12'>
                <div class='w-full max-w-md'>
                    <Card padding='lg' className='shadow-lg border border-border-default'>
                        <Typography as='h1' variant='display' className='text-center mb-2'>
                            {title}
                        </Typography>
                        {description && (
                            <Typography variant='body' className='text-center text-text-muted'>
                                {description}
                            </Typography>
                        )}
                        <div className='space-y-6 pt-6'>{children}</div>
                    </Card>
                </div>
            </main>
        </BaseLayout>
    );
}
