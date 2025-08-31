// Re-export shared types for backward compatibility
// Polling configuration interface
export interface PollOptions {
    timeout?: number; // Total timeout in ms (default: 10000)
    interval?: number; // Polling interval in ms (default: 500)
    errorMsg?: string; // Custom error message
    onRetry?: (attempt: number, error?: Error) => void; // Callback for debugging
}

// Generic matcher type
export type Matcher<T> = (value: T) => boolean | Promise<boolean>;

export async function pollUntil<T>(fetcher: () => Promise<T>, matcher: Matcher<T>, options: PollOptions = {}): Promise<T> {
    const {timeout = 10000, interval = 500, errorMsg = 'Condition not met', onRetry} = options;

    const startTime = Date.now();
    let lastError: Error | null = null;
    let attempts = 0;

    while (Date.now() - startTime < timeout) {
        try {
            attempts++;
            const result = await fetcher();
            if (await matcher(result)) {
                return result;
            }
        } catch (error) {
            lastError = error as Error;
        }

        if (onRetry) {
            onRetry(attempts, lastError || undefined);
        }

        await new Promise((resolve) => setTimeout(resolve, interval));
    }

    throw new Error(`${errorMsg} after ${timeout}ms (${attempts} attempts). ` + `Last error: ${lastError?.message || 'None'}`);
}

