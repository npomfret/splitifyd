import { ComponentChildren } from 'preact';
import { useTranslation } from 'react-i18next';
import { BaseLayout } from '@/components/layout';
import { Typography } from '../ui';

interface AuthLayoutProps {
    title: string;
    description?: string;
    children: ComponentChildren;
}

export function AuthLayout({ title, description, children }: AuthLayoutProps) {
    const { t } = useTranslation();
    return (
        <BaseLayout title={title} description={description || `${title}${t('authLayout.titleSuffix')}`} headerVariant='minimal' showHeaderAuth={false}>
            <main className='flex-1 flex items-center justify-center px-4 py-12 relative'>
                <div className='w-full max-w-md relative z-10'>
                    <div className='glass-panel rounded-(--radii-lg) p-8 shadow-(--shadows-lg) border border-(--semantics-colors-surface-glassborder)'>
                        <Typography
                            as='h1'
                            variant='display'
                            className='text-center mb-2'
                        >
                            {title}
                        </Typography>
                        {description && (
                            <Typography variant='body' className='text-center text-text-muted'>
                                {description}
                            </Typography>
                        )}
                        <div className='space-y-6 pt-6'>{children}</div>
                    </div>
                </div>
            </main>
        </BaseLayout>
    );
}
