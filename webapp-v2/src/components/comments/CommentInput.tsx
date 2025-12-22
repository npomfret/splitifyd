import { useAsyncAction } from '@/app/hooks';
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
    const [text, setText] = useState('');
    const [validationError, setValidationError] = useState<string | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const remainingChars = 500 - text.length;
    const isOverLimit = remainingChars < 0;

    const submitAction = useAsyncAction(
        async (trimmedText: string) => {
            await onSubmit(trimmedText);
        },
        {
            onSuccess: () => {
                setText('');
                if (textareaRef.current) {
                    textareaRef.current.style.height = 'auto';
                }
            },
            onError: (err) => {
                if (err instanceof Error) return err.message;
                return t('comments.commentInput.addFailed');
            },
        },
    );

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
            setValidationError(t('comments.commentInput.tooLong'));
            return;
        }

        setValidationError(null);
        await submitAction.execute(trimmedText);
    };

    const displayError = validationError || submitAction.error;

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
                    onInput={(e) => {
                        setText((e.target as HTMLTextAreaElement).value);
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholder || t('comments.commentInput.placeholder')}
                    disabled={disabled || submitAction.isLoading}
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
                        disabled={!text.trim() || isOverLimit || disabled || submitAction.isLoading}
                        loading={submitAction.isLoading}
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
                    {displayError
                        ? (
                            <span className='text-semantic-error' role='alert'>
                                {displayError}
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
