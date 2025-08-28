import { CommentItem } from './CommentItem';
import { ChatBubbleLeftRightIcon } from '@heroicons/react/24/outline';
import type { CommentApiResponse } from '@splitifyd/shared';

interface CommentsListProps {
    comments: CommentApiResponse[];
    loading?: boolean;
    hasMore?: boolean;
    onLoadMore?: () => Promise<void>;
    maxHeight?: string;
    className?: string;
}

export function CommentsList({ comments, loading = false, hasMore = false, onLoadMore, maxHeight = '400px', className = '' }: CommentsListProps) {
    if (loading && comments.length === 0) {
        return (
            <div className="flex items-center justify-center py-8">
                <div className="text-center">
                    <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    <p className="text-sm text-gray-500 dark:text-gray-400">Loading comments...</p>
                </div>
            </div>
        );
    }

    if (!loading && comments.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-8 text-gray-400 dark:text-gray-500">
                <ChatBubbleLeftRightIcon className="w-12 h-12 mb-2 opacity-50" />
                <p className="text-sm">No comments yet</p>
                <p className="text-xs mt-1">Be the first to comment!</p>
            </div>
        );
    }

    return (
        <div className={`overflow-y-auto ${className}`} style={{ maxHeight }}>
            <div className="space-y-4 px-1">
                {comments.map((comment) => (
                    <CommentItem key={comment.id} comment={comment} className="pb-4 border-b border-gray-100 dark:border-gray-800 last:border-0" />
                ))}
            </div>

            {hasMore && (
                <div className="mt-4 flex justify-center">
                    <button
                        onClick={onLoadMore}
                        disabled={loading}
                        className="px-4 py-2 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        {loading ? (
                            <span className="flex items-center gap-2">
                                <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                Loading...
                            </span>
                        ) : (
                            'Load more comments'
                        )}
                    </button>
                </div>
            )}
        </div>
    );
}
