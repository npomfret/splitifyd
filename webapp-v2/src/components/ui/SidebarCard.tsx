import { ChevronDownIcon } from '@heroicons/react/24/outline';
import { ComponentChildren, JSX } from 'preact';
import { useState } from 'preact/hooks';
import { Tooltip } from './Tooltip';

interface SidebarCardProps extends Omit<JSX.HTMLAttributes<HTMLDivElement>, 'children' | 'title'> {
    title?: ComponentChildren;
    children: ComponentChildren;
    className?: string;
    collapsible?: boolean;
    defaultCollapsed?: boolean;
    collapseToggleTestId?: string;
    collapseToggleLabel?: string;
    headerActions?: ComponentChildren;
    /**
     * Accessible label for the sidebar card section.
     * When provided, renders with role="region" and aria-label for semantic identification.
     * Use this to enable `getByRole('region', { name: '...' })` in tests.
     */
    ariaLabel?: string;
}

export function SidebarCard({
    title,
    children,
    className = '',
    collapsible = false,
    defaultCollapsed = false,
    collapseToggleTestId,
    collapseToggleLabel,
    headerActions,
    ariaLabel,
    ...divProps
}: SidebarCardProps) {
    const [collapsed, setCollapsed] = useState(collapsible && defaultCollapsed);

    const rootClassName = ['glass-panel', 'rounded-lg', 'shadow-lg', 'border', 'border-border-default', 'p-4', className].filter(Boolean).join(' ');
    const headerClasses = ['flex', 'items-center', 'justify-between', 'gap-2', !collapsed ? 'mb-3' : ''].filter(Boolean).join(' ');
    const toggleAriaLabel = collapseToggleLabel || (typeof title === 'string' ? `Toggle ${title} section` : 'Toggle section');

    const handleToggle = () => {
        if (!collapsible) return;
        setCollapsed((current) => !current);
    };

    const renderedToggle = collapsible
        ? (
            <Tooltip content={toggleAriaLabel}>
                <button
                    type='button'
                    onClick={handleToggle}
                    aria-label={toggleAriaLabel}
                    aria-expanded={!collapsed}
                    data-testid={collapseToggleTestId}
                    className='p-1 text-text-muted/80 hover:text-text-muted rounded-full focus:outline-hidden focus:ring-2 focus:ring-interactive-primary focus:ring-offset-2 transition-colors duration-200'
                >
                    <ChevronDownIcon
                        aria-hidden='true'
                        className={`h-5 w-5 transform transition-transform duration-200 ${collapsed ? '-rotate-90' : 'rotate-0'}`}
                    />
                </button>
            </Tooltip>
        )
        : null;

    const hasHeaderControls = renderedToggle || headerActions;

    return (
        <div {...divProps} className={rootClassName} role={ariaLabel ? 'region' : undefined} aria-label={ariaLabel}>
            {title && (
                <div className={headerClasses}>
                    <h3 className='text-base font-semibold text-text-primary flex-1'>{title}</h3>
                    {hasHeaderControls && (
                        <div className='flex items-center gap-1.5'>
                            {headerActions}
                            {renderedToggle}
                        </div>
                    )}
                </div>
            )}
            {!collapsed && children}
        </div>
    );
}
