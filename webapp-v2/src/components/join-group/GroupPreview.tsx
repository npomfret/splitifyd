/**
 * GroupDTO Preview Component
 *
 * Shows group information in the join group flow
 */

import { GroupDTO } from '@splitifyd/shared';
import { useTranslation } from 'react-i18next';
import { Card } from '../ui/Card';
import { Stack } from '../ui/Stack';

interface GroupPreviewProps {
    group: GroupDTO;
    memberCount: number;
}

export function GroupPreview({ group, memberCount }: GroupPreviewProps) {
    const { t } = useTranslation();
    return (
        <Card className='w-full'>
            <div className='p-6'>
                <Stack spacing='lg'>
                    {/* GroupDTO Header */}
                    <div className='text-center'>
                        <h2 className='text-xl font-semibold text-gray-900 mb-2'>{group.name}</h2>
                        {group.description && <p className='text-gray-600 text-sm'>{group.description}</p>}
                    </div>

                    {/* GroupDTO Stats */}
                    <div className='bg-gray-50 rounded-lg p-4'>
                        <div className='grid grid-cols-2 gap-4 text-center'>
                            <div>
                                <div className='text-2xl font-semibold text-interactive-primary'>{memberCount}</div>
                                <div className='text-sm text-gray-600'>{memberCount === 1 ? t('common.member') : t('common.members')}</div>
                            </div>
                            <div>
                                <div className='text-2xl font-semibold text-interactive-primary'>{t('common.active')}</div>
                                <div className='text-sm text-gray-600'>{t('common.group')}</div>
                            </div>
                        </div>
                    </div>

                    {/* Join Invitation Message */}
                    <div className='text-center p-4 bg-blue-50 rounded-lg'>
                        <p className='text-blue-800 text-sm'>{t('joinGroupComponents.groupPreview.invitationMessage')}</p>
                    </div>
                </Stack>
            </div>
        </Card>
    );
}
