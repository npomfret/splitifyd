import { useRef, useState, useEffect } from 'preact/hooks';
import type { Ref } from 'preact';
import { useThemeConfig } from './useThemeConfig';

export interface UseScrollRevealOptions extends IntersectionObserverInit {
    /**
     * Delay in milliseconds before revealing the element after it enters viewport.
     * Default: 0
     */
    delay?: number;
}

export interface UseScrollRevealReturn {
    /**
     * Ref to attach to the element you want to reveal on scroll.
     */
    ref: Ref<HTMLElement>;

    /**
     * Whether the element is visible (has entered viewport and been revealed).
     */
    isVisible: boolean;
}

/**
 * Hook that reveals an element with a fade-up animation when it scrolls into view.
 *
 * Uses IntersectionObserver to detect when the element enters the viewport.
 * Automatically disabled when `motion.enableScrollReveal` is false (Brutalist theme).
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { ref, isVisible } = useScrollReveal({ threshold: 0.25 });
 *
 *   return (
 *     <div
 *       ref={ref}
 *       className={`fade-up ${isVisible ? 'fade-up-visible' : ''}`}
 *     >
 *       Content that fades in on scroll
 *     </div>
 *   );
 * }
 * ```
 */
export function useScrollReveal(options?: UseScrollRevealOptions): UseScrollRevealReturn {
    const ref = useRef<HTMLElement>(null);
    const [isVisible, setIsVisible] = useState(false);
    const { motion } = useThemeConfig();

    const { delay = 0, ...observerOptions } = options || {};

    useEffect(() => {
        // Early return if motion is disabled or ref not set
        if (!ref.current || !motion.enableScrollReveal) {
            // If motion is disabled, immediately mark as visible (no animation)
            if (!motion.enableScrollReveal) {
                setIsVisible(true);
            }
            return;
        }

        const element = ref.current;
        let timeoutId: NodeJS.Timeout | null = null;

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    // Element has entered viewport
                    if (delay > 0) {
                        timeoutId = setTimeout(() => {
                            setIsVisible(true);
                        }, delay);
                    } else {
                        setIsVisible(true);
                    }

                    // Unobserve after revealing (one-time animation)
                    observer.unobserve(element);
                }
            },
            {
                threshold: 0.25,
                ...observerOptions,
            }
        );

        observer.observe(element);

        return () => {
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
            observer.disconnect();
        };
    }, [motion.enableScrollReveal, delay, observerOptions]);

    return { ref, isVisible };
}

/**
 * Hook variant that reveals multiple child elements with a stagger effect.
 *
 * @param count - Number of child elements to reveal
 * @param staggerMs - Delay in milliseconds between each child reveal
 */
export function useStaggeredReveal(count: number, staggerMs: number = 100) {
    const { ref, isVisible } = useScrollReveal();
    const [visibleIndices, setVisibleIndices] = useState<Set<number>>(new Set());

    useEffect(() => {
        if (!isVisible) return;

        // Reveal each child with a stagger delay
        const timeouts: NodeJS.Timeout[] = [];

        for (let i = 0; i < count; i++) {
            const timeout = setTimeout(() => {
                setVisibleIndices((prev: Set<number>) => new Set([...prev, i]));
            }, i * staggerMs);

            timeouts.push(timeout);
        }

        return () => {
            timeouts.forEach(clearTimeout);
        };
    }, [isVisible, count, staggerMs]);

    return { ref, visibleIndices };
}
