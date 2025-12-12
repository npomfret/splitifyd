import { cx } from '@/utils/cx.ts';
import type { ComponentChildren, VNode } from 'preact';

interface HelpTextProps {
    children: ComponentChildren;
    className?: string;
    id?: string;
}

/**
 * Help text component for form descriptions, hints, and secondary information.
 * Uses the `help-text` utility class for consistent styling.
 */
export function HelpText({ children, className, id }: HelpTextProps): VNode {
    return (
        <p className={cx('help-text', className)} id={id}>
            {children}
        </p>
    );
}
