export interface AvatarProps {
    displayName: string;
    userId: string;
    size?: 'sm' | 'md' | 'lg';
}

// Generate initials from display name
export function getInitials(displayName: string): string {
    return displayName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
}

// Generate a consistent color based on user ID
export function getUserColor(userId: string): { bg: string; text: string } {
    const colors = [
        { bg: 'bg-purple-100', text: 'text-purple-700' },
        { bg: 'bg-blue-100', text: 'text-blue-700' },
        { bg: 'bg-green-100', text: 'text-green-700' },
        { bg: 'bg-yellow-100', text: 'text-yellow-700' },
        { bg: 'bg-red-100', text: 'text-red-700' },
        { bg: 'bg-indigo-100', text: 'text-indigo-700' },
        { bg: 'bg-pink-100', text: 'text-pink-700' },
        { bg: 'bg-teal-100', text: 'text-teal-700' },
    ];

    // Generate a hash from the userId to ensure consistent colors
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
        hash = (hash << 5) - hash + userId.charCodeAt(i);
        hash = hash & hash; // Convert to 32-bit integer
    }

    return colors[Math.abs(hash) % colors.length];
}

// Get size classes for avatars
export function getAvatarSize(size: AvatarProps['size'] = 'md'): { container: string; text: string } {
    switch (size) {
        case 'sm':
            return { container: 'w-6 h-6', text: 'text-xs' };
        case 'lg':
            return { container: 'w-10 h-10', text: 'text-base' };
        default:
            return { container: 'w-8 h-8', text: 'text-sm' };
    }
}

// Calculate contrast color for text on colored backgrounds
export function getContrastColor(hexColor: string): string {
    // Remove # if present
    const hex = hexColor.replace('#', '');

    // Convert to RGB
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);

    // Calculate luminance using WCAG formula
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

    // Return white for dark colors, dark for light colors
    return luminance > 0.5 ? '#000000' : '#FFFFFF';
}
