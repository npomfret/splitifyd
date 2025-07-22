import { ComponentChildren } from 'preact';

interface StackProps {
  direction?: 'horizontal' | 'vertical';
  spacing?: 'xs' | 'sm' | 'md' | 'lg';
  align?: 'start' | 'center' | 'end' | 'stretch';
  children: ComponentChildren;
  className?: string;
}

export function Stack({
  direction = 'vertical',
  spacing = 'md',
  align = 'stretch',
  children,
  className = ''
}: StackProps) {
  const spacingClasses = {
    horizontal: {
      xs: 'space-x-1',
      sm: 'space-x-2',
      md: 'space-x-4',
      lg: 'space-x-6'
    },
    vertical: {
      xs: 'space-y-1',
      sm: 'space-y-2',
      md: 'space-y-4',
      lg: 'space-y-6'
    }
  };

  const alignClasses = {
    start: 'items-start',
    center: 'items-center',
    end: 'items-end',
    stretch: 'items-stretch'
  };

  return (
    <div
      className={`
        flex
        ${direction === 'horizontal' ? 'flex-row' : 'flex-col'}
        ${spacingClasses[direction][spacing]}
        ${alignClasses[align]}
        ${className}
      `.trim()}
    >
      {children}
    </div>
  );
}