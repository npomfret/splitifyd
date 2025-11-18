import { cx } from '@/utils/cx.ts';
import { ComponentChildren } from 'preact';

interface StackProps {
    direction?: 'horizontal' | 'vertical';
    spacing?: 'xs' | 'sm' | 'md' | 'lg';
    align?: 'start' | 'center' | 'end' | 'stretch';
    children: ComponentChildren;
    className?: string;
}

export function Stack({ direction = 'vertical', spacing = 'md', align = 'stretch', children, className = '' }: StackProps) {
    const gapValues = {
        xs: 'var(--spacing-xs, 0.25rem)',
        sm: 'var(--spacing-sm, 0.5rem)',
        md: 'var(--spacing-md, 0.75rem)',
        lg: 'var(--spacing-lg, 1rem)',
    };

    const alignClasses = {
        start: 'items-start',
        center: 'items-center',
        end: 'items-end',
        stretch: 'items-stretch',
    };

    return (
        <div
            className={cx('flex', direction === 'horizontal' ? 'flex-row' : 'flex-col', alignClasses[align], className)}
            style={{ gap: gapValues[spacing] }}
        >
            {children}
        </div>
    );
}
