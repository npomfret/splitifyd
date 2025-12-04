/**
 * GroupDTO Preview Component
 *
 * Shows group information in the join group flow
 */

import { GroupDTO } from '@billsplit-wl/shared';
import { useTranslation } from 'react-i18next';
import { Card } from '../ui/Card';
import { Stack } from '../ui/Stack';
import { Typography } from '../ui/Typography';

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
                        <Typography variant="heading" className="mb-2">{group.name}</Typography>
                        {group.description && <p className='text-text-muted text-sm'>{group.description}</p>}
                    </div>

                    {/* GroupDTO Stats */}
                    <div className='bg-surface-muted rounded-lg p-4'>
                        <div className='grid grid-cols-2 gap-4 text-center'>
                            <div>
                                <div className='text-2xl font-semibold text-interactive-primary'>{memberCount}</div>
                                <div className='text-sm text-text-muted'>{memberCount === 1 ? t('common.member') : t('common.members')}</div>
                            </div>
                            <div>
                                <div className='text-2xl font-semibold text-interactive-primary'>{t('common.active')}</div>
                                <div className='text-sm text-text-muted'>{t('common.group')}</div>
                            </div>
                        </div>
                    </div>

                    {/* Join Invitation Message */}
                    <div className='text-center p-4 bg-interactive-primary/10 rounded-lg'>
                        <p className='text-interactive-primary text-sm'>{t('joinGroupComponents.groupPreview.invitationMessage')}</p>
                    </div>
                </Stack>
            </div>
        </Card>
    );
}
