import type { ComponentChildren } from 'preact';

interface GradientTextProps {
    children: ComponentChildren;
    gradient?: 'primary' | 'accent' | 'aurora' | 'text';
    className?: string;
    as?: 'span' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'p';
}

/**
 * GradientText component
 *
 * Renders text with a gradient background using webkit-background-clip.
 * Uses semantic gradient tokens from the theme system.
 *
 * @example
 * <GradientText gradient="primary">Welcome to BillSplit</GradientText>
 * <GradientText gradient="aurora" as="h1">Hero Headline</GradientText>
 */
export function GradientText({
    children,
    gradient = 'primary',
    className = '',
    as: Component = 'span'
}: GradientTextProps) {
    return (
        <Component
            className={`bg-clip-text text-transparent ${className}`}
            style={{ backgroundImage: `var(--gradient-${gradient})` }}
        >
            {children}
        </Component>
    );
}
