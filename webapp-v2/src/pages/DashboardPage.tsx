import { useEffect, useState } from 'preact/hooks';
import { useTranslation } from 'react-i18next';
import { navigationService } from '@/services/navigation.service';
import { useAuthRequired } from '../app/hooks/useAuthRequired';
import { enhancedGroupsStore } from '../app/stores/groups-store-enhanced';
import { BaseLayout } from '../components/layout/BaseLayout';
import { DashboardGrid } from '../components/layout/DashboardGrid';
import { GroupsList } from '../components/dashboard/GroupsList';
import { CreateGroupModal } from '../components/dashboard/CreateGroupModal';
import { DashboardStats } from '../components/dashboard/DashboardStats';
import { QuickActionsCard } from '../components/dashboard/QuickActionsCard';
import { ShareGroupModal } from '@/components/group';

export function DashboardPage() {
    const { t } = useTranslation();
    const authStore = useAuthRequired();
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [shareModalState, setShareModalState] = useState<{ isOpen: boolean; groupId: string; groupName: string }>({
        isOpen: false,
        groupId: '',
        groupName: '',
    });

    // Component should only render if user is authenticated (handled by ProtectedRoute)
    if (!authStore.user) {
        return null;
    }

    // Fetch groups when component mounts and user is authenticated
    useEffect(() => {
        if (authStore.user && !enhancedGroupsStore.initialized) {
            // Intentionally not awaited - useEffect cannot be async (React anti-pattern)
            enhancedGroupsStore.fetchGroups();
            // Subscribe to realtime changes
            enhancedGroupsStore.subscribeToChanges(authStore.user.uid);
        }

        // Cleanup on unmount
        return () => {
            enhancedGroupsStore.dispose();
        };
    }, [authStore.user, enhancedGroupsStore.initialized]);

    const user = authStore.user;

    // Action handlers for group shortcuts
    const handleInvite = (groupId: string) => {
        const group = enhancedGroupsStore.groups.find((g) => g.id === groupId);
        if (group) {
            setShareModalState({
                isOpen: true,
                groupId: groupId,
                groupName: group.name,
            });
        }
    };

    const handleAddExpense = (groupId: string) => {
        navigationService.goToAddExpense(groupId);
    };

    return (
        <BaseLayout title={t('dashboard.title')} description={t('dashboard.description')} headerVariant="dashboard">
            <DashboardGrid
                mainContent={
                    <>
                        {/* Quick Actions - Show at top on mobile, hide on large screens */}
                        <div class="lg:hidden mb-6">
                            <QuickActionsCard onCreateGroup={() => setIsCreateModalOpen(true)} />
                        </div>

                        {/* Welcome Section - Only show for first-time users (no groups) */}
                        {enhancedGroupsStore.groups.length === 0 && (
                            <div class="mb-6">
                                <h2 class="text-2xl font-bold text-gray-900 mb-2">{t('dashboard.welcomeMessage', { name: user.displayName || user.email.split('@')[0] })}</h2>
                                <p class="text-gray-600">{t('dashboard.welcomeDescription')}</p>
                            </div>
                        )}

                        {/* Groups Section */}
                        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                            <div class="flex items-center justify-between mb-6">
                                <h3 class="text-lg font-semibold text-gray-900">{t('dashboard.yourGroups')}</h3>
                                <button
                                    class="bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 transition-colors text-sm font-medium hidden lg:block"
                                    onClick={() => setIsCreateModalOpen(true)}
                                >
                                    {t('dashboard.createGroup')}
                                </button>
                            </div>

                            {/* Groups Content */}
                            <GroupsList onCreateGroup={() => setIsCreateModalOpen(true)} onInvite={handleInvite} onAddExpense={handleAddExpense} />
                        </div>
                    </>
                }
                sidebarContent={
                    <div class="space-y-4">
                        {/* Quick Actions - Show in sidebar on large screens only */}
                        <div class="hidden lg:block">
                            <QuickActionsCard onCreateGroup={() => setIsCreateModalOpen(true)} />
                        </div>
                        <DashboardStats />
                    </div>
                }
            />

            {/* Create Group Modal */}
            <CreateGroupModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                onSuccess={(groupId) => {
                    setIsCreateModalOpen(false);
                    navigationService.goToGroup(groupId);
                }}
            />

            {/* Share/Invite Group Modal */}
            <ShareGroupModal
                isOpen={shareModalState.isOpen}
                onClose={() => setShareModalState({ isOpen: false, groupId: '', groupName: '' })}
                groupId={shareModalState.groupId}
                groupName={shareModalState.groupName}
            />
        </BaseLayout>
    );
}
