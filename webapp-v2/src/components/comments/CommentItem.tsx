import type { CommentDTO } from '@billsplit-wl/shared';
import { toDisplayName } from '@billsplit-wl/shared';
import { Avatar, RelativeTime } from '../ui';

interface CommentItemProps {
    comment: CommentDTO;
    isCurrentUser?: boolean;
    showAvatar?: boolean;
    className?: string;
}

export function CommentItem({ comment, isCurrentUser = false, showAvatar = true, className = '' }: CommentItemProps) {
    return (
        <div
            className={`flex gap-3 ${isCurrentUser ? 'flex-row-reverse' : ''} ${className}`}
            data-testid='comment-item'
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
            <div className={`flex-1 min-w-0 max-w-[80%] ${isCurrentUser ? 'text-right' : ''}`}>
                <span className='font-medium text-xs text-text-secondary'>{comment.authorName}</span>
                <div
                    className={`
                        mt-1 px-3 py-2 rounded-2xl inline-block text-left
                        ${isCurrentUser
                            ? 'bg-interactive-primary text-interactive-primary-foreground rounded-tr-sm'
                            : 'bg-surface-raised text-text-primary rounded-tl-sm'
                        }
                    `}
                >
                    <p className='text-sm whitespace-pre-wrap wrap-break-word'>{comment.text}</p>
                </div>
                <div className={`mt-1 ${isCurrentUser ? 'text-right' : 'text-left'}`}>
                    <RelativeTime
                        date={comment.createdAt}
                        className='text-xs text-text-secondary'
                    />
                </div>
            </div>
        </div>
    );
}
