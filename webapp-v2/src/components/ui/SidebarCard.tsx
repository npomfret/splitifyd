import { ChevronDownIcon } from '@heroicons/react/24/outline';
import { ComponentChildren, JSX } from 'preact';
import { useState } from 'preact/hooks';

interface SidebarCardProps extends Omit<JSX.HTMLAttributes<HTMLDivElement>, 'children'> {
    title?: string;
    children: ComponentChildren;
    className?: string;
    collapsible?: boolean;
    defaultCollapsed?: boolean;
    collapseToggleTestId?: string;
    collapseToggleLabel?: string;
}

export function SidebarCard({
    title,
    children,
    className = '',
    collapsible = false,
    defaultCollapsed = false,
    collapseToggleTestId,
    collapseToggleLabel,
    ...divProps
}: SidebarCardProps) {
    const [collapsed, setCollapsed] = useState(collapsible && defaultCollapsed);

    const rootClassName = ['bg-white', 'rounded-lg', 'shadow-sm', 'border', 'border-gray-200', 'p-4', className].filter(Boolean).join(' ');
    const headerClasses = ['flex', 'items-center', 'justify-between', 'gap-2', !collapsed ? 'mb-3' : ''].filter(Boolean).join(' ');
    const toggleAriaLabel = collapseToggleLabel || (title ? `Toggle ${title} section` : 'Toggle section');

    const handleToggle = () => {
        if (!collapsible) return;
        setCollapsed((current) => !current);
    };

    return (
        <div {...divProps} className={rootClassName}>
            {title && (
                <div className={headerClasses}>
                    <h3 className='text-base font-semibold text-gray-900 flex-1'>{title}</h3>
                    {collapsible && (
                        <button
                            type='button'
                            onClick={handleToggle}
                            aria-label={toggleAriaLabel}
                            aria-expanded={!collapsed}
                            data-testid={collapseToggleTestId}
                            className='p-1 text-gray-400 hover:text-gray-600 rounded-full focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors duration-200'
                        >
                            <ChevronDownIcon
                                aria-hidden='true'
                                className={`h-5 w-5 transform transition-transform duration-200 ${collapsed ? '-rotate-90' : 'rotate-0'}`}
                            />
                        </button>
                    )}
                </div>
            )}
            {!collapsed && children}
        </div>
    );
}
