import { ComponentChildren } from 'preact';

interface DashboardGridProps {
  mainContent: ComponentChildren;
  sidebarContent?: ComponentChildren;
}

export function DashboardGrid({ mainContent, sidebarContent }: DashboardGridProps) {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Main content area - takes up 8 columns on large screens */}
        <div className="lg:col-span-8">
          {mainContent}
        </div>
        
        {/* Sidebar - takes up 4 columns on large screens */}
        {sidebarContent && (
          <div className="lg:col-span-4">
            {sidebarContent}
          </div>
        )}
      </div>
    </div>
  );
}