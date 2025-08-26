import { useEffect } from 'preact/hooks';
import { useComputed } from '@preact/signals';
import { CommentsList } from './CommentsList';
import { CommentInput } from './CommentInput';
import { commentsStore } from '../../stores/comments-store';
import type { CommentTargetType } from '@splitifyd/shared';

interface CommentsSectionProps {
    targetType: CommentTargetType;
    targetId: string;
    maxHeight?: string;
    className?: string;
}

export function CommentsSection({ 
    targetType, 
    targetId, 
    maxHeight = '400px', 
    className = '' 
}: CommentsSectionProps) {
    // Use signals for reactive state
    const comments = useComputed(() => commentsStore.commentsSignal.value);
    const loading = useComputed(() => commentsStore.loadingSignal.value);
    const submitting = useComputed(() => commentsStore.submittingSignal.value);
    const error = useComputed(() => commentsStore.errorSignal.value);
    const hasMore = useComputed(() => commentsStore.hasMoreSignal.value);

    // Subscribe to comments when component mounts or target changes
    useEffect(() => {
        commentsStore.subscribeToComments(targetType, targetId);
        
        // Cleanup on unmount
        return () => {
            commentsStore.dispose();
        };
    }, [targetType, targetId]);

    const handleSubmit = async (text: string) => {
        await commentsStore.addComment(text);
    };

    const handleLoadMore = async () => {
        await commentsStore.loadMoreComments();
    };

    return (
        <div className={`flex flex-col gap-4 ${className}`}>
            {/* Error message */}
            {error.value && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                    <p className="text-sm text-red-700 dark:text-red-400">{error.value}</p>
                </div>
            )}

            {/* Comments list */}
            <CommentsList
                comments={comments.value}
                loading={loading.value}
                hasMore={hasMore.value}
                onLoadMore={handleLoadMore}
                maxHeight={maxHeight}
            />

            {/* Comment input */}
            <div className="border-t pt-4 dark:border-gray-700">
                <CommentInput
                    onSubmit={handleSubmit}
                    disabled={submitting.value}
                    placeholder={targetType === 'group' ? 'Add a comment to this group...' : 'Add a comment to this expense...'}
                />
            </div>
        </div>
    );
}