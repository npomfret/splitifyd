import { useTranslation } from 'react-i18next';
import { Button } from './Button';
import { ChevronLeftIcon, ChevronRightIcon } from './icons';

interface PaginationProps {
    currentPage: number;
    hasMore: boolean;
    hasPrevious: boolean;
    onNext: () => void;
    onPrevious: () => void;
    loading?: boolean;
    itemsLabel?: string;
}

export function Pagination({ currentPage, hasMore, hasPrevious, onNext, onPrevious, loading = false }: PaginationProps) {
    const { t } = useTranslation();

    if (!hasMore && !hasPrevious) {
        return null;
    }

    return (
        <div class='flex items-center justify-between border-t border-border-default px-4 py-3 sm:px-6 mt-4'>
            <div class='flex flex-1 justify-between sm:hidden' data-testid='pagination-mobile'>
                <Button
                    onClick={onPrevious}
                    disabled={!hasPrevious || loading}
                    variant='secondary'
                    size='md'
                >
                    {t('pagination.previous')}
                </Button>
                <Button
                    onClick={onNext}
                    disabled={!hasMore || loading}
                    variant='secondary'
                    size='md'
                    className='ml-3'
                >
                    {t('pagination.next')}
                </Button>
            </div>
            <div class='hidden sm:flex sm:flex-1 sm:items-center sm:justify-between'>
                <div>
                    <p class='text-sm text-text-primary'>
                        {t('pagination.page')} <span class='font-medium'>{currentPage}</span>
                    </p>
                </div>
                <div>
                    <nav class='isolate inline-flex -space-x-px rounded-md shadow-sm' aria-label={t('pagination.navigation')}>
                        <Button
                            onClick={onPrevious}
                            disabled={!hasPrevious || loading}
                            variant='secondary'
                            size='sm'
                            ariaLabel={t('pagination.previous')}
                            className='rounded-l-md rounded-r-none'
                        >
                            <ChevronLeftIcon size={20} />
                        </Button>
                        <Button
                            onClick={onNext}
                            disabled={!hasMore || loading}
                            variant='secondary'
                            size='sm'
                            ariaLabel={t('pagination.next')}
                            className='rounded-r-md rounded-l-none'
                        >
                            <ChevronRightIcon size={20} />
                        </Button>
                    </nav>
                </div>
            </div>
        </div>
    );
}
