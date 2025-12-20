import { CommentsSection } from '@/components/comments';
import { SectionTitle, SidebarCard } from '@/components/ui';
import type { GroupId, ListCommentsResponse } from '@billsplit-wl/shared';
import { ChatBubbleLeftIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';

interface GroupCommentsSectionProps {
    groupId: GroupId;
    initialData?: ListCommentsResponse | null;
    defaultCollapsed?: boolean;
    idSuffix?: string;
}

export function GroupCommentsSection({ groupId, initialData, defaultCollapsed = true, idSuffix }: GroupCommentsSectionProps) {
    const { t } = useTranslation();
    const sectionLabel = t('pages.groupDetailPage.comments');

    return (
        <SidebarCard
            id={idSuffix ? `comments-${idSuffix}` : 'comments'}
            ariaLabel={sectionLabel}
            title={<SectionTitle icon={ChatBubbleLeftIcon} label={sectionLabel} />}
            collapsible
            defaultCollapsed={defaultCollapsed}
            collapseToggleLabel={t('pages.groupDetailPage.toggleSection', { section: sectionLabel })}
        >
            <CommentsSection target={{ type: 'group', groupId }} maxHeight='300px' initialData={initialData} />
        </SidebarCard>
    );
}
