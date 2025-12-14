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
                {/* Left sidebar - 3 columns (members and actions) */}
                <div className='hidden lg:block lg:col-span-3 space-y-4'>{leftSidebar}</div>

                {/* Main content area - 5 columns (expenses list) */}
                <div className='lg:col-span-5'>{mainContent}</div>

                {/* Right sidebar - 4 columns (balances, activity, settlements) */}
                <div className='lg:col-span-4 space-y-4'>{rightSidebar}</div>
            </div>
        </div>
    );
}
