import { useEffect, useState } from 'preact/hooks';
import { route } from 'preact-router';
import { authStore } from '../app/stores/auth-store';
import { groupsStore } from '../app/stores/groups-store';
import { SEOHead } from '../components/SEOHead';
import { Container } from '../components/ui';
import { LoadingSpinner } from '../components/ui';
import { GroupsList } from '../components/dashboard/GroupsList';
import { CreateGroupModal } from '../components/dashboard/CreateGroupModal';
import { V2Indicator } from '../components/ui/V2Indicator';

export function DashboardPage() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (authStore.initialized && !authStore.user) {
      route('/login', true);
      return;
    }
  }, [authStore.initialized, authStore.user]);

  // Fetch groups when component mounts and user is authenticated
  useEffect(() => {
    if (authStore.user && !groupsStore.initialized) {
      groupsStore.fetchGroups();
    }
  }, [authStore.user, groupsStore.initialized]);

  // Show loading spinner while auth is initializing
  if (!authStore.initialized) {
    return (
      <div class="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // Redirect if user is not authenticated (will happen in useEffect)
  if (!authStore.user) {
    return null;
  }

  const user = authStore.user;

  return (
    <div class="min-h-screen bg-gray-50">
      <V2Indicator />
      <SEOHead 
        title="Dashboard - Splitifyd"
        description="Manage your groups and expenses with Splitifyd"
      />

      {/* Header */}
      <header class="bg-white shadow-sm border-b border-gray-200">
        <Container maxWidth="xl">
          <div class="flex items-center justify-between py-4">
            {/* Logo and Title */}
            <div class="flex items-center space-x-4">
              <img src="/images/logo.svg" alt="Splitifyd" class="h-8" />
              <h1 class="text-xl font-semibold text-gray-900">Dashboard</h1>
            </div>

            {/* User Info */}
            <div class="flex items-center space-x-4">
              <div class="flex items-center space-x-2">
                {/* User avatar (initials) */}
                <div class="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                  <span class="text-sm font-medium text-purple-700">
                    {user.displayName 
                      ? user.displayName.charAt(0).toUpperCase()
                      : user.email.charAt(0).toUpperCase()
                    }
                  </span>
                </div>
                
                {/* User name */}
                <div class="hidden sm:block">
                  <p class="text-sm font-medium text-gray-700">
                    {user.displayName || user.email.split('@')[0]}
                  </p>
                  <p class="text-xs text-gray-500">
                    {user.email}
                  </p>
                </div>
              </div>

              {/* Logout Button */}
              <button
                onClick={authStore.logout}
                class="text-sm text-gray-600 hover:text-gray-900 transition-colors px-3 py-1 rounded-md hover:bg-gray-100"
                disabled={authStore.loading}
              >
                {authStore.loading ? 'Signing out...' : 'Sign out'}
              </button>
            </div>
          </div>
        </Container>
      </header>

      {/* Main Content */}
      <main class="py-8">
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
      </main>

      {/* Create Group Modal */}
      <CreateGroupModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={(groupId) => {
          console.log('Successfully created group:', groupId);
          setIsCreateModalOpen(false);
          route(`/groups/${groupId}`);
        }}
      />
    </div>
  );
}