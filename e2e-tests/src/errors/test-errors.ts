/**
 * Custom error classes for E2E tests.
 * Provides strongly typed errors with structured context for better debugging.
 */

/**
 * Base error class for all E2E test errors
 */
export class E2ETestError extends Error {
    public readonly timestamp: string;
    public readonly context: Record<string, any>;

    constructor(
        message: string,
        public readonly operation: string,
        context?: Record<string, any>,
    ) {
        // Format context for error message, excluding verbose fields
        const formattedContext = E2ETestError.formatContextForMessage(context);
        super(`${message}: ${JSON.stringify(formattedContext, null, 2)}`);
        this.name = 'E2ETestError';
        this.timestamp = new Date().toISOString();
        this.context = context || {};

        // Maintain proper stack trace for where error was thrown
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, this.constructor);
        }
    }

    /**
     * Format context for error message, handling verbose fields specially
     */
    private static formatContextForMessage(context?: Record<string, any>): Record<string, any> {
        if (!context) return {};

        const formatted = { ...context };

        // Fields that should be truncated or summarized in the error message
        const verboseFields = ['originalError', 'error', 'formError', 'stack'];

        for (const field of verboseFields) {
            if (formatted[field]) {
                const value = String(formatted[field]);
                // Only show first line of verbose error messages
                const firstLine = value.split('\n')[0];
                formatted[field] = firstLine.length > 100 ? firstLine.substring(0, 100) + '...' : firstLine;
            }
        }

        return formatted;
    }
}
/**
 * Error thrown by the automatic error handling proxy.
 * Wraps the original error with rich context automatically collected.
 */
export class ProxiedMethodError extends E2ETestError {
    public readonly originalError: Error;
    public readonly className: string;
    public readonly methodName: string;
    public readonly pageState?: any;

    constructor(message: string, operation: string, context: Record<string, any>, originalError: Error) {
        // Create detailed message with page state summary
        let detailedMessage = `${operation} failed: ${message}`;

        if (context.pageState) {
            const { visibleErrors, dialogOpen, loadingIndicators } = context.pageState;

            if (visibleErrors?.length > 0) {
                detailedMessage += `\nPage errors: ${visibleErrors.join(', ')}`;
            }
            if (dialogOpen) {
                detailedMessage += '\nDialog/Modal is open';
            }
            if (loadingIndicators) {
                detailedMessage += '\nLoading indicators visible';
            }
        }

        super(detailedMessage, operation, context);
        this.name = 'ProxiedMethodError';
        this.originalError = originalError;
        this.className = context.className || 'Unknown';
        this.methodName = context.methodName || 'unknown';
        this.pageState = context.pageState;

        // Preserve the original stack trace but prepend our context
        if (originalError.stack) {
            const contextInfo = `\n    at ${this.className}.${this.methodName} (proxied)\n    URL: ${context.currentUrl}`;
            this.stack = this.stack?.split('\n')[0] + contextInfo + '\nOriginal stack:\n' + originalError.stack;
        }
    }
}
