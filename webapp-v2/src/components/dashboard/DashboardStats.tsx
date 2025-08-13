import { useComputed } from '@preact/signals';
import { groupsStore } from '../../app/stores/groups-store';
import { SidebarCard } from '../ui/SidebarCard';

export function DashboardStats() {
  const groups = useComputed(() => groupsStore.groups);
  const loading = useComputed(() => groupsStore.loading);
  
  const stats = useComputed(() => {
    const groupsList = groups.value;
    const activeGroups = groupsList.length; // All groups are considered active
    const totalMembers = groupsList.reduce((sum, g) => sum + (g.memberIds?.length || 0), 0);
    
    return {
      totalGroups: groupsList.length,
      activeGroups,
      totalMembers,
      averageMembers: groupsList.length > 0 ? Math.round(totalMembers / groupsList.length) : 0
    };
  });

  if (loading.value) {
    return (
      <SidebarCard title="Statistics">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          <div className="h-4 bg-gray-200 rounded w-2/3"></div>
        </div>
      </SidebarCard>
    );
  }

  return (
    <SidebarCard title="Statistics">
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">Total Groups</span>
          <span className="text-lg font-semibold text-gray-900">{stats.value.totalGroups}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">Active Groups</span>
          <span className="text-lg font-semibold text-green-600">{stats.value.activeGroups}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">Total Members</span>
          <span className="text-lg font-semibold text-gray-900">{stats.value.totalMembers}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">Avg. Members/Group</span>
          <span className="text-lg font-semibold text-gray-900">{stats.value.averageMembers}</span>
        </div>
      </div>
    </SidebarCard>
  );
}