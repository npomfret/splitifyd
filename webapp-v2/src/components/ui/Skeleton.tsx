import { cx } from '@/utils/cx';
import { CSSProperties } from 'preact/compat';

interface SkeletonProps {
    /** Width of the skeleton - can be a number (pixels) or string (e.g., '100%', '5rem') */
    width?: string | number;
    /** Height of the skeleton - can be a number (pixels) or string (e.g., '100%', '1em') */
    height?: string | number;
    /** Additional CSS classes */
    className?: string;
    /** Shape variant */
    variant?: 'text' | 'circular' | 'rectangular';
}

/**
 * Skeleton loading placeholder component.
 *
 * Uses tenant-defined skeleton colors from CSS variables:
 * - --surface-skeleton (base color)
 * - --surface-skeleton-shimmer (shimmer highlight)
 *
 * Falls back to --surface-muted and --surface-raised if not defined.
 * Animation is automatically disabled when user prefers reduced motion.
 *
 * @example
 * // Basic rectangular skeleton
 * <Skeleton width={200} height={20} />
 *
 * // Text placeholder
 * <Skeleton variant="text" width="80%" />
 *
 * // Avatar placeholder
 * <Skeleton variant="circular" width={48} height={48} />
 */
export function Skeleton({
    width,
    height,
    className,
    variant = 'rectangular',
}: SkeletonProps) {
    const style: CSSProperties = {};

    if (width !== undefined) {
        style.width = typeof width === 'number' ? `${width}px` : width;
    }
    if (height !== undefined) {
        style.height = typeof height === 'number' ? `${height}px` : height;
    }

    return (
        <div
            className={cx(
                // Base skeleton class - styled by theme CSS
                'skeleton',
                // Variant modifiers
                variant === 'text' && 'skeleton-text',
                variant === 'circular' && 'skeleton-circular',
                className,
            )}
            style={style}
            aria-hidden='true'
            role='presentation'
        />
    );
}

// =============================================================================
// Preset Skeleton Components
// =============================================================================

/**
 * Skeleton for a card with title and description
 */
export function SkeletonCard({ className }: { className?: string; }) {
    return (
        <div className={cx('space-y-3', className)}>
            <Skeleton height={120} className='w-full' />
            <Skeleton variant='text' width='80%' />
            <Skeleton variant='text' width='60%' />
        </div>
    );
}
