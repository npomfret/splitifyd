import { getInitials } from '@/utils/avatar.ts';
import type { CommentDTO } from '@billsplit-wl/shared';
import { toDisplayName } from '@billsplit-wl/shared';
import { RelativeTime } from '../ui';

interface CommentItemProps {
    comment: CommentDTO;
    showAvatar?: boolean;
    className?: string;
}

export function CommentItem({ comment, showAvatar = true, className = '' }: CommentItemProps) {
    const getAvatarColor = (authorId: string): string => {
        // Generate a consistent color based on the user ID
        const colors = [
            'bg-interactive-secondary',
            'bg-semantic-error',
            'bg-interactive-secondary/80',
            'bg-semantic-error/80',
            'bg-interactive-secondary/60',
            'bg-semantic-error/60',
            'bg-interactive-secondary',
            'bg-semantic-error',
        ];
        const index = authorId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
        return colors[index];
    };

    return (
        <div className={`flex gap-3 ${className}`} data-testid='comment-item'>
            {showAvatar && (
                <div className='flex-shrink-0'>
                    {comment.authorAvatar
                        ? <img src={comment.authorAvatar} alt={comment.authorName} className='w-8 h-8 rounded-full object-cover' />
                        : (
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium ${getAvatarColor(comment.authorId)}`}>
                                {getInitials(toDisplayName(comment.authorName))}
                            </div>
                        )}
                </div>
            )}
            <div className='flex-1 min-w-0'>
                <div className='flex items-baseline gap-2 flex-wrap'>
                    <span className='font-medium text-sm text-text-primary dark:text-text-muted/20'>{comment.authorName}</span>
                    <RelativeTime
                        date={comment.createdAt}
                        className='text-xs text-text-muted dark:text-text-muted/80'
                    />
                </div>
                <p className='mt-1 text-sm text-text-primary dark:text-text-muted/60 whitespace-pre-wrap break-words'>{comment.text}</p>
            </div>
        </div>
    );
}
