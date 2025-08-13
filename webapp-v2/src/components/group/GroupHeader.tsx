import { useEffect } from 'preact/hooks';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { formatDistanceToNow } from '../../utils/dateUtils';
import type { Group } from '../../../../firebase/functions/src/shared/shared-types';
import { logInfo } from '../../utils/browser-logger';

interface GroupHeaderProps {
  group: Group;
  onSettingsClick?: () => void;
}

export function GroupHeader({ group, onSettingsClick }: GroupHeaderProps) {
  // Add timing for member count changes
  useEffect(() => {
    const componentRenderTime = Date.now();
    logInfo('GroupHeader memberIds.length changed', { 
      memberCount: group.memberIds?.length || 0,
      timestamp: componentRenderTime,
      groupId: group.id || 'unknown'
    });
  }, [group.memberIds?.length, group.id]);

  return (
    <Card className="p-6">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h1 className="text-2xl font-bold mb-2">{group.name}</h1>
          {group.description && (
            <p className="text-gray-600">{group.description}</p>
          )}
        </div>
        <Button 
          variant="secondary"
          size="sm"
          onClick={onSettingsClick}
        >
          Settings
        </Button>
      </div>
      
      <div className="flex gap-6 text-sm text-gray-600">
        <div data-testid="member-count">
          <span className="font-medium">{group.memberIds.length}</span> members
        </div>
        <div>
          <span className="font-medium">Recent</span> expenses
        </div>
        {group.createdAt && (
          <div>
            Created {formatDistanceToNow(new Date(group.createdAt))}
          </div>
        )}
      </div>
    </Card>
  );
}