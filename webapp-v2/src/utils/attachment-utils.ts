export const isImage = (contentType: string): boolean => contentType.startsWith('image/');

export const formatFileSize = (bytes: number): string => {
    if (bytes >= 1024 * 1024) {
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }
    if (bytes >= 1024) {
        return `${Math.round(bytes / 1024)} KB`;
    }
    return `${bytes} B`;
};

/**
 * Checks if a URL requires authentication to fetch.
 * API paths need auth headers; data URLs, blob URLs, and external URLs don't.
 */
export function urlNeedsAuthentication(url: string): boolean {
    // Data URLs don't need auth
    if (url.startsWith('data:')) {
        return false;
    }
    // Blob URLs don't need auth
    if (url.startsWith('blob:')) {
        return false;
    }
    // API paths need auth
    if (url.startsWith('/api/')) {
        return true;
    }
    // Relative attachment paths need auth
    if (url.includes('/attachments/')) {
        return true;
    }
    // External URLs (https://) don't need our auth
    return false;
}
