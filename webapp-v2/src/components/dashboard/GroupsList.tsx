import { groupsStore } from '../../app/stores/groups-store';
import { LoadingSpinner } from '../ui';
import { GroupCard } from './GroupCard';
import { EmptyGroupsState } from './EmptyGroupsState';

interface GroupsListProps {
  onCreateGroup: () => void;
}

export function GroupsList({ onCreateGroup }: GroupsListProps) {
  if (groupsStore.loading && !groupsStore.initialized) {
    return (
      <div class="flex items-center justify-center py-8">
        <LoadingSpinner />
        <span class="ml-3 text-gray-600">Loading your groups...</span>
      </div>
    );
  }

  if (groupsStore.error) {
    return (
      <div class="text-center py-8">
        <div class="text-red-600 mb-4">
          <svg class="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <h4 class="text-lg font-medium text-red-800">Failed to load groups</h4>
          <p class="text-red-600 mt-1">{groupsStore.error}</p>
        </div>
        <button
          onClick={() => {
            groupsStore.clearError();
            groupsStore.refreshGroups();
          }}
          class="bg-red-100 text-red-700 px-4 py-2 rounded-md hover:bg-red-200 transition-colors text-sm font-medium"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (groupsStore.groups.length === 0) {
    return <EmptyGroupsState onCreateGroup={onCreateGroup} />;
  }

  return (
    <div class="space-y-4">
      {groupsStore.groups.map(group => (
        <GroupCard 
          key={group.id} 
          group={group}
          onClick={() => {
            // TODO: Navigate to group detail page
            console.log('Navigate to group:', group.id);
          }}
        />
      ))}
    </div>
  );
}