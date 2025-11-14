/**
 * Members Preview Component
 *
 * Shows group size in the join group flow
 * (Members are now fetched separately via /groups/:id/members endpoint)
 */

import { useTranslation } from 'react-i18next';

interface MembersPreviewProps {
    memberCount: number;
}

export function MembersPreview({ memberCount }: MembersPreviewProps) {
    const { t } = useTranslation();

    if (memberCount === 0) {
        return null;
    }

    return (
        <div className='bg-surface-muted rounded-lg p-4'>
            <h3 className='text-sm font-medium text-text-primary mb-3'>{t('joinGroupComponents.membersPreview.groupSize')}</h3>

            <div className='text-sm text-text-primary'>
                {memberCount} {memberCount === 1 ? t('common.member') : t('common.members')}
            </div>
        </div>
    );
}
