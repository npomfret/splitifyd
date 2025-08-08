import { ComponentChildren } from 'preact';

interface GridContainerProps {
  children: ComponentChildren;
  className?: string;
  variant?: 'dashboard' | 'group-detail' | 'default';
}

export function GridContainer({
  children,
  className = '',
  variant = 'default'
}: GridContainerProps) {
  const getVariantClasses = () => {
    switch (variant) {
      case 'dashboard':
        return 'grid grid-cols-1 lg:grid-cols-12 gap-6 max-w-7xl mx-auto';
      case 'group-detail':
        return 'grid grid-cols-1 lg:grid-cols-12 gap-6 max-w-7xl mx-auto';
      default:
        return 'grid gap-6';
    }
  };

  return (
    <div className={`${getVariantClasses()} ${className}`.trim()}>
      {children}
    </div>
  );
}