import type { CommentDTO } from '@billsplit-wl/shared';
import { ChatBubbleLeftRightIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import { EmptyState, LoadingSpinner, SkeletonCommentItem } from '../ui';
import { CommentItem } from './CommentItem';

interface CommentsListProps {
    comments: CommentDTO[];
    loading?: boolean;
    hasMore?: boolean;
    onLoadMore?: () => Promise<void>;
    maxHeight?: string;
    className?: string;
}

export function CommentsList({ comments, loading = false, hasMore = false, onLoadMore, maxHeight = '400px', className = '' }: CommentsListProps) {
    const { t } = useTranslation();
    if (loading && comments.length === 0) {
        return (
            <div className='space-y-4 px-1' aria-busy='true' aria-label={t('comments.commentsList.loading')}>
                <SkeletonCommentItem />
                <SkeletonCommentItem />
                <SkeletonCommentItem />
            </div>
        );
    }

    if (!loading && comments.length === 0) {
        return (
            <EmptyState
                icon={<ChatBubbleLeftRightIcon className='w-12 h-12' aria-hidden='true' />}
                title={t('comments.commentsList.empty')}
                description={t('comments.commentsList.emptySubtext')}
                data-testid='comments-empty-state'
                className='py-8'
            />
        );
    }

    return (
        <div
            className={`overflow-y-auto overflow-x-hidden pr-1 scrollbar-thin scrollbar-thumb-border-default scrollbar-track-transparent hover:scrollbar-thumb-border-strong ${className}`}
            style={{ maxHeight }}
        >
            <div className='space-y-4 px-1'>
                {comments
                    .map((comment) => <CommentItem key={comment.id} comment={comment} className='pb-4 border-b border-border-default last:border-0' />)}
            </div>

            {hasMore && (
                <div className='mt-4 flex justify-center'>
                    <button
                        onClick={onLoadMore}
                        disabled={loading}
                        data-testid='load-more-comments-button'
                        className='px-4 py-2 text-sm text-interactive-primary hover:text-interactive-primary font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
                    >
                        {loading
                            ? (
                                <span className='flex items-center gap-2'>
                                    <LoadingSpinner size='sm' color='text-current' />
                                    {t('comments.commentsList.loadingMore')}
                                </span>
                            )
                            : (
                                t('comments.commentsList.loadMore')
                            )}
                    </button>
                </div>
            )}
        </div>
    );
}
