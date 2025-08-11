import { Card } from '../ui/Card';
import { SidebarCard } from '../ui/SidebarCard';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import type { User } from '../../../../firebase/functions/src/shared/shared-types';

interface MembersListProps {
  members: User[];
  createdBy: string;
  loading?: boolean;
  variant?: 'default' | 'sidebar';
}

export function MembersList({ members, createdBy, loading = false, variant = 'default' }: MembersListProps) {
  const content = loading ? (
    <div className="flex justify-center py-8">
      <LoadingSpinner size="md" />
    </div>
  ) : variant === 'sidebar' ? (
    <div className="space-y-3">
      {members.map((member) => (
        <div key={member.uid} className="flex items-center gap-3">
          <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-medium text-purple-700">
              {(member.displayName || member.email || 'U').charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate">{member.displayName || member.email || 'Unknown User'}</p>
            {member.uid === createdBy && (
              <p className="text-xs text-gray-500">Admin</p>
            )}
          </div>
        </div>
      ))}
    </div>
  ) : (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
      {members.map((member) => (
        <div key={member.uid} className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
            <span className="text-sm font-medium text-primary-700">
              {(member.displayName || member.email || 'U').charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate">{member.displayName || member.email || 'Unknown User'}</p>
            {member.uid === createdBy && (
              <p className="text-xs text-gray-500">Admin</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );

  if (variant === 'sidebar') {
    return (
      <SidebarCard title="Members">
        {content}
      </SidebarCard>
    );
  }

  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold mb-4">Members</h2>
      {content}
    </Card>
  );
}