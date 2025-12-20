import { cx } from '@/utils/cx';
import type { ComponentChildren, ComponentType } from 'preact';
import { CSSProperties } from 'preact/compat';
import { useTranslation } from 'react-i18next';
import { Stack } from './Stack';

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
function Skeleton({
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

/**
 * Skeleton for an activity feed item - matches the structure in ActivityFeedDropdownContent
 */
export function SkeletonActivityItem({ className }: { className?: string; }) {
    return (
        <div
            className={cx(
                'flex items-start gap-3 rounded-lg border border-border-default/50 bg-surface-subtle px-4 py-3',
                className,
            )}
        >
            {/* Dot indicator */}
            <Skeleton variant='circular' width={10} height={10} className='mt-1.5 shrink-0' />
            {/* Content area */}
            <div className='flex-1 min-w-0 space-y-2'>
                {/* Description line */}
                <Skeleton variant='text' width='90%' height={16} />
                {/* Second line (shorter) */}
                <Skeleton variant='text' width='70%' height={14} />
                {/* Meta line (group + timestamp) */}
                <div className='flex items-center gap-2 mt-2'>
                    <Skeleton variant='text' width={80} height={12} />
                    <Skeleton variant='text' width={60} height={12} />
                </div>
            </div>
        </div>
    );
}

/**
 * Skeleton for an expense item - matches the structure in ExpenseItem
 */
export function SkeletonExpenseItem({ className }: { className?: string; }) {
    return (
        <div
            className={cx(
                'border border-border-default/50 rounded-lg px-4 py-3 bg-surface-subtle',
                className,
            )}
        >
            <div className='flex justify-between items-start gap-4'>
                <div className='flex items-center gap-3 flex-1 min-w-0'>
                    {/* Avatar */}
                    <Skeleton variant='circular' width={32} height={32} className='shrink-0' />
                    {/* Description and meta */}
                    <div className='flex-1 min-w-0 space-y-1.5'>
                        <Skeleton variant='text' width='70%' height={14} />
                        <Skeleton variant='text' width='50%' height={12} />
                    </div>
                </div>
                {/* Amount */}
                <div className='text-end space-y-1'>
                    <Skeleton variant='text' width={60} height={16} />
                    <Skeleton variant='text' width={40} height={12} />
                </div>
            </div>
        </div>
    );
}

/**
 * Skeleton for a settlement item - matches the structure in SettlementHistory
 */
export function SkeletonSettlementItem({ className }: { className?: string; }) {
    return (
        <div
            className={cx(
                'border-b last:border-0 pb-3 last:pb-0 px-2 py-2 rounded',
                className,
            )}
            style={{ borderLeftWidth: '4px', borderLeftColor: 'var(--border-default)' }}
        >
            <div className='grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 items-start'>
                {/* Row 1: Payer */}
                <Skeleton variant='circular' width={24} height={24} />
                <Skeleton variant='text' width='40%' height={14} />
                {/* Row 2: Arrow + amount */}
                <div className='flex items-center justify-center w-6'>
                    <Skeleton variant='rectangular' width={12} height={12} />
                </div>
                <div className='flex items-center gap-2'>
                    <Skeleton variant='text' width={60} height={16} />
                    <Skeleton variant='text' width={50} height={12} />
                </div>
                {/* Row 3: Payee */}
                <Skeleton variant='circular' width={24} height={24} />
                <Skeleton variant='text' width='35%' height={14} />
            </div>
        </div>
    );
}

/**
 * Skeleton for a comment item - matches the structure in CommentItem
 */
export function SkeletonCommentItem({ className }: { className?: string; }) {
    return (
        <div className={cx('flex flex-col gap-1', className)}>
            {/* Name and avatar */}
            <div className='flex items-center gap-2'>
                <Skeleton variant='text' width={80} height={12} />
                <Skeleton variant='circular' width={20} height={20} />
            </div>
            {/* Comment text */}
            <Skeleton variant='text' width='90%' height={14} />
            <Skeleton variant='text' width='60%' height={14} />
            {/* Timestamp */}
            <Skeleton variant='text' width={50} height={12} />
        </div>
    );
}

/**
 * Skeleton for a member item - matches the structure in MembersListWithManagement
 */
export function SkeletonMemberItem({ className }: { className?: string; }) {
    return (
        <div className={cx('flex items-center justify-between py-1.5 px-1.5 rounded-md', className)}>
            <div className='flex items-center gap-2 min-w-0 flex-1'>
                {/* Avatar */}
                <Skeleton variant='circular' width={24} height={24} className='shrink-0' />
                {/* Name and role */}
                <div className='flex flex-col min-w-0 flex-1 gap-1'>
                    <Skeleton variant='text' width='60%' height={14} />
                    <Skeleton variant='text' width='30%' height={12} />
                </div>
            </div>
        </div>
    );
}

// =============================================================================
// Skeleton List Component
// =============================================================================

interface SkeletonListProps {
    /** Number of skeleton items to render. Defaults to 3. */
    count?: number;
    /** The skeleton item component to render, or a render function */
    children: ComponentType<{ className?: string }> | (() => ComponentChildren);
    /** Stack spacing between items. Defaults to 'sm'. */
    spacing?: 'xs' | 'sm' | 'md' | 'lg';
    /** Additional class names for the container */
    className?: string;
    /** Custom aria-label. Defaults to common.loading translation. */
    ariaLabel?: string;
}

/**
 * Renders a list of skeleton loading placeholders.
 *
 * Uses Stack for consistent spacing and includes proper ARIA attributes
 * for accessibility (aria-busy, aria-label).
 *
 * @example
 * // Using a component
 * <SkeletonList count={3}>{SkeletonExpenseItem}</SkeletonList>
 *
 * @example
 * // Using a render function
 * <SkeletonList count={5}>
 *     {() => <SkeletonMemberItem />}
 * </SkeletonList>
 *
 * @example
 * // With custom spacing
 * <SkeletonList count={3} spacing='md'>
 *     {SkeletonSettlementItem}
 * </SkeletonList>
 */
export function SkeletonList({
    count = 3,
    children,
    spacing = 'sm',
    className,
    ariaLabel,
}: SkeletonListProps) {
    const { t } = useTranslation();
    const label = ariaLabel ?? t('common.loading');

    const items = Array.from({ length: count }, (_, index) => {
        if (typeof children === 'function' && children.length === 0) {
            // Render function: () => <Component />
            return <div key={index}>{(children as () => ComponentChildren)()}</div>;
        } else {
            // Component type: SkeletonExpenseItem
            const Component = children as ComponentType<{ className?: string }>;
            return <Component key={index} />;
        }
    });

    return (
        <Stack spacing={spacing} className={className} aria-busy='true' aria-label={label}>
            {items}
        </Stack>
    );
}
