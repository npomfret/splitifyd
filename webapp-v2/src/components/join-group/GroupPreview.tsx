/**
 * Group Preview Component
 *
 * Shows group information in the join group flow
 */

import { Card } from '../ui/Card';
import { Stack } from '../ui/Stack';
import {Group, groupSize} from '@shared/shared-types.ts';

interface GroupPreviewProps {
    group: Group;
}

export function GroupPreview({ group }: GroupPreviewProps) {
    return (
        <Card className="w-full">
            <div className="p-6">
                <Stack spacing="lg">
                    {/* Group Header */}
                    <div className="text-center">
                        <h2 className="text-xl font-semibold text-gray-900 mb-2">{group.name}</h2>
                        {group.description && <p className="text-gray-600 text-sm">{group.description}</p>}
                    </div>

                    {/* Group Stats */}
                    <div className="bg-gray-50 rounded-lg p-4">
                        <div className="grid grid-cols-2 gap-4 text-center">
                            <div>
                                <div className="text-2xl font-semibold text-primary-600">{groupSize(group)}</div>
                                <div className="text-sm text-gray-600">{(groupSize(group)) === 1 ? 'Member' : 'Members'}</div>
                            </div>
                            <div>
                                <div className="text-2xl font-semibold text-primary-600">Active</div>
                                <div className="text-sm text-gray-600">Group</div>
                            </div>
                        </div>
                    </div>

                    {/* Join Invitation Message */}
                    <div className="text-center p-4 bg-blue-50 rounded-lg">
                        <p className="text-blue-800 text-sm">You've been invited to join this group</p>
                    </div>
                </Stack>
            </div>
        </Card>
    );
}
