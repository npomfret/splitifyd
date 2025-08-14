import { ComponentChildren } from 'preact';

interface CardProps {
  title?: string;
  subtitle?: string;
  children: ComponentChildren;
  onClick?: () => void;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  'data-testid'?: string;
}

export function Card({
  title,
  subtitle,
  children,
  onClick,
  className = '',
  padding = 'md',
  'data-testid': dataTestId
}: CardProps) {
  const paddingClasses = {
    none: 'p-0',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8'
  };

  const baseClasses = `
    bg-white rounded-lg shadow-sm border border-gray-200
    ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}
    ${paddingClasses[padding]}
    ${className}
  `.trim();

  const content = (
    <>
      {(title || subtitle) && (
        <div className="mb-4">
          {title && (
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          )}
          {subtitle && (
            <p className="text-sm text-gray-600 mt-1">{subtitle}</p>
          )}
        </div>
      )}
      {children}
    </>
  );

  if (onClick) {
    return (
      <div
        className={baseClasses}
        onClick={onClick}
        role="button"
        tabIndex={0}
        data-testid={dataTestId}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick();
          }
        }}
      >
        {content}
      </div>
    );
  }

  return <div className={baseClasses} data-testid={dataTestId}>{content}</div>;
}