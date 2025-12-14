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
            className={`flex flex-col gap-1 ${className}`}
            aria-label={`${comment.authorName}: ${comment.text.substring(0, 50)}${comment.text.length > 50 ? '...' : ''}`}
        >
            {/* Name and avatar */}
            <div className="flex items-center gap-2">
                <span className="text-xs text-text-secondary">{comment.authorName}</span>
                {showAvatar && (
                    <Avatar
                        displayName={toDisplayName(comment.authorName)}
                        userId={comment.authorId}
                        size='xs'
                        photoURL={comment.authorAvatar}
                    />
                )}
            </div>

            {/* Comment text */}
            <div className={`px-3 py-2 rounded-2xl inline-block ${
                isCurrentUser
                    ? 'bg-interactive-primary text-interactive-primary-foreground rounded-tl-sm'
                    : 'bg-surface-raised text-text-primary rounded-tl-sm'
            }`}>
                <p className="text-sm whitespace-pre-wrap break-words">{comment.text}</p>
            </div>

            {/* Reactions */}
            {onReactionToggle && (
                <ReactionBar
                    counts={comment.reactionCounts}
                    userReactions={comment.userReactions}
                    onToggle={onReactionToggle}
                    disabled={reactionDisabled}
                    size="sm"
                />
            )}

            {/* Timestamp */}
            <RelativeTime
                date={comment.createdAt}
                className="text-xs text-text-muted"
            />
        </article>
    );
}
