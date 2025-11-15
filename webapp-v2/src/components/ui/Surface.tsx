import { cx } from '@/utils/cx.ts';
import type { ComponentChildren, JSX } from 'preact';

type DivProps = Omit<JSX.HTMLAttributes<HTMLDivElement>, 'className' | 'children'>;

interface SurfaceProps extends DivProps {
    variant?: 'base' | 'muted' | 'inverted' | 'glass';
    padding?: 'none' | 'sm' | 'md' | 'lg';
    shadow?: 'none' | 'sm' | 'md' | 'lg';
    border?: 'none' | 'default' | 'strong';
    interactive?: boolean;
    children: ComponentChildren;
    className?: string;
}

const variantClasses = {
    base: 'bg-surface-base text-text-primary',
    muted: 'bg-surface-muted text-text-primary',
    inverted: 'bg-text-primary text-surface-base',
    glass: 'glass-panel text-text-primary',
} as const;

const paddingClasses = {
    none: 'p-0',
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6',
} as const;

const shadowClasses = {
    none: 'shadow-none',
    sm: 'shadow-sm',
    md: 'shadow-md',
    lg: 'shadow-lg',
} as const;

const borderClasses = {
    none: 'border border-transparent',
    default: 'border border-border-default',
    strong: 'border border-border-strong',
} as const;

export function Surface({
    variant = 'base',
    padding = 'md',
    shadow = 'sm',
    border = 'default',
    interactive = false,
    className = '',
    children,
    ...rest
}: SurfaceProps) {
    return (
        <div
            {...rest}
            className={cx(
                'rounded-xl transition-shadow duration-200',
                variantClasses[variant],
                paddingClasses[padding],
                shadowClasses[shadow],
                borderClasses[border],
                interactive && 'cursor-pointer hover:shadow-lg',
                className,
            )}
        >
            {children}
        </div>
    );
}
