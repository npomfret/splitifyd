import { useEffect, useState } from 'preact/hooks';

/**
 * Hook that cycles through an array of text values at a specified interval.
 * Useful for rotating placeholder text, tips, or hints.
 *
 * @param texts - Array of text values to cycle through
 * @param intervalMs - Time in milliseconds between rotations (default: 4000ms)
 * @returns The current text value
 */
export function useRotatingText(texts: string[], intervalMs = 4000): string {
    const [index, setIndex] = useState(0);

    useEffect(() => {
        if (texts.length <= 1) return;

        const timer = setInterval(() => {
            setIndex((prev) => (prev + 1) % texts.length);
        }, intervalMs);

        return () => clearInterval(timer);
    }, [texts.length, intervalMs]);

    return texts[index] ?? texts[0] ?? '';
}
