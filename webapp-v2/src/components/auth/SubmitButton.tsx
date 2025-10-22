interface SubmitButtonProps {
    loading: boolean;
    disabled?: boolean;
    children: string;
    className?: string;
    type?: 'submit' | 'button';
}

export function SubmitButton({ loading, disabled = false, children, className = '', type = 'submit' }: SubmitButtonProps) {
    const isDisabled = loading || disabled;

    return (
        <button
            type={type}
            disabled={isDisabled}
            class={`
        w-full flex justify-center items-center px-4 py-2 
        border border-transparent rounded-md shadow-sm text-sm font-medium 
        text-white bg-blue-600 hover:bg-blue-700 
        focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
        disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-blue-600
        transition-colors duration-200
        ${className}
      `}
        >
            {loading && (
                <svg class='animate-spin -ml-1 mr-3 h-4 w-4 text-white' fill='none' viewBox='0 0 24 24' aria-hidden='true' focusable='false'>
                    <circle class='opacity-25' cx='12' cy='12' r='10' stroke='currentColor' stroke-width='4' />
                    <path class='opacity-75' fill='currentColor' d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z' />
                </svg>
            )}
            {children}
        </button>
    );
}
