import { useState, useRef, useEffect } from 'preact/hooks';
import { PaperAirplaneIcon } from '@heroicons/react/24/outline';

interface CommentInputProps {
    onSubmit: (text: string) => Promise<void>;
    disabled?: boolean;
    placeholder?: string;
    className?: string;
}

export function CommentInput({ 
    onSubmit, 
    disabled = false, 
    placeholder = 'Add a comment...', 
    className = '' 
}: CommentInputProps) {
    const [text, setText] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    
    const remainingChars = 500 - text.length;
    const isOverLimit = remainingChars < 0;

    // Auto-resize textarea based on content
    useEffect(() => {
        const textarea = textareaRef.current;
        if (textarea) {
            textarea.style.height = 'auto';
            textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
        }
    }, [text]);

    const handleSubmit = async (e?: Event) => {
        e?.preventDefault();
        
        const trimmedText = text.trim();
        
        if (!trimmedText) {
            return;
        }

        if (isOverLimit) {
            setError('Comment is too long');
            return;
        }

        setIsSubmitting(true);
        setError(null);

        try {
            await onSubmit(trimmedText);
            setText('');
            setError(null);
            
            // Reset textarea height
            if (textareaRef.current) {
                textareaRef.current.style.height = 'auto';
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to add comment');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
        // Submit on Enter, but allow Shift+Enter for new lines
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    };

    return (
        <form onSubmit={handleSubmit} className={`flex flex-col gap-2 ${className}`}>
            <div className="relative">
                <textarea
                    ref={textareaRef}
                    value={text}
                    onInput={(e) => setText((e.target as HTMLTextAreaElement).value)}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholder}
                    disabled={disabled || isSubmitting}
                    className={`
                        w-full px-3 py-2 pr-10
                        border rounded-lg
                        resize-none overflow-hidden
                        text-sm
                        placeholder-gray-400
                        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                        disabled:opacity-50 disabled:cursor-not-allowed
                        dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100
                        ${isOverLimit ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 dark:border-gray-600'}
                    `}
                    rows={1}
                    style={{ minHeight: '38px', maxHeight: '120px' }}
                    aria-label="Comment text"
                    aria-invalid={isOverLimit}
                />
                <button
                    type="submit"
                    disabled={!text.trim() || isOverLimit || disabled || isSubmitting}
                    className={`
                        absolute right-2 bottom-2
                        p-1.5 rounded-lg
                        transition-colors
                        ${text.trim() && !isOverLimit && !disabled && !isSubmitting
                            ? 'text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20'
                            : 'text-gray-400 cursor-not-allowed'
                        }
                    `}
                    aria-label="Send comment"
                >
                    {isSubmitting ? (
                        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    ) : (
                        <PaperAirplaneIcon className="w-4 h-4" />
                    )}
                </button>
            </div>
            
            <div className="flex items-center justify-between text-xs">
                <div className="text-gray-500 dark:text-gray-400">
                    {error ? (
                        <span className="text-red-500 dark:text-red-400">{error}</span>
                    ) : (
                        <span className="text-xs text-gray-400 dark:text-gray-500">
                            Press Enter to send, Shift+Enter for new line
                        </span>
                    )}
                </div>
                {text.length > 0 && (
                    <span className={`
                        ${isOverLimit ? 'text-red-500 font-medium' : 'text-gray-500 dark:text-gray-400'}
                    `}>
                        {remainingChars}
                    </span>
                )}
            </div>
        </form>
    );
}