import { useTranslation } from 'react-i18next';

interface PaginationProps {
    currentPage: number;
    hasMore: boolean;
    hasPrevious: boolean;
    onNext: () => void;
    onPrevious: () => void;
    loading?: boolean;
    itemsLabel?: string;
}

export function Pagination({ currentPage, hasMore, hasPrevious, onNext, onPrevious, loading = false, itemsLabel = 'items' }: PaginationProps) {
    const { t } = useTranslation();

    if (!hasMore && !hasPrevious) {
        return null;
    }

    return (
        <div class='flex items-center justify-between border-t border-gray-200 px-4 py-3 sm:px-6 mt-4'>
            <div class='flex flex-1 justify-between sm:hidden'>
                <button
                    onClick={onPrevious}
                    disabled={!hasPrevious || loading}
                    class={`relative inline-flex items-center rounded-md border border-gray-300 px-4 py-2 text-sm font-medium ${
                        !hasPrevious || loading ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                    data-testid='pagination-previous-mobile'
                >
                    {t('pagination.previous')}
                </button>
                <button
                    onClick={onNext}
                    disabled={!hasMore || loading}
                    class={`relative ml-3 inline-flex items-center rounded-md border border-gray-300 px-4 py-2 text-sm font-medium ${
                        !hasMore || loading ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                    data-testid='pagination-next-mobile'
                >
                    {t('pagination.next')}
                </button>
            </div>
            <div class='hidden sm:flex sm:flex-1 sm:items-center sm:justify-between'>
                <div>
                    <p class='text-sm text-gray-700'>
                        {t('pagination.page')} <span class='font-medium'>{currentPage}</span>
                    </p>
                </div>
                <div>
                    <nav class='isolate inline-flex -space-x-px rounded-md shadow-sm' aria-label='Pagination'>
                        <button
                            onClick={onPrevious}
                            disabled={!hasPrevious || loading}
                            class={`relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 focus:z-20 focus:outline-offset-0 ${
                                !hasPrevious || loading ? 'bg-gray-100 cursor-not-allowed' : 'hover:bg-gray-50'
                            }`}
                            data-testid='pagination-previous'
                        >
                            <span class='sr-only'>{t('pagination.previous')}</span>
                            <svg class='h-5 w-5' viewBox='0 0 20 20' fill='currentColor' aria-hidden='true'>
                                <path
                                    fill-rule='evenodd'
                                    d='M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z'
                                    clip-rule='evenodd'
                                />
                            </svg>
                        </button>
                        <button
                            onClick={onNext}
                            disabled={!hasMore || loading}
                            class={`relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 focus:z-20 focus:outline-offset-0 ${
                                !hasMore || loading ? 'bg-gray-100 cursor-not-allowed' : 'hover:bg-gray-50'
                            }`}
                            data-testid='pagination-next'
                        >
                            <span class='sr-only'>{t('pagination.next')}</span>
                            <svg class='h-5 w-5' viewBox='0 0 20 20' fill='currentColor' aria-hidden='true'>
                                <path
                                    fill-rule='evenodd'
                                    d='M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z'
                                    clip-rule='evenodd'
                                />
                            </svg>
                        </button>
                    </nav>
                </div>
            </div>
        </div>
    );
}
