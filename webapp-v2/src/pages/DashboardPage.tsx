import { useEffect, useState } from 'preact/hooks';
import { route } from 'preact-router';
import { useAuthRequired } from '../app/hooks/useAuthRequired';
import { groupsStore } from '../app/stores/groups-store';
import { BaseLayout } from '../components/layout/BaseLayout';
import { Container } from '../components/ui';
import { GroupsList } from '../components/dashboard/GroupsList';
import { CreateGroupModal } from '../components/dashboard/CreateGroupModal';

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

  // Fetch groups when component mounts and user is authenticated
  useEffect(() => {
    if (authStore.user && !groupsStore.initialized) {
      // Intentionally not awaited - useEffect cannot be async (React anti-pattern)
      groupsStore.fetchGroups();
    }
  }, [authStore.user, groupsStore.initialized]);

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
      <div class="py-8">
        <Container maxWidth="xl">
          {/* Welcome Section */}
          <div class="mb-8">
            <h2 class="text-2xl font-bold text-gray-900 mb-2">
              Welcome back, {user.displayName || user.email.split('@')[0]}!
            </h2>
            <p class="text-gray-600">
              Here are your groups and recent activity.
            </p>
          </div>

          {/* Groups Section */}
          <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div class="flex items-center justify-between mb-6">
              <h3 class="text-lg font-semibold text-gray-900">Your Groups</h3>
              <button 
                class="bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 transition-colors text-sm font-medium"
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
        </Container>
      </div>

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