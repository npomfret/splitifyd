import { useEffect, useState } from 'preact/hooks';
import { route } from 'preact-router';
import { useAuthRequired } from '../app/hooks/useAuthRequired';
import { enhancedGroupsStore } from '../app/stores/groups-store-enhanced';
import { BaseLayout } from '../components/layout/BaseLayout';
import { DashboardGrid } from '../components/layout/DashboardGrid';
import { GroupsList } from '../components/dashboard/GroupsList';
import { CreateGroupModal } from '../components/dashboard/CreateGroupModal';
import { DashboardStats } from '../components/dashboard/DashboardStats';
import { QuickActionsCard } from '../components/dashboard/QuickActionsCard';

export function DashboardPage() {
  const authStore = useAuthRequired();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Redirect to login if not authenticated  
  useEffect(() => {
    if (!authStore.user) {
      route('/login', true);
      return;
    }
  }, [authStore.user]);

  // Fetch groups and setup real-time updates when component mounts and user is authenticated
  useEffect(() => {
    if (authStore.user && !enhancedGroupsStore.initialized) {
      // Intentionally not awaited - useEffect cannot be async (React anti-pattern)
      enhancedGroupsStore.fetchGroups();
      
      // Setup real-time change subscriptions
      enhancedGroupsStore.subscribeToChanges(authStore.user.uid);
    }
  }, [authStore.user, enhancedGroupsStore.initialized]);

  // Redirect if user is not authenticated (will happen in useEffect)
  if (!authStore.user) {
    return null;
  }

  const user = authStore.user;

  return (
    <BaseLayout 
      title="Dashboard - Splitifyd"
      description="Manage your groups and expenses with Splitifyd"
      headerVariant="dashboard"
    >
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
                <h2 class="text-2xl font-bold text-gray-900 mb-2">
                  Welcome to Splitifyd, {user.displayName || user.email.split('@')[0]}!
                </h2>
                <p class="text-gray-600">
                  Get started by creating your first group to track and split expenses with friends.
                </p>
              </div>
            )}

            {/* Groups Section */}
            <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div class="flex items-center justify-between mb-6">
                <h3 class="text-lg font-semibold text-gray-900">Your Groups</h3>
                <button 
                  class="bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 transition-colors text-sm font-medium hidden lg:block"
                  onClick={() => setIsCreateModalOpen(true)}
                >
                  Create Group
                </button>
              </div>

              {/* Groups Content */}
              <GroupsList 
                onCreateGroup={() => setIsCreateModalOpen(true)}
              />
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
          route(`/groups/${groupId}`);
        }}
      />
    </BaseLayout>
  );
}