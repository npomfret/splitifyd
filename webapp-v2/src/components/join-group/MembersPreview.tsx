/**
 * Members Preview Component
 *
 * Shows current group members in the join group flow
 */

import type { Group } from '@shared/types/webapp-shared-types';

interface MembersPreviewProps {
  group: Group;
}

export function MembersPreview({ group }: MembersPreviewProps) {
  const members = group.members || [];
  
  if (members.length === 0) {
    return null;
  }

  return (
    <div className="bg-gray-50 rounded-lg p-4">
      <h3 className="text-sm font-medium text-gray-900 mb-3">
        Current Members
      </h3>
      
      <div className="grid grid-cols-2 gap-2">
        {members.slice(0, 6).map((member, index) => (
          <div key={member.uid || index} className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
              <span className="text-xs font-medium text-primary-700">
                {member.displayName?.charAt(0)?.toUpperCase() || member.email?.charAt(0)?.toUpperCase() || 'U'}
              </span>
            </div>
            <span className="text-sm text-gray-700 truncate">
              {member.displayName || member.email || 'Unknown'}
            </span>
          </div>
        ))}
        
        {members.length > 6 && (
          <div className="flex items-center space-x-2 text-gray-500">
            <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
              <span className="text-xs">+{members.length - 6}</span>
            </div>
            <span className="text-sm">more members</span>
          </div>
        )}
      </div>
    </div>
  );
}