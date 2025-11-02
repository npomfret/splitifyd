/**
 * Timing utilities to help enforce response duration requirements.
 */

/**
 * Sleep for the requested number of milliseconds.
 * @param durationMs Number of milliseconds to wait.
 */
const sleep = async (durationMs: number): Promise<void> => {
    if (durationMs <= 0) {
        return;
    }

    await new Promise((resolve) => setTimeout(resolve, durationMs));
};

/**
 * Ensures the supplied asynchronous operation takes at least the specified duration.
 * The original function is invoked immediately and the returned value or error is
 * propagated after any required padding delay.
 *
 * @param minimumDurationMs Minimum duration in milliseconds before the promise resolves/rejects.
 * @param operation Asynchronous operation to execute.
 */
export const withMinimumDuration = async <T>(
    minimumDurationMs: number,
    operation: () => Promise<T>,
): Promise<T> => {
    const start = Date.now();

    try {
        const result = await operation();
        const elapsed = Date.now() - start;
        if (elapsed < minimumDurationMs) {
            await sleep(minimumDurationMs - elapsed);
        }
        return result;
    } catch (error) {
        const elapsed = Date.now() - start;
        if (elapsed < minimumDurationMs) {
            await sleep(minimumDurationMs - elapsed);
        }
        throw error;
    }
};
