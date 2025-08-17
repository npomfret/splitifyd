interface ErrorMessageProps {
    error: string | null;
    className?: string;
}

export function ErrorMessage({ error, className = '' }: ErrorMessageProps) {
    if (!error) return null;

    return (
        <div class={`text-red-600 text-sm bg-red-50 border border-red-200 rounded-md p-3 ${className}`} data-testid="error-message">
            <div class="flex">
                <div class="flex-shrink-0">
                    <svg class="w-4 h-4 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                        <path
                            fill-rule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                            clip-rule="evenodd"
                        />
                    </svg>
                </div>
                <div class="ml-2">
                    <p>{error}</p>
                </div>
            </div>
        </div>
    );
}
