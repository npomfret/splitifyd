/**
 * Surface style primitives.
 *
 * Use these constants instead of raw Tailwind classes to ensure consistency.
 * Surfaces define the background treatment for different UI contexts.
 */

export const surfaces = {
    /** Default page/section background */
    base: 'bg-surface-base',

    /** Subtle background for sections, grouped content */
    muted: 'bg-surface-muted',

    /** Elevated elements: cards, inputs, dropdowns */
    raised: 'bg-surface-raised backdrop-blur-xs',

    /** Glass effect for overlays, modals */
    glass: 'bg-surface-glass backdrop-blur-md',

    /** Subtle background for list items, hover states */
    subtle: 'bg-surface-subtle',
} as const;

type SurfaceVariant = keyof typeof surfaces;
