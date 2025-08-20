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
