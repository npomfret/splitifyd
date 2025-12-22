import { Stack, Typography } from '@/components/ui';
import type { ComponentChildren } from 'preact';

interface PageHeaderProps {
    /** Optional eyebrow label above the title */
    label?: string;
    /** Main page title (required) */
    title: string;
    /** Optional description below the title */
    description?: string;
    /** Optional actions to display on the right side */
    actions?: ComponentChildren;
}

/**
 * Standardized page header component for hero sections.
 * Provides consistent styling for page titles across the application.
 *
 * @example
 * <PageHeader
 *   label="Account"
 *   title="Settings"
 *   description="Manage your account preferences and security settings."
 * />
 */
export function PageHeader({ label, title, description, actions }: PageHeaderProps) {
    return (
        <div className='flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between'>
            <Stack spacing='xs'>
                {label && (
                    <Typography variant='eyebrow' className='text-interactive-primary'>
                        {label}
                    </Typography>
                )}
                <Typography variant='display' className='font-semibold'>
                    {title}
                </Typography>
                {description && <p className='max-w-2xl help-text sm:text-base'>{description}</p>}
            </Stack>
            {actions && <div className='shrink-0'>{actions}</div>}
        </div>
    );
}
