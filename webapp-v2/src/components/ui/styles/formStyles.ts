/**
 * Form field style primitives.
 *
 * These constants define the canonical styling for form inputs.
 * All form components (Input, Textarea, Select, etc.) should use these
 * to ensure consistency.
 *
 * Usage:
 *   import { formInput } from './styles';
 *   const classes = cx(...formInput.base, error && formInput.error, disabled && formInput.disabled);
 */

import { disabledState, errorState, states } from './states';
import { surfaces } from './surfaces';

/** Form input styling (for input, textarea, select) */
export const formInput = {
    /** Base classes - always apply these */
    base: [
        'block w-full rounded-md border border-border-default px-3 py-2 shadow-sm',
        'text-text-primary placeholder:text-text-muted/70',
        states.focusRing,
        'sm:text-sm sm:leading-6 transition-colors duration-200',
        surfaces.raised,
    ] as const,

    /** Apply when error prop is truthy */
    error: errorState,

    /** Apply when disabled prop is true */
    disabled: disabledState,
} as const;

/** Textarea-specific additions */
export const formTextarea = {
    base: [...formInput.base, 'resize-none'] as const,
    error: formInput.error,
    disabled: formInput.disabled,
} as const;

/** Select-specific additions (right padding for dropdown icon) */
export const formSelect = {
    base: [...formInput.base, 'pr-10 appearance-none cursor-pointer'] as const,
    error: formInput.error,
    disabled: formInput.disabled,
} as const;

/** Standard form label styling */
export const formLabel = {
    base: 'mb-2 block text-sm font-medium text-text-primary',
    required: 'text-semantic-error ml-1',
} as const;

/** Floating input styling (for animated label inputs) */
export const formFloatingInput = {
    /** Base classes - note different padding for floating label */
    base: [
        'block w-full rounded-md border border-border-default px-3 pt-6 pb-2 shadow-sm',
        'text-text-primary placeholder:text-transparent',
        states.focusRing,
        'sm:text-sm transition-all duration-(--motion-duration-fast) ease-(--motion-easing-standard)',
        surfaces.raised,
    ] as const,
    error: errorState,
    disabled: disabledState,
} as const;
