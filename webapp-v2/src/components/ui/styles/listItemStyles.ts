/**
 * Style primitives for list item cards.
 *
 * Provides consistent styling for interactive list items with
 * hover effects, deleted states, and action reveal on hover.
 *
 * Usage with cx():
 * ```tsx
 * <article className={cx(listItem.base, isDeleted && listItem.deleted)}>
 *     ...
 * </article>
 * ```
 *
 * For action buttons that reveal on hover, use iconButton.ghostReveal
 * from iconButtonStyles.ts together with the `group` class on the container.
 */

/** Base list item container - includes hover effects and group for action reveal */
const listItemBase = 'border border-border-default/50 rounded-lg px-4 py-3 bg-surface-subtle '
    + 'backdrop-blur-xs transition-all duration-200 relative group '
    + 'hover:border-interactive-primary/40 hover:-translate-y-0.5 hover:shadow-md';

/** Clickable list item - adds cursor and hover background */
const listItemClickable = 'cursor-pointer hover:bg-surface-muted';

/** Deleted state - reduced opacity and muted background */
const listItemDeleted = 'opacity-60 bg-surface-muted';

/** Strikethrough text for deleted items */
const listItemDeletedText = 'line-through text-text-muted';

/**
 * Combined list item styles for common use cases.
 *
 * @example
 * // Standard clickable item
 * <article className={cx(listItem.clickable, isDeleted && listItem.deleted)}>
 *
 * // Non-clickable item
 * <article className={cx(listItem.base, isDeleted && listItem.deleted)}>
 *
 * // Deleted badge - use Badge component with variant='deleted'
 * {isDeleted && <Badge variant='deleted'>{t('expenseItem.deleted')}</Badge>}
 */
export const listItem = {
    /** Base container with hover effects */
    base: listItemBase,
    /** Clickable container (includes base + cursor + hover bg) */
    clickable: `${listItemBase} ${listItemClickable}`,
    /** Deleted state modifier */
    deleted: listItemDeleted,
    /** Strikethrough text */
    deletedText: listItemDeletedText,
} as const;
