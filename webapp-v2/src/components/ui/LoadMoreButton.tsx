import { useTranslation } from 'react-i18next';
import { Button } from './Button';

interface LoadMoreButtonProps {
    /** Called when the button is clicked */
    onClick: () => void;
    /** Whether loading is in progress */
    loading?: boolean;
    /** Text to show when not loading. Defaults to common.loadMore translation */
    idleText?: string;
    /** Text to show when loading. Defaults to common.loading translation */
    loadingText?: string;
    /** Whether the button should take full width */
    fullWidth?: boolean;
    /** Additional class names */
    className?: string;
}

/**
 * A standardized "Load More" button for paginated lists.
 *
 * Uses Button with ghost variant and handles loading state automatically.
 *
 * @example
 * <LoadMoreButton
 *     onClick={handleLoadMore}
 *     loading={isLoading}
 * />
 *
 * @example
 * // With custom text
 * <LoadMoreButton
 *     onClick={handleLoadMore}
 *     loading={isLoading}
 *     idleText={t('comments.commentsList.loadMore')}
 *     loadingText={t('comments.commentsList.loadingMore')}
 * />
 */
export function LoadMoreButton({
    onClick,
    loading = false,
    idleText,
    loadingText,
    fullWidth = false,
    className = '',
}: LoadMoreButtonProps) {
    const { t } = useTranslation();

    const displayText = loading
        ? (loadingText ?? t('common.loading'))
        : (idleText ?? t('common.loadMore'));

    return (
        <Button
            variant='ghost'
            onClick={onClick}
            disabled={loading}
            loading={loading}
            fullWidth={fullWidth}
            className={className}
        >
            {displayText}
        </Button>
    );
}
