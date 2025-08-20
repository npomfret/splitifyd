import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { CogIcon } from '@heroicons/react/24/outline';
import { formatDistanceToNow } from '@/utils/dateUtils.ts';
import {Group, groupSize} from '@shared/shared-types.ts';

interface GroupHeaderProps {
    group: Group;
    onSettings?: () => void;
    isGroupOwner?: boolean;
}

export function GroupHeader({ group, onSettings, isGroupOwner }: GroupHeaderProps) {
    return (
        <Card className="p-6">
            <div className="flex justify-between items-start mb-4">
                <div>
                    <h1 className="text-2xl font-bold mb-2">{group.name}</h1>
                    {group.description && <p className="text-gray-600">{group.description}</p>}
                </div>
                {isGroupOwner && onSettings && (
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={onSettings}
                        className="p-2"
                        ariaLabel="Group Settings"
                    >
                        <CogIcon className="h-5 w-5" />
                    </Button>
                )}
            </div>

            <div className="flex gap-6 text-sm text-gray-600">
                <div>
                    <span className="font-medium">{groupSize(group)}</span> members
                </div>
                <div>
                    <span className="font-medium">Recent</span> expenses
                </div>
                {group.createdAt && <div>Created {formatDistanceToNow(new Date(group.createdAt))}</div>}
            </div>
        </Card>
    );
}
