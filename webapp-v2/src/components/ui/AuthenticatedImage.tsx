import { apiClient } from '@/app/apiClient';
import { PhotoIcon } from '@heroicons/react/24/outline';
import { useEffect, useState } from 'preact/hooks';
import { LoadingSpinner } from './LoadingSpinner';

interface AuthenticatedImageProps {
    /** Image URL - can be an API path (requires auth) or data URL (no auth needed) */
    src: string;
    /** Alt text for accessibility */
    alt: string;
    /** Optional CSS classes */
    className?: string;
    /** Callback when image loads successfully */
    onLoad?: () => void;
    /** Callback when image fails to load */
    onError?: () => void;
    /** Whether to show a placeholder on error (default: true) */
    showErrorPlaceholder?: boolean;
}

/**
 * Checks if a URL requires authentication.
 * API paths need auth headers; data URLs and external URLs don't.
 */
function needsAuthentication(url: string): boolean {
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

/**
 * Image component that handles authenticated API image URLs.
 *
 * For API paths (e.g., /api/groups/.../attachments/...):
 * - Fetches the image with Authorization header
 * - Converts response blob to Object URL
 * - Cleans up Object URL on unmount
 *
 * For data URLs and external URLs:
 * - Renders directly without auth fetch
 */
export function AuthenticatedImage({
    src,
    alt,
    className,
    onLoad,
    onError,
    showErrorPlaceholder = true,
}: AuthenticatedImageProps) {
    const [objectUrl, setObjectUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
        // Reset state when src changes
        setLoading(true);
        setError(false);
        setObjectUrl(null);

        if (!src) {
            setLoading(false);
            setError(true);
            return;
        }

        // If the URL doesn't need auth, we can use it directly
        if (!needsAuthentication(src)) {
            setObjectUrl(src);
            setLoading(false);
            return;
        }

        // For API URLs, fetch with auth header
        let cancelled = false;
        let currentObjectUrl: string | null = null;

        const fetchImage = async () => {
            try {
                const blob = await apiClient.fetchBlob(src);

                if (cancelled) {
                    return;
                }

                currentObjectUrl = URL.createObjectURL(blob);
                setObjectUrl(currentObjectUrl);
                setLoading(false);
                onLoad?.();
            } catch {
                if (cancelled) {
                    return;
                }
                setError(true);
                setLoading(false);
                onError?.();
            }
        };

        fetchImage();

        // Cleanup: revoke Object URL when component unmounts or src changes
        return () => {
            cancelled = true;
            if (currentObjectUrl) {
                URL.revokeObjectURL(currentObjectUrl);
            }
        };
    }, [src, onLoad, onError]);

    if (loading) {
        return (
            <div className={`flex items-center justify-center ${className || ''}`}>
                <LoadingSpinner size='sm' />
            </div>
        );
    }

    if (error || !objectUrl) {
        if (!showErrorPlaceholder) {
            return null;
        }
        return (
            <div
                className={`flex items-center justify-center bg-surface-muted text-text-muted ${className || ''}`}
                role='img'
                aria-label={alt}
            >
                <PhotoIcon className='h-6 w-6' />
            </div>
        );
    }

    return (
        <img
            src={objectUrl}
            alt={alt}
            className={className}
            loading='lazy'
        />
    );
}
