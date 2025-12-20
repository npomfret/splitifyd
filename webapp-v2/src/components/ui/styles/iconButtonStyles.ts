/**
 * Icon button style primitives.
 *
 * Use with Clickable component for analytics tracking.
 * These provide consistent styling for icon-only interactive elements.
 *
 * Usage:
 *   import { iconButton } from './styles';
 *   <Clickable className={iconButton.ghost} aria-label="..." eventName="...">
 *       <Icon size={16} />
 *   </Clickable>
 */

/** Base icon button styles - always apply these */
export const iconButtonBase = 'p-1.5 transition-colors';

/** Ghost icon button - subtle background on hover */
export const iconButton = {
    /** Default ghost style - muted text, primary on hover */
    ghost: `${iconButtonBase} text-text-muted hover:text-interactive-primary hover:bg-interactive-primary/10 rounded`,

    /** Ghost with rounded-full for circular buttons */
    ghostRounded: `${iconButtonBase} text-text-muted/80 hover:text-interactive-primary hover:bg-interactive-primary/10 rounded-full`,

    /** Ghost that reveals on hover (for list items with group-hover) */
    ghostReveal: `${iconButtonBase} opacity-0 group-hover:opacity-100 transition-all duration-200 text-text-muted hover:text-interactive-primary hover:bg-interactive-primary/10 rounded`,

    /** Primary colored icon (always visible) */
    primary: `${iconButtonBase} text-interactive-primary hover:bg-interactive-primary/10 rounded`,
} as const;
