import { commentsStore } from '@/stores/comments-store.ts';
import type { CommentsStoreTarget } from '@/stores/comments-store.ts';
import type { CommentId, ListCommentsResponse, ReactionEmoji } from '@billsplit-wl/shared';
import { toCommentText } from '@billsplit-wl/shared';
import { useComputed } from '@preact/signals';
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

    const handleReactionToggle = async (commentId: CommentId, emoji: ReactionEmoji) => {
        await commentsStore.toggleReaction(commentId, emoji);
    };

    return (
        <div className={`flex flex-col gap-4 ${className}`}>
            {/* Error message */}
            {error.value && (
                <div className='bg-surface-warning border border-border-error rounded-lg p-3'>
                    <p className='text-sm text-semantic-error' role='alert'>
                        {error.value}
                    </p>
                </div>
            )}

            {/* Comments list */}
            <CommentsList comments={comments.value} loading={loading.value} hasMore={hasMore.value} onLoadMore={handleLoadMore} maxHeight={maxHeight} onReactionToggle={handleReactionToggle} />

            {/* Comment input */}
            <div className='border-t border-border-default pt-4'>
                <CommentInput
                    onSubmit={handleSubmit}
                    disabled={submitting.value}
                    placeholder={target.type === 'group' ? t('comments.commentsSection.placeholderGroup') : t('comments.commentsSection.placeholderExpense')}
                />
            </div>
        </div>
    );
}
