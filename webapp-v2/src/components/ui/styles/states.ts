/**
 * Interactive state style primitives.
 *
 * These define how components appear in different states (disabled, error, focus).
 * Import and compose these instead of repeating class strings.
 */

export const states = {
    /** Disabled state for form elements */
    disabled: 'opacity-60 cursor-not-allowed',

    /** Disabled background override */
    disabledBg: 'bg-surface-muted text-text-muted',

    /** Error border styling */
    errorBorder: 'border-border-error',

    /** Error text styling */
    errorText: 'text-semantic-error',

    /** Error focus ring */
    errorFocus: 'focus-visible:ring-semantic-error focus-visible:border-semantic-error',

    /** Standard focus ring for inputs */
    focusRing: 'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-interactive-primary focus-visible:border-interactive-primary',

    /** Focus ring with offset (for checkboxes, switches) */
    focusRingOffset: 'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-interactive-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base',
} as const;

/** Combined error state (border + text + focus) */
export const errorState = `${states.errorBorder} ${states.errorText} ${states.errorFocus}`;

/** Combined disabled state (opacity + cursor + background) */
export const disabledState = `${states.disabled} ${states.disabledBg}`;
