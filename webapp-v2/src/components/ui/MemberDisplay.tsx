import type { DisplayName, UserId, UserThemeColor } from '@billsplit-wl/shared';
import type { ComponentChildren } from 'preact';
import { useTranslation } from 'react-i18next';
import { Avatar } from './Avatar';

interface MemberDisplayProps {
    /** Display name for the member */
    displayName: DisplayName;
    /** User ID for avatar generation */
    userId: UserId;
    /** Optional theme color for the avatar */
    themeColor?: UserThemeColor | null;
    /** Whether this is the current user (shows "(you)" suffix) */
    isCurrentUser?: boolean;
    /** Optional secondary text (e.g., role) shown below the name */
    secondaryText?: string;
    /** Optional custom suffix shown after the name (alternative to isCurrentUser) */
    suffix?: ComponentChildren;
    /** Avatar size. Defaults to 'sm'. */
    size?: 'xs' | 'sm' | 'md' | 'lg';
    /** Additional class names for the container */
    className?: string;
}

/**
 * Displays a member with avatar and name, commonly used in member lists.
 *
 * Handles the common pattern of:
 * - Avatar (themed)
 * - Display name with optional "(you)" suffix
 * - Optional secondary text (role, status, etc.)
 *
 * @example
 * // Basic usage
 * <MemberDisplay displayName={name} userId={member.uid} />
 *
 * @example
 * // With current user indicator and role
 * <MemberDisplay
 *     displayName={name}
 *     userId={member.uid}
 *     isCurrentUser={member.uid === currentUserId}
 *     secondaryText={getMemberRole(member)}
 * />
 *
 * @example
 * // With custom suffix
 * <MemberDisplay
 *     displayName={name}
 *     userId={member.uid}
 *     suffix={<span className='text-semantic-success'>(Payer)</span>}
 * />
 */
export function MemberDisplay({
    displayName,
    userId,
    themeColor,
    isCurrentUser = false,
    secondaryText,
    suffix,
    size = 'sm',
    className = '',
}: MemberDisplayProps) {
    const { t } = useTranslation();

    return (
        <div className={`flex items-center gap-2 min-w-0 ${className}`}>
            <Avatar
                displayName={displayName}
                userId={userId}
                size={size}
                themeColor={themeColor || undefined}
            />
            <div className='flex flex-col min-w-0 flex-1'>
                <span className='font-medium text-text-primary text-sm truncate leading-tight'>
                    {displayName}
                    {isCurrentUser && <span className='text-text-muted ml-1'>({t('common.you')})</span>}
                    {suffix}
                </span>
                {secondaryText && (
                    <span className='help-text-xs leading-tight'>{secondaryText}</span>
                )}
            </div>
        </div>
    );
}
