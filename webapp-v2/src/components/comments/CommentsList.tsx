import { ChatBubbleLeftRightIcon } from '@heroicons/react/24/outline';
import type { CommentDTO } from '@splitifyd/shared';
import { useTranslation } from 'react-i18next';
import { LoadingSpinner } from '../ui';
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
                <div className='flex items-center justify-center py-8'>
                    <div className='text-center'>
                        <LoadingSpinner size='md' />
                        <p className='text-sm text-text-muted dark:text-text-muted/80 mt-2'>{t('comments.commentsList.loading')}</p>
                    </div>
                </div>
        );
    }

    if (!loading && comments.length === 0) {
        return (
            <div className='flex flex-col items-center justify-center py-8 text-text-muted/80 dark:text-text-muted'>
                <ChatBubbleLeftRightIcon className='w-12 h-12 mb-2 opacity-50' aria-hidden='true' focusable='false' />
                <p className='text-sm'>{t('comments.commentsList.empty')}</p>
                <p className='text-xs mt-1'>{t('comments.commentsList.emptySubtext')}</p>
            </div>
        );
    }

    return (
        <div className={`overflow-y-auto overflow-x-hidden pr-1 scrollbar-thin scrollbar-thumb-border-default scrollbar-track-transparent hover:scrollbar-thumb-border-strong ${className}`} style={{ maxHeight }}>
            <div className='space-y-4 px-1'>
                {comments
                    .map((comment) => (
                        <CommentItem key={comment.id} comment={comment} className='pb-4 border-b border-border-default dark:border-border-strong last:border-0' />
                    ))}
            </div>

            {hasMore && (
                <div className='mt-4 flex justify-center'>
                    <button
                        onClick={onLoadMore}
                        disabled={loading}
                        data-testid='load-more-comments-button'
                        className='px-4 py-2 text-sm text-interactive-primary hover:text-interactive-primary dark:text-interactive-primary dark:hover:text-interactive-primary font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
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
