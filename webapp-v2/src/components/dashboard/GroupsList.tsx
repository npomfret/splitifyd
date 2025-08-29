import { navigationService } from '@/services/navigation.service';
import { enhancedGroupsStore } from '@/app/stores/groups-store-enhanced.ts';
import { LoadingSpinner } from '../ui';
import { GroupCard } from './GroupCard';
import { EmptyGroupsState } from './EmptyGroupsState';

interface GroupsListProps {
    onCreateGroup: () => void;
    onInvite?: (groupId: string) => void;
    onAddExpense?: (groupId: string) => void;
}

export function GroupsList({ onCreateGroup, onInvite, onAddExpense }: GroupsListProps) {
    if (enhancedGroupsStore.loading && !enhancedGroupsStore.initialized) {
        return (
            <div class="flex items-center justify-center py-8">
                <LoadingSpinner />
                <span class="ml-3 text-gray-600">Loading your groups...</span>
            </div>
        );
    }

    if (enhancedGroupsStore.error) {
        return (
            <div class="text-center py-8">
                <div class="text-red-600 mb-4">
                    <svg class="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                        />
                    </svg>
                    <h4 class="text-lg font-medium text-red-800">Failed to load groups</h4>
                    <p class="text-red-600 mt-1">{enhancedGroupsStore.error}</p>
                </div>
                <button
                    onClick={() => {
                        enhancedGroupsStore.clearError();
                        enhancedGroupsStore.refreshGroups();
                    }}
                    class="bg-red-100 text-red-700 px-4 py-2 rounded-md hover:bg-red-200 transition-colors text-sm font-medium"
                >
                    Try Again
                </button>
            </div>
        );
    }

    if (enhancedGroupsStore.groups.length === 0) {
        return <EmptyGroupsState onCreateGroup={onCreateGroup} />;
    }

    return (
        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {enhancedGroupsStore.isCreatingGroup && (
                <div class="border-2 border-dashed border-gray-300 rounded-lg p-6 flex items-center justify-center">
                    <LoadingSpinner />
                    <span class="ml-3 text-gray-600">Creating group...</span>
                </div>
            )}
            {enhancedGroupsStore.groups.map((group) => (
                <div key={group.id} class="relative">
                    {enhancedGroupsStore.updatingGroupIds.has(group.id) && (
                        <div class="absolute inset-0 bg-white bg-opacity-75 rounded-lg flex items-center justify-center z-10">
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
                    />
                </div>
            ))}
        </div>
    );
}
