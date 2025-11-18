import { ComponentChildren } from 'preact';
import { useTranslation } from 'react-i18next';
import { BaseLayout } from '../layout/BaseLayout';
import { Typography } from '../ui';

interface AuthLayoutProps {
    title: string;
    description?: string;
    children: ComponentChildren;
}

export function AuthLayout({ title, description, children }: AuthLayoutProps) {
    const { t } = useTranslation();
    return (
        <BaseLayout title={title} description={description || `${title}${t('authLayout.titleSuffix')}`} headerVariant='minimal'>
            <main class='flex-1 flex items-center justify-center px-4 py-12 relative'>
                <div class='w-full max-w-md relative z-10'>
                    <div class='glass-panel rounded-[var(--radii-lg)] p-8 shadow-[var(--shadows-lg)] border border-[var(--semantics-colors-surface-glassborder)]'>
                        <Typography
                            as='h1'
                            variant='display'
                            className='text-center mb-2 bg-gradient-to-br from-[var(--semantics-colors-text-primary)] to-[var(--semantics-colors-text-accent)] bg-clip-text text-transparent'
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
