import { ShareGroupModal } from '@/components/group';
import { Button, Typography } from '@/components/ui';
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
                        {/* Welcome Section - Only show for first-time users (no groups) after loading is complete */}
                        {enhancedGroupsStore.groups.length === 0 && enhancedGroupsStore.initialized && !enhancedGroupsStore.loading && (
                            <div className='mb-6'>
                                <Typography variant='pageTitle' as='h2' className='mb-2'>{t('dashboard.welcomeMessage', { name: user.displayName })}</Typography>
                                <p className='text-text-muted'>{t('dashboard.welcomeDescription')}</p>
                            </div>
                        )}

                        {/* Groups Section */}
                        <section className='glass-panel border-border-default rounded-lg shadow-lg border p-8' aria-labelledby='groups-section-heading'>
                            <div className='flex flex-col gap-4 mb-8 lg:flex-row lg:items-center lg:justify-between'>
                                <Typography variant='heading' as='h3' id='groups-section-heading' className='font-bold'>{t('dashboard.yourGroups')}</Typography>
                                <div className='flex flex-wrap items-center gap-4 justify-between lg:justify-end'>
                                    <div
                                        className='inline-flex rounded-md border border-border-default overflow-hidden'
                                        role='group'
                                        aria-label={t('dashboard.groupsFilter.label')}
                                    >
                                        <Button
                                            type='button'
                                            aria-pressed={!showArchived}
                                            disabled={filterLoading}
                                            onClick={() => changeGroupFilter(false)}
                                            variant={!showArchived ? 'primary' : 'secondary'}
                                            size='sm'
                                            className='rounded-none min-w-[90px]'
                                            magnetic={false}
                                        >
                                            {t('dashboard.groupsFilter.active')}
                                        </Button>
                                        <Button
                                            type='button'
                                            aria-pressed={showArchived}
                                            disabled={filterLoading}
                                            onClick={() => changeGroupFilter(true)}
                                            variant={showArchived ? 'primary' : 'secondary'}
                                            size='sm'
                                            className='rounded-none border-l border-border-default min-w-[90px]'
                                            magnetic={false}
                                        >
                                            {t('dashboard.groupsFilter.archived')}
                                        </Button>
                                    </div>
                                    <Button
                                        variant='primary'
                                        size='md'
                                        onClick={() => setIsCreateModalOpen(true)}
                                        className='hidden lg:block'
                                    >
                                        {t('dashboard.createGroup')}
                                    </Button>
                                </div>
                            </div>

                            {/* Groups Content */}
                            <GroupsList onCreateGroup={() => setIsCreateModalOpen(true)} onInvite={handleInvite} onAddExpense={handleAddExpense} />
                        </section>

                        {/* Activity Feed - Show after groups on mobile, hide on large screens */}
                        <div className='lg:hidden mt-6'>
                            <ActivityFeedCard userId={user.uid} />
                        </div>
                    </>
                }
                sidebarContent={
                    <div className='space-y-4'>
                        {/* Activity Feed - Sidebar on large screens */}
                        <div className='hidden lg:block'>
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
