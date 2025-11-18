import { ShareGroupModal } from '@/components/group';
import { navigationService } from '@/services/navigation.service';
import { logWarning } from '@/utils/browser-logger.ts';
import { GroupId, GroupName } from '@billsplit-wl/shared';
import { toGroupId, toGroupName } from '@billsplit-wl/shared';
import { useEffect, useState } from 'preact/hooks';
import { useTranslation } from 'react-i18next';
import { useAuthRequired } from '../app/hooks/useAuthRequired';
import { enhancedGroupsStore } from '../app/stores/groups-store-enhanced';
import { ActivityFeedCard } from '../components/dashboard/ActivityFeedCard';
import { CreateGroupModal } from '../components/dashboard/CreateGroupModal';
import { GroupsList } from '../components/dashboard/GroupsList';
import { BaseLayout } from '../components/layout/BaseLayout';
import { DashboardGrid } from '../components/layout/DashboardGrid';

export function DashboardPage() {
    const { t } = useTranslation();
    const authStore = useAuthRequired();
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [shareModalState, setShareModalState] = useState<{ isOpen: boolean; groupId: GroupId; groupName: GroupName; }>({
        isOpen: false,
        groupId: toGroupId(''),
        groupName: toGroupName(''),
    });
    const showArchived = enhancedGroupsStore.showArchived;
    const filterLoading = enhancedGroupsStore.loading;

    const changeGroupFilter = (showArchivedGroups: boolean) => {
        if (enhancedGroupsStore.showArchived === showArchivedGroups && enhancedGroupsStore.initialized) {
            return;
        }

        enhancedGroupsStore
            .setShowArchived(showArchivedGroups)
            .catch((error) => {
                logWarning('Failed to change groups filter', {
                    target: showArchivedGroups ? 'archived' : 'active',
                    error: error instanceof Error ? error.message : String(error),
                });
            });
    };

    // Component should only render if user is authenticated (handled by ProtectedRoute)
    if (!authStore.user) {
        return null;
    }

    // Fetch groups when component mounts and user is authenticated
    useEffect(() => {
        if (authStore.user) {
            // Use unique component ID for reference counting
            const componentId = 'dashboard-page';

            // Register component with reference-counted subscription
            // This prevents subscription churn when multiple components use the store
            enhancedGroupsStore.registerComponent(componentId, authStore.user.uid);

            // Cleanup: deregister this component
            return () => {
                enhancedGroupsStore.deregisterComponent(componentId);
            };
        }
    }, [authStore.user]); // Only depend on auth state to prevent subscription churn

    const user = authStore.user;

    // Action handlers for group shortcuts
    const handleInvite = (groupId: GroupId) => {
        const group = enhancedGroupsStore.groups.find((g) => g.id === groupId);
        if (group) {
            setShareModalState({
                isOpen: true,
                groupId: groupId,
                groupName: group.name,
            });
        }
    };

    const handleAddExpense = (groupId: GroupId) => {
        navigationService.goToAddExpense(groupId);
    };

    return (
        <BaseLayout title={t('dashboard.title')} description={t('dashboard.description')} headerVariant='dashboard'>
            <DashboardGrid
                mainContent={
                    <>
                        {/* Activity Feed - Show at top on mobile, hide on large screens */}
                        <div class='lg:hidden mb-6'>
                            <ActivityFeedCard userId={user.uid} />
                        </div>

                        {/* Welcome Section - Only show for first-time users (no groups) after loading is complete */}
                        {enhancedGroupsStore.groups.length === 0 && enhancedGroupsStore.initialized && !enhancedGroupsStore.loading && (
                            <div class='mb-6'>
                                <h2 class='text-2xl font-bold text-text-primary mb-2'>{t('dashboard.welcomeMessage', { name: user.displayName })}</h2>
                                <p class='text-text-muted'>{t('dashboard.welcomeDescription')}</p>
                            </div>
                        )}

                        {/* Groups Section */}
                        <div class='glass-panel border-border-default rounded-lg shadow-lg border p-8' data-testid='groups-container'>
                            <div class='flex flex-col gap-4 mb-8 lg:flex-row lg:items-center lg:justify-between'>
                                <h3 class='text-xl font-bold text-text-primary'>{t('dashboard.yourGroups')}</h3>
                                <div class='flex flex-wrap items-center gap-4 justify-between lg:justify-end'>
                                    <div
                                        class='inline-flex rounded-md border border-border-default overflow-hidden'
                                        role='group'
                                        aria-label={t('dashboard.groupsFilter.label')}
                                    >
                                        <button
                                            type='button'
                                            aria-pressed={!showArchived}
                                            disabled={filterLoading}
                                            onClick={() => changeGroupFilter(false)}
                                            class={`px-4 py-2 text-sm font-medium transition-all duration-200 focus:outline-none ${
                                                !showArchived
                                                    ? 'bg-[image:var(--gradient-primary)] text-interactive-primary-foreground shadow-sm'
                                                    : 'bg-surface-base text-text-muted hover:bg-surface-muted'
                                            }`}
                                        >
                                            {t('dashboard.groupsFilter.active')}
                                        </button>
                                        <button
                                            type='button'
                                            aria-pressed={showArchived}
                                            disabled={filterLoading}
                                            onClick={() => changeGroupFilter(true)}
                                            class={`px-4 py-2 text-sm font-medium transition-all duration-200 focus:outline-none border-l border-border-default ${
                                                showArchived
                                                    ? 'bg-[image:var(--gradient-primary)] text-interactive-primary-foreground shadow-sm'
                                                    : 'bg-surface-base text-text-muted hover:bg-surface-muted'
                                            }`}
                                        >
                                            {t('dashboard.groupsFilter.archived')}
                                        </button>
                                    </div>
                                    <button
                                        class='bg-[image:var(--gradient-primary)] text-interactive-primary-foreground px-6 py-2.5 rounded-md shadow-md transition-all duration-200 text-sm font-semibold hidden lg:block hover:shadow-lg hover:scale-[1.02]'
                                        onClick={() => setIsCreateModalOpen(true)}
                                    >
                                        {t('dashboard.createGroup')}
                                    </button>
                                </div>
                            </div>

                            {/* Groups Content */}
                            <GroupsList onCreateGroup={() => setIsCreateModalOpen(true)} onInvite={handleInvite} onAddExpense={handleAddExpense} />
                        </div>
                    </>
                }
                sidebarContent={
                    <div class='space-y-4'>
                        {/* Activity Feed - Sidebar on large screens */}
                        <div class='hidden lg:block'>
                            <ActivityFeedCard userId={user.uid} />
                        </div>
                    </div>
                }
            />

            {/* Create Group Modal */}
            <CreateGroupModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                onSuccess={async (groupId) => {
                    // Wait for navigation to complete before closing modal
                    // This eliminates race conditions deterministically
                    await navigationService.goToGroup(groupId);
                    setIsCreateModalOpen(false);
                }}
            />

            {/* Share/Invite Group Modal */}
            <ShareGroupModal
                isOpen={shareModalState.isOpen}
                onClose={() =>
                    setShareModalState({
                        isOpen: false,
                        groupId: toGroupId(''),
                        groupName: toGroupName(''),
                    })}
                groupId={shareModalState.groupId}
                groupName={shareModalState.groupName}
            />
        </BaseLayout>
    );
}
