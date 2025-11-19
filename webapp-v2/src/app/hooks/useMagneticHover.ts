import { useRef, useEffect } from 'preact/hooks';
import type { Ref } from 'preact';
import { useThemeConfig } from './useThemeConfig';

export interface UseMagneticHoverOptions {
    /**
     * Strength of the magnetic effect (how far the element moves toward cursor).
     * Range: 0.0 to 1.0
     * Default: 0.3
     *
     * - 0.1 = subtle attraction
     * - 0.3 = medium attraction (default)
     * - 0.5 = strong attraction
     */
    strength?: number;

    /**
     * Transition duration in milliseconds when element returns to center.
     * Default: 400ms
     */
    transitionDuration?: number;

    /**
     * Easing function for the transition.
     * Default: 'cubic-bezier(0.22, 1, 0.36, 1)'
     */
    easing?: string;

    /**
     * Whether the element is disabled (prevents magnetic effect).
     * Default: false
     */
    disabled?: boolean;
}

/**
 * Hook that makes an element follow the cursor with a magnetic attraction effect.
 *
 * The element smoothly translates toward the cursor when hovering, creating
 * a "magnetic" interaction. On mouse leave, it springs back to center.
 *
 * Automatically disabled when `motion.enableMagneticHover` is false (Brutalist theme).
 *
 * Performance: Uses transform (GPU-accelerated) and requestAnimationFrame for 60fps.
 *
 * @example
 * ```tsx
 * function MagneticButton() {
 *   const ref = useMagneticHover({ strength: 0.3 });
 *
 *   return (
 *     <button ref={ref} className="btn-primary">
 *       Hover me
 *     </button>
 *   );
 * }
 * ```
 */
export function useMagneticHover<T extends HTMLElement = HTMLElement>(
    options?: UseMagneticHoverOptions
): Ref<T> {
    const ref = useRef<T>(null);
    const { motion } = useThemeConfig();

    const {
        strength = 0.3,
        transitionDuration = 400,
        easing = 'cubic-bezier(0.22, 1, 0.36, 1)',
        disabled = false,
    } = options || {};

    useEffect(() => {
        // Early return if motion is disabled, element is disabled, or ref not set
        if (!ref.current || !motion.enableMagneticHover || disabled) {
            return;
        }

        const element = ref.current;
        let rafId: number | null = null;

        // Store initial transform to preserve any existing transforms
        const initialTransform = getComputedStyle(element).transform;

        const handleMouseMove = (e: MouseEvent) => {
            if (rafId) {
                cancelAnimationFrame(rafId);
            }

            rafId = requestAnimationFrame(() => {
                const rect = element.getBoundingClientRect();
                const centerX = rect.left + rect.width / 2;
                const centerY = rect.top + rect.height / 2;

                // Calculate distance from cursor to element center
                const deltaX = (e.clientX - centerX) * strength;
                const deltaY = (e.clientY - centerY) * strength;

                // Apply magnetic translation (remove transition for smooth tracking)
                element.style.transition = 'none';
                element.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
            });
        };

        const handleMouseEnter = () => {
            // Remove transition on enter for immediate response
            element.style.transition = 'none';
        };

        const handleMouseLeave = () => {
            if (rafId) {
                cancelAnimationFrame(rafId);
                rafId = null;
            }

            // Spring back to center with smooth transition
            element.style.transition = `transform ${transitionDuration}ms ${easing}`;
            element.style.transform = initialTransform === 'none' ? 'translate(0, 0)' : initialTransform;
        };

        // Attach event listeners
        element.addEventListener('mouseenter', handleMouseEnter);
        element.addEventListener('mousemove', handleMouseMove);
        element.addEventListener('mouseleave', handleMouseLeave);

        return () => {
            if (rafId) {
                cancelAnimationFrame(rafId);
            }

            element.removeEventListener('mouseenter', handleMouseEnter);
            element.removeEventListener('mousemove', handleMouseMove);
            element.removeEventListener('mouseleave', handleMouseLeave);

            // Restore original transform
            element.style.transform = initialTransform;
            element.style.transition = '';
        };
    }, [motion.enableMagneticHover, strength, transitionDuration, easing, disabled]);

    return ref;
}
