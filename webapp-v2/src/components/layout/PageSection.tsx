import { Stack, Typography } from '@/components/ui';
import type { ComponentChildren } from 'preact';

interface PageSectionProps {
    /** Section title */
    title?: string;
    /** Optional actions to display in the header */
    actions?: ComponentChildren;
    /** Section content */
    children: ComponentChildren;
    /** Optional aria-labelledby ID for accessibility */
    ariaLabelledBy?: string;
    /** Whether to use glass-panel styling (default: true) */
    glass?: boolean;
}

/**
 * Standardized content section wrapper with optional header.
 * Provides consistent glass-panel styling and header layout.
 *
 * @example
 * <PageSection
 *   title="Recent Groups"
 *   actions={<Button>Create</Button>}
 * >
 *   <GroupsList />
 * </PageSection>
 */
export function PageSection({ title, actions, children, ariaLabelledBy, glass = true }: PageSectionProps) {
    const hasHeader = title || actions;
    const headingId = ariaLabelledBy || (title ? `section-${title.toLowerCase().replace(/\s+/g, '-')}` : undefined);

    const content = (
        <Stack spacing='lg'>
            {hasHeader && (
                <div className='flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between'>
                    {title && (
                        <Typography variant='heading' as='h3' id={headingId} className='font-bold'>
                            {title}
                        </Typography>
                    )}
                    {actions && <div className='flex flex-wrap items-center gap-4'>{actions}</div>}
                </div>
            )}
            {children}
        </Stack>
    );

    if (glass) {
        return (
            <section
                className='glass-panel border-border-default rounded-lg shadow-lg border p-6 sm:p-8'
                aria-labelledby={headingId}
            >
                {content}
            </section>
        );
    }

    return (
        <section aria-labelledby={headingId}>
            {content}
        </section>
    );
}
