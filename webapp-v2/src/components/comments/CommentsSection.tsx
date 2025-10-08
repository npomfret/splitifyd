import { commentsStore } from '@/stores/comments-store.ts';
import { useComputed } from '@preact/signals';
import type { CommentTargetType } from '@splitifyd/shared';
import { useEffect } from 'preact/hooks';
import { useTranslation } from 'react-i18next';
import { CommentInput } from './CommentInput';
import { CommentsList } from './CommentsList';

interface CommentsSectionProps {
    targetType: CommentTargetType;
    targetId: string;
    maxHeight?: string;
    className?: string;
}

export function CommentsSection({ targetType, targetId, maxHeight = '400px', className = '' }: CommentsSectionProps) {
    const { t } = useTranslation();

    // Use signals for reactive state
    const comments = useComputed(() => commentsStore.commentsSignal.value);
    const loading = useComputed(() => commentsStore.loadingSignal.value);
    const submitting = useComputed(() => commentsStore.submittingSignal.value);
    const error = useComputed(() => commentsStore.errorSignal.value);
    const hasMore = useComputed(() => commentsStore.hasMoreSignal.value);

    // Subscribe to comments when component mounts or target changes
    useEffect(() => {
        commentsStore.registerComponent(targetType, targetId);

        // Cleanup on unmount
        return () => {
            commentsStore.deregisterComponent(targetId);
        };
    }, [targetType, targetId]);

    const handleSubmit = async (text: string) => {
        await commentsStore.addComment(text);
    };

    const handleLoadMore = async () => {
        await commentsStore.loadMoreComments();
    };

    return (
        <div className={`flex flex-col gap-4 ${className}`} data-testid='comments-section'>
            {/* Error message */}
            {error.value && (
                <div className='bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3'>
                    <p className='text-sm text-red-700 dark:text-red-400' role='alert' data-testid='comments-error-message'>
                        {error.value}
                    </p>
                </div>
            )}

            {/* Comments list */}
            <CommentsList comments={comments.value} loading={loading.value} hasMore={hasMore.value} onLoadMore={handleLoadMore} maxHeight={maxHeight} />

            {/* Comment input */}
            <div className='border-t pt-4 dark:border-gray-700'>
                <CommentInput
                    onSubmit={handleSubmit}
                    disabled={submitting.value}
                    placeholder={targetType === 'group' ? t('comments.commentsSection.placeholderGroup') : t('comments.commentsSection.placeholderExpense')}
                />
            </div>
        </div>
    );
}
