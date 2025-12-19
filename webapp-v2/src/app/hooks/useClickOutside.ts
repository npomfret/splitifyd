import type { RefObject } from 'preact';
import { useEffect } from 'preact/hooks';

interface UseClickOutsideOptions {
    /** Whether the click-outside detection is enabled. Default: true */
    enabled?: boolean;
    /** Optional ref to exclude from click-outside detection (e.g., a toggle button) */
    excludeRef?: RefObject<HTMLElement>;
}

/**
 * Hook that triggers a callback when a click occurs outside the referenced element.
 *
 * Features:
 * - Uses capture phase for reliable event interception
 * - Includes setTimeout delay to prevent same-click closure (dropdown toggle issue)
 * - Supports optional excludeRef for toggle buttons
 * - Automatically cleans up event listeners
 *
 * @param ref - Ref to the element to detect clicks outside of
 * @param callback - Function to call when a click occurs outside
 * @param options - Configuration options
 *
 * @example
 * // Basic dropdown usage
 * const menuRef = useRef<HTMLDivElement>(null);
 * const [isOpen, setIsOpen] = useState(false);
 *
 * useClickOutside(menuRef, () => setIsOpen(false), { enabled: isOpen });
 *
 * @example
 * // With toggle button excluded (for reaction picker-style components)
 * const pickerRef = useRef<HTMLDivElement>(null);
 * const triggerRef = useRef<HTMLButtonElement>(null);
 *
 * useClickOutside(pickerRef, onClose, {
 *     enabled: isOpen,
 *     excludeRef: triggerRef,
 * });
 */
export function useClickOutside(
    ref: RefObject<HTMLElement>,
    callback: () => void,
    options: UseClickOutsideOptions = {},
): void {
    const { enabled = true, excludeRef } = options;

    useEffect(() => {
        if (!enabled) return;

        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;

            // Check if click was inside the main ref
            if (ref.current && ref.current.contains(target)) {
                return;
            }

            // Check if click was inside the excluded ref (e.g., toggle button)
            if (excludeRef?.current && excludeRef.current.contains(target)) {
                return;
            }

            callback();
        };

        // Use setTimeout to prevent the same click that opened the dropdown
        // from immediately triggering the close handler
        const timeoutId = setTimeout(() => {
            document.addEventListener('click', handleClickOutside, true);
        }, 0);

        return () => {
            clearTimeout(timeoutId);
            document.removeEventListener('click', handleClickOutside, true);
        };
    }, [ref, callback, enabled, excludeRef]);
}
