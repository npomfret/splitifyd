import type { ComponentType } from 'preact';

interface IconProps {
    className?: string;
    'aria-hidden'?: boolean | 'true' | 'false';
}

interface SectionTitleProps {
    /** Heroicon component to display before the label */
    icon: ComponentType<IconProps>;
    /** Section label text */
    label: string;
    /** Additional class names */
    className?: string;
}

/**
 * A standardized section title with icon and label.
 *
 * Used primarily with SidebarCard's title prop to ensure consistent
 * section header styling across the application.
 *
 * @example
 * <SidebarCard
 *     title={<SectionTitle icon={BanknotesIcon} label={t('pages.groupDetailPage.paymentHistory')} />}
 *     collapsible
 * >
 *     {content}
 * </SidebarCard>
 */
export function SectionTitle({ icon: Icon, label, className = '' }: SectionTitleProps) {
    return (
        <div className={`flex items-center gap-2 ${className}`}>
            <Icon className='h-5 w-5 text-text-muted' aria-hidden='true' />
            <span>{label}</span>
        </div>
    );
}
