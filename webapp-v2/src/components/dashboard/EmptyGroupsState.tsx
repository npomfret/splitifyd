import { useTranslation } from 'react-i18next';

interface EmptyGroupsStateProps {
    onCreateGroup: () => void;
}

export function EmptyGroupsState({ onCreateGroup }: EmptyGroupsStateProps) {
    const { t } = useTranslation();
    return (
        <div class='text-center py-12'>
            <div class='text-gray-400 mb-4'>
                <svg class='w-16 h-16 mx-auto mb-4' fill='none' stroke='currentColor' viewBox='0 0 24 24' aria-hidden='true' focusable='false'>
                    <path
                        stroke-linecap='round'
                        stroke-linejoin='round'
                        stroke-width='1'
                        d='M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z'
                    />
                </svg>
            </div>

            <h4 class='text-lg font-medium text-gray-900 mb-2'>{t('emptyGroupsState.title')}</h4>
            <p class='text-gray-600 mb-6 max-w-md mx-auto'>{t('emptyGroupsState.description')}</p>

            <button onClick={onCreateGroup} class='bg-purple-600 text-white px-6 py-3 rounded-md hover:bg-purple-700 transition-colors font-medium'>
                {t('emptyGroupsState.createFirstGroup')}
            </button>

            {/* Additional getting started tips */}
            <div class='mt-8 text-left max-w-2xl mx-auto'>
                <h5 class='text-sm font-medium text-gray-900 mb-3'>{t('emptyGroupsState.gettingStartedTitle')}</h5>
                <div class='grid md:grid-cols-3 gap-4'>
                    <div class='bg-purple-50 p-4 rounded-lg'>
                        <div class='text-purple-600 mb-2'>
                            <svg class='w-6 h-6' fill='none' stroke='currentColor' viewBox='0 0 24 24' aria-hidden='true' focusable='false'>
                                <path
                                    stroke-linecap='round'
                                    stroke-linejoin='round'
                                    stroke-width='2'
                                    d='M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z'
                                />
                            </svg>
                        </div>
                        <h6 class='font-medium text-gray-900 mb-1'>{t('emptyGroupsState.step1Title')}</h6>
                        <p class='text-sm text-gray-600'>{t('emptyGroupsState.step1Description')}</p>
                    </div>

                    <div class='bg-green-50 p-4 rounded-lg'>
                        <div class='text-green-600 mb-2'>
                            <svg class='w-6 h-6' fill='none' stroke='currentColor' viewBox='0 0 24 24' aria-hidden='true' focusable='false'>
                                <path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M12 6v6m0 0v6m0-6h6m-6 0H6' />
                            </svg>
                        </div>
                        <h6 class='font-medium text-gray-900 mb-1'>{t('emptyGroupsState.step2Title')}</h6>
                        <p class='text-sm text-gray-600'>{t('emptyGroupsState.step2Description')}</p>
                    </div>

                    <div class='bg-blue-50 p-4 rounded-lg'>
                        <div class='text-blue-600 mb-2'>
                            <svg class='w-6 h-6' fill='none' stroke='currentColor' viewBox='0 0 24 24' aria-hidden='true' focusable='false'>
                                <path
                                    stroke-linecap='round'
                                    stroke-linejoin='round'
                                    stroke-width='2'
                                    d='M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z'
                                />
                            </svg>
                        </div>
                        <h6 class='font-medium text-gray-900 mb-1'>{t('emptyGroupsState.step3Title')}</h6>
                        <p class='text-sm text-gray-600'>{t('emptyGroupsState.step3Description')}</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
