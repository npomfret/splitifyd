import { cx } from '@/utils/cx.ts';
import type { ComponentChildren, VNode } from 'preact';
import type { JSX } from 'preact';

type BadgeVariant = 'primary' | 'success' | 'warning' | 'error' | 'deleted';

interface BadgeProps extends Omit<JSX.HTMLAttributes<HTMLSpanElement>, 'className'> {
    children: ComponentChildren;
    variant?: BadgeVariant;
    className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
    primary: 'badge-primary',
    success: 'badge-success',
    warning: 'badge-warning',
    error: 'badge-error',
    deleted: 'badge-deleted',
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
 * <Badge variant="deleted">Deleted</Badge>
 */
export function Badge({ children, variant = 'primary', className, ...rest }: BadgeProps): VNode {
    return (
        <span className={cx('badge', variantClasses[variant], className)} {...rest}>
            {children}
        </span>
    );
}
