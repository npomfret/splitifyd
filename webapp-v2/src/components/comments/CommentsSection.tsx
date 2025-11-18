import { commentsStore } from '@/stores/comments-store.ts';
import type { CommentsStoreTarget } from '@/stores/comments-store.ts';
import { useComputed } from '@preact/signals';
import { type ListCommentsResponse, toCommentText } from '@splitifyd/shared';
import { useEffect, useRef } from 'preact/hooks';
import { useTranslation } from 'react-i18next';
import { CommentInput } from './CommentInput';
import { CommentsList } from './CommentsList';

interface CommentsSectionProps {
    target: CommentsStoreTarget;
    maxHeight?: string;
    className?: string;
    initialData?: ListCommentsResponse | null;
}

export function CommentsSection({ target, maxHeight = '400px', className = '', initialData }: CommentsSectionProps) {
    const { t } = useTranslation();

    // Use signals for reactive state
    const comments = useComputed(() => commentsStore.commentsSignal.value);
    const loading = useComputed(() => commentsStore.loadingSignal.value);
    const submitting = useComputed(() => commentsStore.submittingSignal.value);
    const error = useComputed(() => commentsStore.errorSignal.value);
    const hasMore = useComputed(() => commentsStore.hasMoreSignal.value);

    const initialDataRef = useRef<ListCommentsResponse | null | undefined>();
    initialDataRef.current = initialData;

    const targetKey = target.type === 'group'
        ? `group:${target.groupId}`
        : `expense:${target.expenseId}`;

    // Subscribe to comments when component mounts or target changes
    useEffect(() => {
        commentsStore.registerComponent(target, initialDataRef.current);

        // Cleanup on unmount
        return () => {
            commentsStore.deregisterComponent(target);
        };
    }, [targetKey]);

    const handleSubmit = async (text: string) => {
        await commentsStore.addComment(toCommentText(text));
    };

    const handleLoadMore = async () => {
        await commentsStore.loadMoreComments();
    };

    return (
        <div className={`flex flex-col gap-4 ${className}`} data-testid='comments-section'>
            {/* Error message */}
            {error.value && (
                <div className='bg-surface-error dark:bg-semantic-error/20 border border-border-error dark:border-semantic-error/60 rounded-lg p-3'>
                    <p className='text-sm text-semantic-error dark:text-semantic-error/80' role='alert' data-testid='comments-error-message'>
                        {error.value}
                    </p>
                </div>
            )}

            {/* Comments list */}
            <CommentsList comments={comments.value} loading={loading.value} hasMore={hasMore.value} onLoadMore={handleLoadMore} maxHeight={maxHeight} />

            {/* Comment input */}
            <div className='border-t pt-4 dark:border-border-strong'>
                <CommentInput
                    onSubmit={handleSubmit}
                    disabled={submitting.value}
                    placeholder={target.type === 'group' ? t('comments.commentsSection.placeholderGroup') : t('comments.commentsSection.placeholderExpense')}
                />
            </div>
        </div>
    );
}
