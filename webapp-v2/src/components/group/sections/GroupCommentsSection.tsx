import { CommentsSection } from '@/components/comments';
import { SidebarCard } from '@/components/ui/SidebarCard';
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
            title={
                <div className='flex items-center gap-2'>
                    <ChatBubbleLeftIcon className='h-5 w-5 text-text-muted' aria-hidden='true' />
                    <span>{sectionLabel}</span>
                </div>
            }
            collapsible
            defaultCollapsed={defaultCollapsed}
            collapseToggleLabel={t('pages.groupDetailPage.toggleSection', { section: sectionLabel })}
        >
            <CommentsSection target={{ type: 'group', groupId }} maxHeight='300px' initialData={initialData} />
        </SidebarCard>
    );
}
