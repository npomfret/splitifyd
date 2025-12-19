import type { ComponentChildren } from 'preact';
import { ErrorState } from './ErrorState';

interface ListState<T> {
    /** Whether data is currently loading */
    loading: boolean;
    /** Error message if loading failed */
    error?: string | null;
    /** The list items */
    items: T[];
    /** Whether initial load has completed (prevents showing empty state during first load) */
    initialized?: boolean;
}

interface ListStateRendererProps<T> {
    /** The current state of the list */
    state: ListState<T>;
    /** Render function for loading skeleton (called during initial load) */
    renderLoading: () => ComponentChildren;
    /** Render function for empty state (called when initialized with no items) */
    renderEmpty: () => ComponentChildren;
    /** Render function for the list items */
    children: (items: T[]) => ComponentChildren;
    /** Optional render function for error state. Defaults to ErrorState component. */
    renderError?: (error: string) => ComponentChildren;
    /** Optional callback for retry on error */
    onRetry?: () => void;
}

/**
 * Component that handles the four states of a data list:
 * 1. Loading (initial) - shows skeleton
 * 2. Error - shows error state with optional retry
 * 3. Empty - shows empty state
 * 4. Data - renders children with items
 *
 * Eliminates inconsistent patterns like:
 * ```
 * {isLoading ? <Skeleton /> : items.length === 0 ? <Empty /> : <List />}
 * ```
 *
 * @example
 * <ListStateRenderer
 *     state={{
 *         loading: store.loading,
 *         error: store.error,
 *         items: store.expenses,
 *         initialized: store.initialized,
 *     }}
 *     renderLoading={() => <SkeletonExpenseItem />}
 *     renderEmpty={() => <EmptyState title="No expenses yet" />}
 *     onRetry={() => store.reload()}
 * >
 *     {(items) => (
 *         <Stack>
 *             {items.map(item => <ExpenseItem key={item.id} expense={item} />)}
 *         </Stack>
 *     )}
 * </ListStateRenderer>
 */
export function ListStateRenderer<T>({
    state,
    renderLoading,
    renderEmpty,
    children,
    renderError,
    onRetry,
}: ListStateRendererProps<T>) {
    const { loading, error, items, initialized = true } = state;

    // Error state takes precedence
    if (error) {
        if (renderError) {
            return <>{renderError(error)}</>;
        }
        return <ErrorState error={error} onRetry={onRetry} />;
    }

    // Loading state: show when loading with no items, OR when not yet initialized
    if ((loading && items.length === 0) || (!initialized && loading)) {
        return <>{renderLoading()}</>;
    }

    // Empty state: initialized, not loading, no items
    if (items.length === 0 && initialized && !loading) {
        return <>{renderEmpty()}</>;
    }

    // Data state - render children with items
    return <>{children(items)}</>;
}
