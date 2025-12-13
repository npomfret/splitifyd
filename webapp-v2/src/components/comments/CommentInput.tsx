import { PaperAirplaneIcon } from '@heroicons/react/24/outline';
import { useEffect, useRef, useState } from 'preact/hooks';
import { useTranslation } from 'react-i18next';
import { Button, Tooltip } from '../ui';

interface CommentInputProps {
    onSubmit: (text: string) => Promise<void>;
    disabled?: boolean;
    placeholder?: string;
    className?: string;
}

export function CommentInput({ onSubmit, disabled = false, placeholder, className = '' }: CommentInputProps) {
    const { t } = useTranslation();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [text, setText] = useState('');

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
            setError(t('comments.commentInput.tooLong'));
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

            // Clear editing state after successful submission
            // Note: This will respect the parent's disabled prop if still true
            setIsEditing(false);
        } catch (err) {
            setError(err instanceof Error ? err.message : t('comments.commentInput.addFailed'));
            // Keep editing state on error so user can retry
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
            <div className='relative'>
                <textarea
                    ref={textareaRef}
                    value={text}
                    onFocus={() => {
                        setIsEditing(true);
                    }}
                    onBlur={() => {
                        // Only clear editing state if the textarea is empty
                        // This prevents clearing during submit which causes a blur event
                        if (!text.trim()) {
                            setIsEditing(false);
                        }
                    }}
                    onInput={(e) => {
                        const newValue = (e.target as HTMLTextAreaElement).value;
                        setIsEditing(true); // Mark as editing when user types
                        setText(newValue);
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholder || t('comments.commentInput.placeholder')}
                    disabled={(disabled && !isEditing) || isSubmitting}
                    className={`
                        w-full px-4 py-3 pr-12
                        border rounded-full
                        resize-none overflow-hidden
                        text-sm text-text-primary
                        bg-surface-raised
                        placeholder-text-muted/70
                        focus:outline-hidden focus:ring-2 focus:ring-interactive-primary focus:border-transparent
                        disabled:opacity-50 disabled:cursor-not-allowed
                        ${isOverLimit ? 'border-semantic-error focus:ring-semantic-error' : 'border-border-default'}
                    `}
                    rows={1}
                    style={{ minHeight: '38px', maxHeight: '120px' }}
                    aria-label={t('comments.input.ariaLabel')}
                    aria-invalid={isOverLimit}
                />
                <Tooltip content={t('comments.input.sendAriaLabel')} className='absolute end-2 bottom-2'>
                    <Button
                        type='submit'
                        disabled={!text.trim() || isOverLimit || (disabled && !isEditing) || isSubmitting}
                        loading={isSubmitting}
                        variant='ghost'
                        size='sm'
                        ariaLabel={t('comments.input.sendAriaLabel')}
                    >
                        <PaperAirplaneIcon className='w-4 h-4' aria-hidden='true' />
                    </Button>
                </Tooltip>
            </div>

            <div className='flex items-center justify-between text-xs'>
                <div className='text-text-muted'>
                    {error
                        ? (
                            <span className='text-semantic-error' role='alert'>
                                {error}
                            </span>
                        )
                        : <span className='help-text-xs'>{t('comments.commentInput.helpText')}</span>}
                </div>
                {text.length > 0 && (
                    <span
                        className={`
                        ${isOverLimit ? 'text-semantic-error font-medium' : 'text-text-muted'}
                    `}
                    >
                        {remainingChars}
                    </span>
                )}
            </div>
        </form>
    );
}
