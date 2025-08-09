import { SidebarCard } from '../ui/SidebarCard';

interface QuickActionsCardProps {
  onCreateGroup: () => void;
}

export function QuickActionsCard({ onCreateGroup }: QuickActionsCardProps) {
  return (
    <SidebarCard title="Quick Actions">
      <div className="space-y-2">
        <button 
          onClick={onCreateGroup}
          className="w-full bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 transition-colors text-sm font-medium"
        >
          Create New Group
        </button>
        <button 
          className="w-full bg-gray-100 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-200 transition-colors text-sm font-medium"
          disabled
        >
          View All Expenses
        </button>
      </div>
    </SidebarCard>
  );
}