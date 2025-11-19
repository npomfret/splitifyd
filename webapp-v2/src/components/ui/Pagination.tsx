import { useTranslation } from 'react-i18next';
import { Button } from './Button';

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
            <div class='flex flex-1 justify-between sm:hidden'>
                <Button
                    onClick={onPrevious}
                    disabled={!hasPrevious || loading}
                    variant='secondary'
                    size='md'
                    data-testid='pagination-previous-mobile'
                >
                    {t('pagination.previous')}
                </Button>
                <Button
                    onClick={onNext}
                    disabled={!hasMore || loading}
                    variant='secondary'
                    size='md'
                    data-testid='pagination-next-mobile'
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
                    <nav class='isolate inline-flex -space-x-px rounded-md shadow-sm' aria-label='Pagination'>
                        <Button
                            onClick={onPrevious}
                            disabled={!hasPrevious || loading}
                            variant='secondary'
                            size='sm'
                            data-testid='pagination-previous'
                            ariaLabel={t('pagination.previous')}
                            className='rounded-l-md rounded-r-none'
                        >
                            <svg class='h-5 w-5' viewBox='0 0 20 20' fill='currentColor' aria-hidden='true'>
                                <path
                                    fill-rule='evenodd'
                                    d='M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z'
                                    clip-rule='evenodd'
                                />
                            </svg>
                        </Button>
                        <Button
                            onClick={onNext}
                            disabled={!hasMore || loading}
                            variant='secondary'
                            size='sm'
                            data-testid='pagination-next'
                            ariaLabel={t('pagination.next')}
                            className='rounded-r-md rounded-l-none'
                        >
                            <svg class='h-5 w-5' viewBox='0 0 20 20' fill='currentColor' aria-hidden='true'>
                                <path
                                    fill-rule='evenodd'
                                    d='M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z'
                                    clip-rule='evenodd'
                                />
                            </svg>
                        </Button>
                    </nav>
                </div>
            </div>
        </div>
    );
}
