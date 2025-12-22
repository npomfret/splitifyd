import type { Signal } from '@preact/signals';
import { signal } from '@preact/signals';
import { useState } from 'preact/hooks';

/**
 * Creates a component-local Signal that is properly isolated between component instances.
 *
 * This hook encapsulates the `useState(() => signal(...))` pattern to:
 * - Prevent stale state issues across component remounts
 * - Ensure each component instance gets its own signal
 * - Provide a cleaner, less error-prone API
 *
 * @param initialValue - Initial value for the signal, or a function that returns it
 * @returns A Signal containing the value
 *
 * @example
 * // Simple value
 * const emailSignal = useLocalSignal('');
 *
 * // With explicit type
 * const errorSignal = useLocalSignal<string | null>(null);
 *
 * // With initializer function
 * const dataSignal = useLocalSignal(() => computeExpensiveDefault());
 *
 * // Usage
 * const email = emailSignal.value;
 * emailSignal.value = 'new@example.com';
 */
export function useLocalSignal<T>(initialValue: T | (() => T)): Signal<T> {
    const [sig] = useState(() =>
        signal(
            typeof initialValue === 'function'
                ? (initialValue as () => T)()
                : initialValue,
        )
    );
    return sig;
}
