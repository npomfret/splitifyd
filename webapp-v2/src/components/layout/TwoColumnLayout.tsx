import { Stack } from '@/components/ui';
import { cx } from '@/utils/cx';
import type { ComponentChildren } from 'preact';

type SidebarWidth = 'narrow' | 'medium' | 'wide';

interface TwoColumnLayoutProps {
    /** Sidebar content */
    sidebar: ComponentChildren;
    /** Main content */
    children: ComponentChildren;
    /** Sidebar width preset (default: 'medium') */
    sidebarWidth?: SidebarWidth;
    /** Whether sidebar should stick to top when scrolling */
    stickyHeader?: boolean;
    /** Gap size between columns */
    gap?: 'sm' | 'md' | 'lg';
}

const sidebarWidthClasses: Record<SidebarWidth, string> = {
    narrow: 'lg:grid-cols-[280px_1fr]',
    medium: 'lg:grid-cols-[320px_1fr] xl:grid-cols-[360px_1fr]',
    wide: 'lg:grid-cols-[400px_1fr]',
};

const gapClasses: Record<'sm' | 'md' | 'lg', string> = {
    sm: 'gap-4',
    md: 'gap-6',
    lg: 'gap-8',
};

/**
 * Two-column layout with sidebar and main content.
 * On mobile, sidebar stacks above main content.
 *
 * @example
 * <TwoColumnLayout
 *   sidebar={<ProfileCard />}
 *   sidebarWidth="medium"
 *   stickyHeader
 * >
 *   <FormSection title="Profile">...</FormSection>
 *   <FormSection title="Password">...</FormSection>
 * </TwoColumnLayout>
 */
export function TwoColumnLayout({
    sidebar,
    children,
    sidebarWidth = 'medium',
    stickyHeader = false,
    gap = 'md',
}: TwoColumnLayoutProps) {
    return (
        <div className={cx('grid grid-cols-1', sidebarWidthClasses[sidebarWidth], gapClasses[gap])}>
            <div className={cx(stickyHeader && 'lg:sticky lg:top-24')}>
                {sidebar}
            </div>
            <Stack spacing='md'>
                {children}
            </Stack>
        </div>
    );
}
