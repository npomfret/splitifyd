/**
 * Members Preview Component
 *
 * Shows group size in the join group flow
 * (Members are now fetched separately via /groups/:id/members endpoint)
 */

import { Group, groupSize } from '@splitifyd/shared';

interface MembersPreviewProps {
    group: Group;
}

export function MembersPreview({ group }: MembersPreviewProps) {
    if (groupSize(group) === 0) {
        return null;
    }

    return (
        <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-900 mb-3">Group Size</h3>

            <div className="text-sm text-gray-700">
                {groupSize(group)} {groupSize(group) === 1 ? 'member' : 'members'}
            </div>
        </div>
    );
}
