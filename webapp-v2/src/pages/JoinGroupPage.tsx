/**
 * Join Group Page
 * 
 * Handles joining a group via share link invitation
 */

import { useEffect } from 'preact/hooks';
import { route } from 'preact-router';
import { joinGroupStore } from '../app/stores/join-group-store';
import { useAuth } from '../app/hooks/useAuth';
import { Card } from '../components/ui/Card';
import { Stack } from '../components/ui/Stack';
import { Button } from '../components/ui/Button';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { GroupPreview } from '../components/join-group/GroupPreview';
import { MembersPreview } from '../components/join-group/MembersPreview';
import { JoinButton } from '../components/join-group/JoinButton';

interface JoinGroupPageProps {
  linkId?: string;
  matches?: any; // For route parameters
}

export function JoinGroupPage({ linkId }: JoinGroupPageProps) {
  const authStore = useAuth();
  const isAuthenticated = !!authStore.user;
  const {
    group,
    loadingPreview,
    joining,
    joinSuccess,
    error
  } = joinGroupStore;

  // Get linkId from URL query parameters if not provided as prop
  const urlParams = new URLSearchParams(window.location.search);
  const actualLinkId = linkId || urlParams.get('linkId');
  

  useEffect(() => {
    // Reset store on component mount
    joinGroupStore.reset();

    if (!actualLinkId) {
      // No link ID provided - redirect to dashboard
      route('/dashboard');
      return;
    }

    if (!isAuthenticated) {
      // Not authenticated - redirect to login with return URL after a short delay
      // to allow authentication state to settle
      setTimeout(() => {
        if (!authStore.user) {
          const returnUrl = encodeURIComponent(`/join?linkId=${actualLinkId}`);
          route(`/login?returnUrl=${returnUrl}`);
        }
      }, 100);
      return;
    }

    // Load group preview - intentionally not awaited (useEffect cannot be async)
    joinGroupStore.loadGroupPreview(actualLinkId);
  }, [actualLinkId, isAuthenticated]);

  // Auto-redirect on successful join
  useEffect(() => {
    if (joinSuccess && group) {
      // Navigate to the group detail page
      setTimeout(() => {
        route(`/groups/${group.id}`);
      }, 500); // Small delay to show success message
    }
  }, [joinSuccess, group]);

  const handleJoinGroup = async () => {
    if (!actualLinkId) return;
    
    const joinedGroup = await joinGroupStore.joinGroup(actualLinkId);
    if (joinedGroup) {
      // Success handled by useEffect above
    }
  };

  // Show loading state while checking authentication or loading preview
  if (!isAuthenticated || loadingPreview) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <div className="text-center py-8">
            <LoadingSpinner size="lg" />
            <p className="text-gray-600 mt-4">
              {!isAuthenticated ? 'Checking authentication...' : 'Loading group information...'}
            </p>
          </div>
        </Card>
      </div>
    );
  }

  // Show error state
  if (error && !group) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <div className="text-center py-8">
            <div className="text-red-500 text-4xl mb-4">⚠️</div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Unable to Join Group
            </h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <Button 
              variant="secondary" 
              onClick={() => route('/dashboard')}
              className="w-full"
            >
              Back to Dashboard
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // Show success state
  if (joinSuccess && group) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <div className="text-center py-8">
            <div className="text-green-500 text-4xl mb-4">✅</div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Welcome to {group.name}!
            </h2>
            <p className="text-gray-600 mb-6">
              You've successfully joined the group. Redirecting to group page...
            </p>
            <LoadingSpinner size="sm" />
          </div>
        </Card>
      </div>
    );
  }

  // Show group preview and join option
  if (group) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Join Group
            </h1>
          </div>

          <Stack spacing="lg">
            {/* Group Preview */}
            <GroupPreview group={group} />

            {/* Members Preview */}
            <MembersPreview group={group} />

            {/* Error message if any */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-red-700 text-sm">{error}</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={joinGroupStore.clearError}
                  className="mt-2 text-red-600 hover:text-red-700"
                >
                  Dismiss
                </Button>
              </div>
            )}

            {/* Action Buttons */}
            <Stack spacing="md">
              <JoinButton
                onJoin={handleJoinGroup}
                loading={joining}
              />
              
              <Button
                variant="secondary"
                onClick={() => route('/dashboard')}
                fullWidth
              >
                Cancel
              </Button>
            </Stack>
          </Stack>
        </div>
      </div>
    );
  }

  // Fallback - shouldn't reach here
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <div className="text-center py-8">
          <p className="text-gray-600">Loading...</p>
        </div>
      </Card>
    </div>
  );
}