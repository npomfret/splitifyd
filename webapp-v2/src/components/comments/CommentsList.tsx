import { getAuthStore } from '@/app/stores/auth-store';
import type { CommentDTO, CommentId, GroupId, ReactionEmoji, UserId } from '@billsplit-wl/shared';
import { toUserId } from '@billsplit-wl/shared';
import { ChatBubbleLeftRightIcon } from '@heroicons/react/24/outline';
import { useEffect, useState } from 'preact/hooks';
import { useTranslation } from 'react-i18next';
import { Alert, EmptyState, ListStateRenderer, LoadMoreButton, SkeletonCommentItem, SkeletonList, Stack } from '../ui';
import { CommentItem } from './CommentItem';

interface CommentsListProps {
    comments: CommentDTO[];
    loading?: boolean;
    error?: string | null;
    hasMore?: boolean;
    onLoadMore?: () => Promise<void>;
    maxHeight?: string;
    className?: string;
    onReactionToggle?: (commentId: CommentId, emoji: ReactionEmoji) => void;
    reactionDisabled?: boolean;
    attachmentGroupId?: GroupId;
}

export function CommentsList({
    comments,
    loading = false,
    error,
    hasMore = false,
    onLoadMore,
    maxHeight = '400px',
    className = '',
    onReactionToggle,
    reactionDisabled = false,
    attachmentGroupId,
}: CommentsListProps) {
    const { t } = useTranslation();
    const [currentUserId, setCurrentUserId] = useState<UserId | null>(null);

    useEffect(() => {
        getAuthStore().then((store) => {
            const uid = store.user?.uid;
            setCurrentUserId(uid ? toUserId(uid) : null);
        });
    }, []);

    return (
        <ListStateRenderer
            state={{
                loading,
                error,
                items: comments,
            }}
            renderLoading={() => (
                <SkeletonList spacing='lg' className='px-1' ariaLabel={t('comments.commentsList.loading')}>
                    {SkeletonCommentItem}
                </SkeletonList>
            )}
            renderEmpty={() => (
                <EmptyState
                    icon={<ChatBubbleLeftRightIcon className='w-12 h-12' aria-hidden='true' />}
                    title={t('comments.commentsList.empty')}
                    description={t('comments.commentsList.emptySubtext')}
                    className='py-8'
                />
            )}
            renderError={(errorMsg) => <Alert type='error' message={errorMsg} />}
        >
            {(items) => (
                <div
                    className={`overflow-y-auto overflow-x-hidden pr-1 scrollbar-thin scrollbar-thumb-border-default scrollbar-track-transparent hover:scrollbar-thumb-border-strong ${className}`}
                    style={{ maxHeight }}
                >
                    <Stack spacing='md' className='px-1'>
                        {items.map((comment) => (
                            <CommentItem
                                key={comment.id}
                                comment={comment}
                                currentUserId={currentUserId}
                                isCurrentUser={currentUserId === comment.authorId}
                                attachmentGroupId={attachmentGroupId}
                                onReactionToggle={onReactionToggle ? (emoji) => onReactionToggle(comment.id, emoji) : undefined}
                                reactionDisabled={reactionDisabled}
                            />
                        ))}
                    </Stack>

                    {hasMore && (
                        <div className='mt-4 flex justify-center'>
                            <LoadMoreButton
                                onClick={onLoadMore!}
                                loading={loading}
                                idleText={t('comments.commentsList.loadMore')}
                                loadingText={t('comments.commentsList.loadingMore')}
                            />
                        </div>
                    )}
                </div>
            )}
        </ListStateRenderer>
    );
}
