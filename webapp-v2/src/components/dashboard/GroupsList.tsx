import { enhancedGroupsStore } from '@/app/stores/groups-store-enhanced.ts';
import { navigationService } from '@/services/navigation.service';
import { GroupId } from '@splitifyd/shared';
import { useTranslation } from 'react-i18next';
import { LoadingSpinner, Pagination } from '../ui';
import { EmptyGroupsState } from './EmptyGroupsState';
import { GroupCard } from './GroupCard';

interface GroupsListProps {
    onCreateGroup: () => void;
    onInvite?: (groupId: GroupId) => void;
    onAddExpense?: (groupId: GroupId) => void;
}

export function GroupsList({ onCreateGroup, onInvite, onAddExpense }: GroupsListProps) {
    const { t } = useTranslation();
    const showArchived = enhancedGroupsStore.showArchived;

    const handleNextPage = async () => {
        await enhancedGroupsStore.loadNextPage();
    };

    const handlePreviousPage = async () => {
        await enhancedGroupsStore.loadPreviousPage();
    };

    if (enhancedGroupsStore.loading && !enhancedGroupsStore.initialized) {
        return (
            <div class='flex items-center justify-center py-8'>
                <LoadingSpinner />
                <span class='ml-3 text-gray-600'>{t('dashboardComponents.groupsList.loading')}</span>
            </div>
        );
    }

    if (enhancedGroupsStore.error) {
        return (
            <div class='text-center py-8'>
                <div class='text-red-600 mb-4'>
                    <svg class='w-12 h-12 mx-auto mb-2' fill='none' stroke='currentColor' viewBox='0 0 24 24' aria-hidden='true' focusable='false'>
                        <path
                            stroke-linecap='round'
                            stroke-linejoin='round'
                            stroke-width='2'
                            d='M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z'
                        />
                    </svg>
                    <h4 class='text-lg font-medium text-red-800' role='alert' data-testid='groups-load-error-title'>
                        {t('dashboardComponents.groupsList.loadFailed')}
                    </h4>
                    <p class='text-red-600 mt-1' role='alert' data-testid='groups-load-error-message'>
                        {enhancedGroupsStore.error}
                    </p>
                </div>
                <button
                    onClick={() => {
                        enhancedGroupsStore.clearError();
                        enhancedGroupsStore.refreshGroups();
                    }}
                    class='bg-red-100 text-red-700 px-4 py-2 rounded-md hover:bg-red-200 transition-colors text-sm font-medium'
                >
                    {t('dashboardComponents.groupsList.tryAgain')}
                </button>
            </div>
        );
    }

    if (enhancedGroupsStore.groups.length === 0 && enhancedGroupsStore.initialized) {
        if (showArchived) {
            return (
                <div class='text-center py-12 text-gray-600' data-testid='archived-groups-empty-state'>
                    <div class='text-gray-300 mb-4'>
                        <svg class='w-16 h-16 mx-auto' fill='none' stroke='currentColor' viewBox='0 0 24 24' aria-hidden='true' focusable='false'>
                            <path stroke-linecap='round' stroke-linejoin='round' stroke-width='1' d='M12 8v8m0 0l-3-3m3 3l3-3M5 13a7 7 0 0114 0' />
                        </svg>
                    </div>
                    <h4 class='text-lg font-medium text-gray-900 mb-2'>{t('dashboardComponents.groupsList.noArchivedTitle')}</h4>
                    <p class='text-gray-600 max-w-md mx-auto'>{t('dashboardComponents.groupsList.noArchivedDescription')}</p>
                </div>
            );
        }
        return <EmptyGroupsState onCreateGroup={onCreateGroup} />;
    }

    return (
        <>
            <div class='grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4' data-testid='groups-grid'>
                {enhancedGroupsStore.isCreatingGroup && (
                    <div class='border-2 border-dashed border-gray-300 rounded-lg p-6 flex items-center justify-center'>
                        <LoadingSpinner />
                        <span class='ml-3 text-gray-600'>{t('dashboardComponents.groupsList.creating')}</span>
                    </div>
                )}
                {enhancedGroupsStore.groups.map((group) => (
                    <div key={group.id} class='relative'>
                        {enhancedGroupsStore.updatingGroupIds.has(group.id) && (
                            <div class='absolute inset-0 bg-white bg-opacity-75 rounded-lg flex items-center justify-center z-10'>
                                <LoadingSpinner />
                            </div>
                        )}
                        <GroupCard
                            group={group}
                            onClick={() => {
                                navigationService.goToGroup(group.id);
                            }}
                            onInvite={onInvite}
                            onAddExpense={onAddExpense}
                            isArchivedView={showArchived}
                        />
                    </div>
                ))}
            </div>
            <Pagination
                currentPage={enhancedGroupsStore.currentPage}
                hasMore={enhancedGroupsStore.hasMore}
                hasPrevious={enhancedGroupsStore.currentPage > 1}
                onNext={handleNextPage}
                onPrevious={handlePreviousPage}
                loading={enhancedGroupsStore.loading}
                itemsLabel='groups'
            />
        </>
    );
}
