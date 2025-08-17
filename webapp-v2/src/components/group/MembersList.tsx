import { Card } from '../ui/Card';
import { SidebarCard } from '../ui/SidebarCard';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { UserPlusIcon } from '@heroicons/react/24/outline';
import type { User } from '../../../../firebase/functions/src/shared/shared-types';

interface MembersListProps {
    members: User[];
    createdBy: string;
    loading?: boolean;
    variant?: 'default' | 'sidebar';
    onInviteClick?: () => void;
}

export function MembersList({ members, createdBy, loading = false, variant = 'default', onInviteClick }: MembersListProps) {
    const content = loading ? (
        <div className="flex justify-center py-8">
            <LoadingSpinner size="md" />
        </div>
    ) : variant === 'sidebar' ? (
        <div className="space-y-3">
            {members.map((member) => (
                <div key={member.uid} className="flex items-center gap-3">
                    <Avatar displayName={member.displayName || member.email || 'Unknown User'} userId={member.uid} size="sm" themeColor={member.themeColor} />
                    <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{member.displayName || member.email || 'Unknown User'}</p>
                        {member.uid === createdBy && <p className="text-xs text-gray-500">Admin</p>}
                    </div>
                </div>
            ))}
        </div>
    ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {members.map((member) => (
                <div key={member.uid} className="flex items-center gap-3">
                    <Avatar displayName={member.displayName || member.email || 'Unknown User'} userId={member.uid} size="md" themeColor={member.themeColor} />
                    <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{member.displayName || member.email || 'Unknown User'}</p>
                        {member.uid === createdBy && <p className="text-xs text-gray-500">Admin</p>}
                    </div>
                </div>
            ))}
        </div>
    );

    if (variant === 'sidebar') {
        return (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-base font-semibold text-gray-900">Members</h3>
                    {onInviteClick && (
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={onInviteClick}
                            className="p-1 h-auto"
                            ariaLabel="Invite Others"
                        >
                            <UserPlusIcon className="h-4 w-4" />
                        </Button>
                    )}
                </div>
                {content}
            </div>
        );
    }

    return (
        <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Members</h2>
                {onInviteClick && (
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={onInviteClick}
                        className="p-2"
                        ariaLabel="Invite Others"
                    >
                        <UserPlusIcon className="h-5 w-5" />
                    </Button>
                )}
            </div>
            {content}
        </Card>
    );
}
