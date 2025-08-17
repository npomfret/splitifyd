import { themeStore } from '@/app/stores/theme-store.ts';
import type { User, UserThemeColor } from '@shared/shared-types';

interface UserIndicatorProps {
    user?: User;
    userId?: string;
    userName?: string;
    themeColor?: UserThemeColor;
    size?: 'sm' | 'md' | 'lg';
    showTooltip?: boolean;
    className?: string;
}

/**
 * UserIndicator - A small colored dot that represents a user
 * Useful for showing user association in lists, forms, etc.
 */
export function UserIndicator({ user, userId, userName, themeColor, size = 'sm', showTooltip = true, className = '' }: UserIndicatorProps) {
    // Determine user info from props
    const resolvedUserId = user?.uid || userId || '';
    const resolvedUserName = user?.displayName || userName || 'Unknown';
    const resolvedThemeColor = user?.themeColor || themeColor || themeStore.getThemeForUser(resolvedUserId);

    // Get theme colors
    const isDark = themeStore.isDarkMode;
    const themeColorValue = resolvedThemeColor ? (isDark ? resolvedThemeColor.dark : resolvedThemeColor.light) : '#6B7280';

    // Size classes
    const sizeClasses = {
        sm: 'w-2 h-2',
        md: 'w-3 h-3',
        lg: 'w-4 h-4',
    };

    const tooltip = showTooltip ? `${resolvedUserName}${resolvedThemeColor ? ` (${resolvedThemeColor.name})` : ''}` : undefined;

    return (
        <div
            className={`${sizeClasses[size]} rounded-full border ${className}`}
            style={{
                backgroundColor: themeColorValue,
                borderColor: 'rgba(255, 255, 255, 0.8)',
                boxShadow: '0 0 0 1px rgba(0, 0, 0, 0.1)',
            }}
            title={tooltip}
            aria-label={tooltip}
        />
    );
}

/**
 * UserIndicatorList - Shows multiple user indicators in a row
 */
interface UserIndicatorListProps {
    users: User[];
    maxVisible?: number;
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}

export function UserIndicatorList({ users, maxVisible = 5, size = 'sm', className = '' }: UserIndicatorListProps) {
    const visibleUsers = users.slice(0, maxVisible);
    const remainingCount = users.length - maxVisible;

    return (
        <div className={`flex items-center -space-x-1 ${className}`}>
            {visibleUsers.map((user) => (
                <UserIndicator key={user.uid} user={user} size={size} className="border-2 border-white" />
            ))}

            {remainingCount > 0 && (
                <div
                    className={`${size === 'sm' ? 'w-2 h-2 text-xs' : size === 'md' ? 'w-3 h-3 text-xs' : 'w-4 h-4 text-sm'} 
                     rounded-full bg-gray-400 text-white flex items-center justify-center border-2 border-white text-xs font-medium`}
                    title={`+${remainingCount} more users`}
                >
                    +{remainingCount}
                </div>
            )}
        </div>
    );
}
