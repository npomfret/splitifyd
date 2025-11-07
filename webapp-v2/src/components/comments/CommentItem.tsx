import { getInitials } from '@/utils/avatar.ts';
import type { CommentDTO } from '@splitifyd/shared';
import { RelativeTime } from '../ui';

interface CommentItemProps {
    comment: CommentDTO;
    showAvatar?: boolean;
    className?: string;
}

export function CommentItem({ comment, showAvatar = true, className = '' }: CommentItemProps) {
    const getAvatarColor = (authorId: string): string => {
        // Generate a consistent color based on the user ID
        const colors = ['bg-orange-500', 'bg-red-500', 'bg-orange-600', 'bg-red-600', 'bg-orange-400', 'bg-red-400', 'bg-orange-700', 'bg-red-700'];
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
                                {getInitials(comment.authorName)}
                            </div>
                        )}
                </div>
            )}
            <div className='flex-1 min-w-0'>
                <div className='flex items-baseline gap-2 flex-wrap'>
                    <span className='font-medium text-sm text-gray-900 dark:text-gray-100'>{comment.authorName}</span>
                    <RelativeTime
                        date={comment.createdAt}
                        className='text-xs text-gray-500 dark:text-gray-400'
                    />
                </div>
                <p className='mt-1 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words'>{comment.text}</p>
            </div>
        </div>
    );
}
