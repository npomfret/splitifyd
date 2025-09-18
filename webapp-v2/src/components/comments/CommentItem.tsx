import { useTranslation } from 'react-i18next';
import { formatDistanceToNow } from '@/utils/dateUtils.ts';
import { getInitials } from '@/utils/avatar.ts';
import type { CommentApiResponse } from '@splitifyd/shared';

interface CommentItemProps {
    comment: CommentApiResponse;
    showAvatar?: boolean;
    className?: string;
}

export function CommentItem({ comment, showAvatar = true, className = '' }: CommentItemProps) {
    const { t } = useTranslation();

    const getAvatarColor = (authorId: string): string => {
        // Generate a consistent color based on the user ID
        const colors = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-pink-500', 'bg-indigo-500', 'bg-teal-500', 'bg-orange-500', 'bg-red-500'];
        const index = authorId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
        return colors[index];
    };

    const formatTimestamp = (dateString: string): string => {
        try {
            const date = new Date(dateString);
            const distance = formatDistanceToNow(date);
            return distance === 'just now' ? distance : distance;
        } catch {
            return t('comments.commentItem.recently');
        }
    };

    return (
        <div className={`flex gap-3 ${className}`} data-testid="comment-item">
            {showAvatar && (
                <div className="flex-shrink-0">
                    {comment.authorAvatar ? (
                        <img src={comment.authorAvatar} alt={comment.authorName} className="w-8 h-8 rounded-full object-cover" />
                    ) : (
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium ${getAvatarColor(comment.authorId)}`}>
                            {getInitials(comment.authorName)}
                        </div>
                    )}
                </div>
            )}
            <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="font-medium text-sm text-gray-900 dark:text-gray-100">{comment.authorName}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">{formatTimestamp(comment.createdAt)}</span>
                </div>
                <p className="mt-1 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words">{comment.text}</p>
            </div>
        </div>
    );
}
