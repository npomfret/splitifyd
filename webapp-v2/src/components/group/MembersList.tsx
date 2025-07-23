import { Card } from '../ui/Card';
import type { User } from '../../types/webapp-shared-types';

interface MembersListProps {
  members: User[];
  createdBy: string;
}

export function MembersList({ members, createdBy }: MembersListProps) {
  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold mb-4">Members</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {members.map((member) => (
          <div key={member.uid} className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
              <span className="text-sm font-medium text-primary-700">
                {member.displayName.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{member.displayName}</p>
              {member.uid === createdBy && (
                <p className="text-xs text-gray-500">Admin</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}