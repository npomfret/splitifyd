import { cx } from '@/utils/cx.ts';
import type { ComponentChildren, VNode } from 'preact';

type BadgeVariant = 'primary' | 'success' | 'warning' | 'error';

interface BadgeProps {
    children: ComponentChildren;
    variant?: BadgeVariant;
    className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
    primary: 'badge-primary',
    success: 'badge-success',
    warning: 'badge-warning',
    error: 'badge-error',
};

/**
 * Badge component for labels, tags, and status indicators.
 * Uses the `badge` and `badge-{variant}` utility classes for consistent styling.
 *
 * @example
 * <Badge variant="primary">Active</Badge>
 * <Badge variant="success">Completed</Badge>
 * <Badge variant="warning">Pending</Badge>
 * <Badge variant="error">Failed</Badge>
 */
export function Badge({ children, variant = 'primary', className }: BadgeProps): VNode {
    return (
        <span className={cx('badge', variantClasses[variant], className)}>
            {children}
        </span>
    );
}
