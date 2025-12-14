import type { CommentDTO, ReactionEmoji } from '@billsplit-wl/shared';
import { toDisplayName } from '@billsplit-wl/shared';
import { ReactionBar } from '../reactions';
import { Avatar, RelativeTime } from '../ui';

interface CommentItemProps {
    comment: CommentDTO;
    isCurrentUser?: boolean;
    showAvatar?: boolean;
    className?: string;
    onReactionToggle?: (emoji: ReactionEmoji) => void;
    reactionDisabled?: boolean;
}

export function CommentItem({
    comment,
    isCurrentUser = false,
    showAvatar = true,
    className = '',
    onReactionToggle,
    reactionDisabled = false,
}: CommentItemProps) {
    return (
        <article
            className={`flex gap-3 ${isCurrentUser ? 'flex-row-reverse' : ''} ${className}`}
            aria-label={`${comment.authorName}: ${comment.text.substring(0, 50)}${comment.text.length > 50 ? '...' : ''}`}
        >
            {showAvatar && (
                <div className='shrink-0'>
                    <Avatar
                        displayName={toDisplayName(comment.authorName)}
                        userId={comment.authorId}
                        size='sm'
                        photoURL={comment.authorAvatar}
                    />
                </div>
            )}
            <div className={`flex-1 min-w-0 max-w-[80%] ${isCurrentUser ? 'text-end' : ''}`}>
                <span className='font-medium text-xs text-text-secondary'>{comment.authorName}</span>
                <div
                    className={`
                        mt-1 px-3 py-2 rounded-2xl inline-block text-start
                        ${
                        isCurrentUser
                            ? 'bg-interactive-primary text-interactive-primary-foreground rounded-tr-sm'
                            : 'bg-surface-raised text-text-primary rounded-tl-sm'
                    }
                    `}
                >
                    <p className='text-sm whitespace-pre-wrap wrap-break-word'>{comment.text}</p>
                </div>
                {onReactionToggle && (
                    <div className={`mt-1 ${isCurrentUser ? 'flex justify-end' : ''}`}>
                        <ReactionBar
                            counts={comment.reactionCounts}
                            userReactions={comment.userReactions}
                            onToggle={onReactionToggle}
                            disabled={reactionDisabled}
                            size="sm"
                        />
                    </div>
                )}
                <div className={`mt-1 ${isCurrentUser ? 'text-end' : 'text-start'}`}>
                    <RelativeTime
                        date={comment.createdAt}
                        className='text-xs text-text-secondary'
                    />
                </div>
            </div>
        </article>
    );
}
