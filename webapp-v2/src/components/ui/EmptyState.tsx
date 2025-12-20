import type { ComponentChildren } from 'preact';
import { Button } from './Button';

interface EmptyStateProps {
    /** Main icon/illustration - can be a URL or SVG element */
    icon?: ComponentChildren;
    /** Large heading text */
    title: string;
    /** Supporting description text */
    description?: string;
    /** Optional action button */
    action?: {
        label: string;
        onClick: () => void;
        variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
        disabled?: boolean;
        disabledTooltip?: string;
    };
    /** Optional secondary action */
    secondaryAction?: {
        label: string;
        onClick: () => void;
    };
    /** Additional content to render below the main empty state */
    children?: ComponentChildren;
    /** Custom CSS classes */
    className?: string;
    /** Test ID for testing */
    dataTestId?: string;
}

/**
 * EmptyState component
 *
 * A reusable empty state component for displaying when there's no data to show.
 * Uses only semantic tokens from the theme system.
 *
 * @example
 * // Basic usage
 * <EmptyState
 *   title="No groups yet"
 *   description="Create your first group to get started"
 *   action={{
 *     label: "Create Group",
 *     onClick: handleCreate
 *   }}
 * />
 *
 * @example
 * // With custom icon
 * <EmptyState
 *   icon={<img src="/illustrations/empty.svg" alt="" />}
 *   title="No expenses"
 *   description="Add an expense to start tracking"
 * />
 *
 * @example
 * // With SVG icon
 * <EmptyState
 *   icon={
 *     <svg className="w-16 h-16" fill="none" stroke="currentColor">
 *       <path d="..." />
 *     </svg>
 *   }
 *   title="Nothing here"
 * />
 */
export function EmptyState({
    icon,
    title,
    description,
    action,
    secondaryAction,
    children,
    className = '',
    dataTestId,
}: EmptyStateProps) {
    return (
        <div
            className={`text-center py-12 ${className}`}
            data-testid={dataTestId || 'empty-state'}
        >
            {/* Icon/Illustration */}
            {icon && (
                <div className='text-text-muted/80 mb-4 flex justify-center'>
                    {icon}
                </div>
            )}

            {/* Title */}
            <h3 className='text-lg font-medium text-text-primary mb-2'>
                {title}
            </h3>

            {/* Description */}
            {description && (
                <p className='text-text-muted mb-6 max-w-md mx-auto'>
                    {description}
                </p>
            )}

            {/* Primary Action */}
            {action && (
                <div className='flex items-center justify-center gap-3'>
                    <div title={action.disabled ? action.disabledTooltip : undefined}>
                        <Button
                            onClick={action.onClick}
                            variant={action.variant || 'primary'}
                            size='lg'
                            disabled={action.disabled}
                        >
                            {action.label}
                        </Button>
                    </div>

                    {/* Secondary Action */}
                    {secondaryAction && (
                        <Button
                            onClick={secondaryAction.onClick}
                            variant='ghost'
                            size='lg'
                        >
                            {secondaryAction.label}
                        </Button>
                    )}
                </div>
            )}

            {/* Additional content slot */}
            {children && (
                <div className='mt-8'>
                    {children}
                </div>
            )}
        </div>
    );
}
