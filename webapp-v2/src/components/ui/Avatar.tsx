import { themeStore } from '@/app/stores/theme-store.ts';
import { type AvatarProps, getAvatarSize, getContrastColor, getInitials } from '@/utils/avatar.ts';
import type { UserThemeColor } from '@billsplit-wl/shared';

interface EnhancedAvatarProps extends AvatarProps {
    themeColor?: UserThemeColor;
    photoURL?: string | null;
}

export function Avatar({ displayName, userId, size = 'md', themeColor, photoURL }: EnhancedAvatarProps) {
    const initials = getInitials(displayName);
    const sizeClasses = getAvatarSize(size);

    // Get theme color - priority: prop > store
    const userTheme = themeColor || themeStore.getThemeForUser(userId);
    const isDark = themeStore.isDarkMode;

    // If no theme color is available, don't render
    if (!userTheme) {
        return null;
    }

    // If user has a photo, show that instead of colored avatar
    if (photoURL) {
        return (
            <img
                src={photoURL}
                alt={displayName}
                className={`${sizeClasses.container} rounded-full object-cover border-2`}
                style={{
                    borderColor: isDark ? userTheme.dark : userTheme.light,
                }}
                title={displayName}
            />
        );
    }

    // Determine colors
    const backgroundColor = isDark ? userTheme.dark : userTheme.light;
    const textColor = getContrastColor(backgroundColor);

    // Pattern styles for accessibility
    const patternStyle = userTheme.pattern !== 'solid' ? getPatternStyle(userTheme.pattern, backgroundColor) : {};

    return (
        <div
            className={`rounded-full flex items-center justify-center ${sizeClasses.container} relative overflow-hidden border`}
            style={{
                backgroundColor,
                borderColor: backgroundColor,
                ...patternStyle,
            }}
            title={`${displayName} (${userTheme.name})`}
            role='img'
            aria-label={displayName}
        >
            <span className={`${sizeClasses.text} font-medium relative z-10`} style={{ color: textColor }}>
                {initials}
            </span>

            {/* Pattern overlay for colorblind accessibility */}
            {userTheme.pattern !== 'solid' && <div className='absolute inset-0 pointer-events-none opacity-20' style={getPatternOverlay(userTheme.pattern)} />}
        </div>
    );
}

// Helper function to generate pattern styles
function getPatternStyle(pattern: string, baseColor: string): React.CSSProperties {
    switch (pattern) {
        case 'dots':
            return {
                backgroundImage: `radial-gradient(circle, rgba(255,255,255,0.3) 2px, transparent 2px)`,
                backgroundSize: '8px 8px',
            };
        case 'stripes':
            return {
                backgroundImage: `repeating-linear-gradient(45deg, ${baseColor}, ${baseColor} 4px, rgba(255,255,255,0.2) 4px, rgba(255,255,255,0.2) 8px)`,
            };
        case 'diagonal':
            return {
                backgroundImage: `repeating-linear-gradient(-45deg, ${baseColor}, ${baseColor} 3px, rgba(255,255,255,0.2) 3px, rgba(255,255,255,0.2) 6px)`,
            };
        default:
            return {};
    }
}

// Helper function for pattern overlays
function getPatternOverlay(pattern: string): React.CSSProperties {
    switch (pattern) {
        case 'dots':
            return {
                backgroundImage: `radial-gradient(circle, rgba(0,0,0,0.1) 1px, transparent 1px)`,
                backgroundSize: '6px 6px',
            };
        case 'stripes':
            return {
                backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(0,0,0,0.1) 2px, rgba(0,0,0,0.1) 4px)`,
            };
        case 'diagonal':
            return {
                backgroundImage: `repeating-linear-gradient(-45deg, transparent, transparent 2px, rgba(0,0,0,0.1) 2px, rgba(0,0,0,0.1) 4px)`,
            };
        default:
            return {};
    }
}
