import { ComponentChildren } from 'preact';

interface GroupDetailGridProps {
    leftSidebar: ComponentChildren;
    mainContent: ComponentChildren;
    rightSidebar: ComponentChildren;
}

export function GroupDetailGrid({ leftSidebar, mainContent, rightSidebar }: GroupDetailGridProps) {
    return (
        <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6'>
            <div className='grid grid-cols-1 lg:grid-cols-12 gap-6'>
                {/* Left sidebar - takes up 3 columns on large screens */}
                <div className='lg:col-span-3 space-y-4'>{leftSidebar}</div>

                {/* Main content area - takes up 6 columns on large screens */}
                <div className='lg:col-span-6'>{mainContent}</div>

                {/* Right sidebar - takes up 3 columns on large screens */}
                <div className='lg:col-span-3 space-y-4'>{rightSidebar}</div>
            </div>
        </div>
    );
}
