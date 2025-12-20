import { SectionTitle, SidebarCard } from '@/components/ui';
import type { GroupId, UserId } from '@billsplit-wl/shared';
import { BoltIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import { GroupActivityFeed } from '../GroupActivityFeed';

interface ActivitySectionProps {
    groupId: GroupId;
    currentUserId: UserId;
    defaultCollapsed?: boolean;
    idSuffix?: string;
}

export function ActivitySection({ groupId, currentUserId, defaultCollapsed = true, idSuffix }: ActivitySectionProps) {
    const { t } = useTranslation();
    const sectionLabel = t('pages.groupDetailPage.activity');

    return (
        <SidebarCard
            id={idSuffix ? `activity-${idSuffix}` : 'activity'}
            ariaLabel={sectionLabel}
            title={<SectionTitle icon={BoltIcon} label={sectionLabel} />}
            collapsible
            defaultCollapsed={defaultCollapsed}
            collapseToggleLabel={t('pages.groupDetailPage.toggleSection', { section: sectionLabel })}
        >
            <GroupActivityFeed groupId={groupId} currentUserId={currentUserId} />
        </SidebarCard>
    );
}
