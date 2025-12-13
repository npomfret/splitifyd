import { getAuthStore } from '@/app/stores/auth-store';
import type { CommentDTO } from '@billsplit-wl/shared';
import { ChatBubbleLeftRightIcon } from '@heroicons/react/24/outline';
import { useEffect, useState } from 'preact/hooks';
import { useTranslation } from 'react-i18next';
import { Alert, EmptyState, LoadingSpinner, SkeletonCommentItem, Stack } from '../ui';
import { CommentItem } from './CommentItem';

interface CommentsListProps {
    comments: CommentDTO[];
    loading?: boolean;
    error?: string | null;
    hasMore?: boolean;
    onLoadMore?: () => Promise<void>;
    maxHeight?: string;
    className?: string;
}

export function CommentsList({ comments, loading = false, error, hasMore = false, onLoadMore, maxHeight = '400px', className = '' }: CommentsListProps) {
    const { t } = useTranslation();
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);

    useEffect(() => {
        getAuthStore().then((store) => {
            setCurrentUserId(store.user?.uid ?? null);
        });
    }, []);

    if (error) {
        return <Alert type='error' message={error} dataTestId='comments-error' />;
    }

    if (loading && comments.length === 0) {
        return (
            <Stack spacing='lg' className='px-1' aria-busy='true' aria-label={t('comments.commentsList.loading')}>
                <SkeletonCommentItem />
                <SkeletonCommentItem />
                <SkeletonCommentItem />
            </Stack>
        );
    }

    if (!loading && comments.length === 0) {
        return (
            <EmptyState
                icon={<ChatBubbleLeftRightIcon className='w-12 h-12' aria-hidden='true' />}
                title={t('comments.commentsList.empty')}
                description={t('comments.commentsList.emptySubtext')}
                dataTestId='comments-empty-state'
                className='py-8'
            />
        );
    }

    return (
        <div
            className={`overflow-y-auto overflow-x-hidden pr-1 scrollbar-thin scrollbar-thumb-border-default scrollbar-track-transparent hover:scrollbar-thumb-border-strong ${className}`}
            style={{ maxHeight }}
        >
            <Stack spacing='md' className='px-1'>
                {comments
                    .map((comment) => (
                        <CommentItem
                            key={comment.id}
                            comment={comment}
                            isCurrentUser={currentUserId === comment.authorId}
                        />
                    ))}
            </Stack>

            {hasMore && (
                <div className='mt-4 flex justify-center'>
                    <button
                        onClick={onLoadMore}
                        disabled={loading}
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
