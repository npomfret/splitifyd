interface ErrorStateProps {
    error: string | Error | unknown;
    title?: string;
    onRetry?: () => void;
    fullPage?: boolean;
    className?: string;
}

export function ErrorState({ error, title = 'Something went wrong', onRetry, fullPage = false, className = '' }: ErrorStateProps) {
    // Extract error message from various error types
    const getErrorMessage = (err: unknown): string => {
        if (typeof err === 'string') return err;
        if (err instanceof Error) return err.message;
        if (err && typeof err === 'object' && 'message' in err) {
            return String(err.message);
        }
        return 'An unexpected error occurred';
    };

    const errorMessage = getErrorMessage(error);

    const content = (
        <div className={`text-center ${className}`}>
            {/* Error Icon */}
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
                <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                </svg>
            </div>

            {/* Error Title */}
            <h3 className="mt-4 text-lg font-medium text-gray-900">{title}</h3>

            {/* Error Message */}
            <p className="mt-2 text-sm text-gray-600">{errorMessage}</p>

            {/* Retry Button */}
            {onRetry && (
                <div className="mt-6">
                    <button
                        onClick={onRetry}
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                    >
                        Try Again
                    </button>
                </div>
            )}
        </div>
    );

    if (fullPage) {
        return <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">{content}</div>;
    }

    return content;
}
