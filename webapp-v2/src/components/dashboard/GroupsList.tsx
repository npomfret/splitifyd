import { useStaggeredReveal } from '@/app/hooks/useScrollReveal';
import { enhancedGroupsStore } from '@/app/stores/groups-store-enhanced.ts';
import { ArchiveBoxIcon } from '@/components/ui/icons';
import { navigationService } from '@/services/navigation.service';
import { GroupId } from '@billsplit-wl/shared';
import { useTranslation } from 'react-i18next';
import { EmptyState, ListStateRenderer, LoadingSpinner, Pagination, SkeletonCard } from '../ui';
import { EmptyGroupsState } from './EmptyGroupsState';
import { GroupCard } from './GroupCard';

interface GroupsListProps {
    onCreateGroup: () => void;
    onInvite?: (groupId: GroupId) => void;
    onAddExpense?: (groupId: GroupId) => void;
    emailNotVerified?: boolean;
}

export function GroupsList({ onCreateGroup, onInvite, onAddExpense, emailNotVerified }: GroupsListProps) {
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

    const handleRetry = () => {
        enhancedGroupsStore.clearError();
        enhancedGroupsStore.refreshGroups();
    };

    return (
        <>
            <ListStateRenderer
                state={{
                    loading: enhancedGroupsStore.loading,
                    error: enhancedGroupsStore.error,
                    items: enhancedGroupsStore.groups,
                    initialized: enhancedGroupsStore.initialized,
                }}
                renderLoading={() => (
                    <div className='grid-auto-fit grid-auto-fit-md' aria-busy='true' aria-label={t('dashboardComponents.groupsList.loading')}>
                        <SkeletonCard />
                        <SkeletonCard />
                        <SkeletonCard />
                    </div>
                )}
                renderEmpty={() => showArchived
                    ? (
                        <EmptyState
                            icon={<ArchiveBoxIcon size={64} />}
                            title={t('dashboardComponents.groupsList.noArchivedTitle')}
                            description={t('dashboardComponents.groupsList.noArchivedDescription')}
                        />
                    )
                    : <EmptyGroupsState onCreateGroup={onCreateGroup} emailNotVerified={emailNotVerified} />}
                onRetry={handleRetry}
            >
                {(groups) => (
                    <div className='grid-auto-fit grid-auto-fit-md' role='list' aria-label={t('dashboardComponents.groupsList.groupsListAriaLabel')} ref={gridRef}>
                        {enhancedGroupsStore.isCreatingGroup && (
                            <div className='border-2 border-dashed border-border-default rounded-lg p-8 flex items-center justify-center transition-all duration-200'>
                                <LoadingSpinner />
                                <span className='ml-3 text-text-muted'>{t('dashboardComponents.groupsList.creating')}</span>
                            </div>
                        )}
                        {groups.map((group, index) => (
                            <div
                                key={group.id}
                                role='listitem'
                                class={`relative fade-up ${visibleIndices.has(index) ? 'fade-up-visible' : ''}`}
                            >
                                {enhancedGroupsStore.updatingGroupIds.has(group.id) && (
                                    <div className='absolute inset-0 bg-interactive-primary/10 bg-opacity-75 rounded-lg flex items-center justify-center z-10'>
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
                )}
            </ListStateRenderer>
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
