import { ComponentChildren } from 'preact';

interface DashboardGridProps {
    mainContent: ComponentChildren;
    sidebarContent?: ComponentChildren;
}

export function DashboardGrid({ mainContent, sidebarContent }: DashboardGridProps) {
    const hasSidebar = !!sidebarContent;

    return (
        <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8'>
            <div className='grid grid-cols-1 lg:grid-cols-12 gap-6'>
                {/* Main content area - full width when no sidebar, 8 columns when sidebar present */}
                <div className={hasSidebar ? 'lg:col-span-8' : 'lg:col-span-12'}>{mainContent}</div>

                {/* Sidebar - takes up 4 columns on large screens */}
                {sidebarContent && <div className='lg:col-span-4'>{sidebarContent}</div>}
            </div>
        </div>
    );
}
