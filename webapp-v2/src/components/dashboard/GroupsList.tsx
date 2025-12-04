import { useStaggeredReveal } from '@/app/hooks/useScrollReveal';
import { enhancedGroupsStore } from '@/app/stores/groups-store-enhanced.ts';
import { navigationService } from '@/services/navigation.service';
import { GroupId } from '@billsplit-wl/shared';
import { ArchiveBoxIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import { EmptyState, ErrorState, LoadingSpinner, Pagination, SkeletonCard } from '../ui';
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

    // Staggered reveal animation for group cards
    const { ref: gridRef, visibleIndices } = useStaggeredReveal(enhancedGroupsStore.groups.length, 75);

    const handleNextPage = async () => {
        await enhancedGroupsStore.loadNextPage();
    };

    const handlePreviousPage = async () => {
        await enhancedGroupsStore.loadPreviousPage();
    };

    if (enhancedGroupsStore.loading && !enhancedGroupsStore.initialized) {
        return (
            <div class='grid-auto-fit grid-auto-fit-md' aria-busy='true' aria-label={t('dashboardComponents.groupsList.loading')}>
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
            </div>
        );
    }

    if (enhancedGroupsStore.error) {
        return (
            <ErrorState
                error={enhancedGroupsStore.error}
                title={t('dashboardComponents.groupsList.loadFailed')}
                onRetry={() => {
                    enhancedGroupsStore.clearError();
                    enhancedGroupsStore.refreshGroups();
                }}
                className='py-8'
            />
        );
    }

    if (enhancedGroupsStore.groups.length === 0 && enhancedGroupsStore.initialized) {
        if (showArchived) {
            return (
                <EmptyState
                    icon={<ArchiveBoxIcon className='w-16 h-16' aria-hidden='true' />}
                    title={t('dashboardComponents.groupsList.noArchivedTitle')}
                    description={t('dashboardComponents.groupsList.noArchivedDescription')}
                    data-testid='archived-groups-empty-state'
                />
            );
        }
        return <EmptyGroupsState onCreateGroup={onCreateGroup} />;
    }

    return (
        <>
            <div class='grid-auto-fit grid-auto-fit-md' data-testid='groups-grid' ref={gridRef}>
                {enhancedGroupsStore.isCreatingGroup && (
                    <div class='border-2 border-dashed border-border-default rounded-lg p-8 flex items-center justify-center transition-all duration-200'>
                        <LoadingSpinner />
                        <span class='ml-3 text-text-muted'>{t('dashboardComponents.groupsList.creating')}</span>
                    </div>
                )}
                {enhancedGroupsStore.groups.map((group, index) => (
                    <div
                        key={group.id}
                        class={`relative fade-up ${visibleIndices.has(index) ? 'fade-up-visible' : ''}`}
                    >
                        {enhancedGroupsStore.updatingGroupIds.has(group.id) && (
                            <div class='absolute inset-0 bg-interactive-primary/10 bg-opacity-75 rounded-lg flex items-center justify-center z-10'>
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
