import { ComponentChildren } from 'preact';

interface SidebarCardProps {
  title?: string;
  children: ComponentChildren;
  className?: string;
}

export function SidebarCard({ title, children, className = '' }: SidebarCardProps) {
  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 p-4 ${className}`.trim()}>
      {title && (
        <h3 className="text-base font-semibold text-gray-900 mb-3">{title}</h3>
      )}
      {children}
    </div>
  );
}