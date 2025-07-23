import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { formatDistanceToNow } from '../../utils/dateUtils';
import type { GroupDetail } from '../../types/webapp-shared-types';

interface GroupHeaderProps {
  group: GroupDetail;
  onSettingsClick?: () => void;
}

export function GroupHeader({ group, onSettingsClick }: GroupHeaderProps) {
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
        <div>
          <span className="font-medium">{group.members.length}</span> members
        </div>
        <div>
          <span className="font-medium">{group.expenseCount || 0}</span> expenses
        </div>
        <div>
          Created {formatDistanceToNow(new Date(group.createdAt))}
        </div>
      </div>
    </Card>
  );
}