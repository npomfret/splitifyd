import { useCallback, useRef, useState } from 'preact/hooks';

interface UseAsyncActionOptions<TResult> {
    /** Called when the action completes successfully */
    onSuccess?: (result: TResult) => void;
    /** Called when the action fails. Return a string to set custom error message. */
    onError?: (error: unknown) => string | void;
}

interface UseAsyncActionResult<TArgs extends unknown[], TResult> {
    /** Execute the async action. Returns undefined if already loading or on error. */
    execute: (...args: TArgs) => Promise<TResult | undefined>;
    /** Whether the action is currently executing */
    isLoading: boolean;
    /** Error message from the last failed execution */
    error: string | null;
    /** Clear the current error */
    clearError: () => void;
    /** Reset to initial state (clear error, not loading) */
    reset: () => void;
}

/**
 * Hook for handling async actions with loading and error states.
 *
 * Features:
 * - Automatic loading state management
 * - Error handling with customizable messages
 * - Prevents double-execution while loading
 * - Race condition prevention via request ID tracking
 * - Cleanup helpers (clearError, reset)
 *
 * @param action - The async function to wrap
 * @param options - Optional callbacks for success/error handling
 * @returns Object with execute function, loading state, error, and helpers
 *
 * @example
 * // Basic usage
 * const { execute, isLoading, error } = useAsyncAction(
 *     async () => {
 *         await apiClient.createGroup(data);
 *         onClose();
 *     }
 * );
 *
 * @example
 * // With custom error handling
 * const { execute, isLoading, error, clearError } = useAsyncAction(
 *     async () => apiClient.updateUser(userId, data),
 *     {
 *         onSuccess: () => toast.success('Saved!'),
 *         onError: (error) => {
 *             if (error instanceof ApiError && error.code === 'DISPLAY_NAME_TAKEN') {
 *                 return t('errors.displayNameTaken');
 *             }
 *             // Return undefined to use default error message
 *         }
 *     }
 * );
 *
 * @example
 * // With arguments
 * const { execute } = useAsyncAction(
 *     async (groupId: string, name: string) => {
 *         return await apiClient.updateGroup(groupId, { name });
 *     }
 * );
 *
 * // Later: execute('group-123', 'New Name')
 */
export function useAsyncAction<TArgs extends unknown[], TResult>(
    action: (...args: TArgs) => Promise<TResult>,
    options: UseAsyncActionOptions<TResult> = {},
): UseAsyncActionResult<TArgs, TResult> {
    const { onSuccess, onError } = options;

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Track request ID to prevent race conditions
    const requestIdRef = useRef(0);

    const execute = useCallback(
        async (...args: TArgs): Promise<TResult | undefined> => {
            // Prevent double-execution
            if (isLoading) {
                return undefined;
            }

            const currentRequestId = ++requestIdRef.current;

            setIsLoading(true);
            setError(null);

            try {
                const result = await action(...args);

                // Only process if this is still the current request
                if (currentRequestId === requestIdRef.current) {
                    setIsLoading(false);
                    onSuccess?.(result);
                    return result;
                }
            } catch (err) {
                // Only process if this is still the current request
                if (currentRequestId === requestIdRef.current) {
                    setIsLoading(false);

                    // Let onError provide custom message
                    const customMessage = onError?.(err);
                    if (typeof customMessage === 'string') {
                        setError(customMessage);
                    } else {
                        // Default error message extraction
                        const defaultMessage = err instanceof Error ? err.message : 'An error occurred';
                        setError(defaultMessage);
                    }
                }
            }

            return undefined;
        },
        [action, isLoading, onSuccess, onError],
    );

    const clearError = useCallback(() => {
        setError(null);
    }, []);

    const reset = useCallback(() => {
        setError(null);
        setIsLoading(false);
        // Increment request ID to invalidate any in-flight requests
        requestIdRef.current++;
    }, []);

    return {
        execute,
        isLoading,
        error,
        clearError,
        reset,
    };
}
