import { cx } from '@/utils/cx.ts';
import type { ComponentChildren, VNode } from 'preact';

interface FieldErrorProps {
    children: ComponentChildren;
    className?: string;
    id?: string;
    dataTestId?: string;
}

/**
 * Field error message component for form validation errors.
 * Uses the `field-error` utility class for consistent styling.
 * Includes proper ARIA attributes for accessibility.
 */
export function FieldError({ children, className, id, dataTestId }: FieldErrorProps): VNode | null {
    if (!children) return null;

    return (
        <p
            className={cx('field-error', className)}
            id={id}
            role='alert'
            data-testid={dataTestId}
        >
            {children}
        </p>
    );
}
