import { GroupDTO, GroupMember } from '@billsplit-wl/shared';
import { CogIcon, InformationCircleIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import { Button, RelativeTime, SidebarCard, Tooltip } from '../ui';

interface GroupHeaderProps {
    group: GroupDTO;
    members: GroupMember[];
    onSettings?: () => void;
    showSettingsButton?: boolean;
}

export function GroupHeader({ group, members, onSettings, showSettingsButton }: GroupHeaderProps) {
    const { t } = useTranslation();

    const settingsButton = showSettingsButton && onSettings
        ? (
            <Tooltip content={t('groupHeader.groupSettingsAriaLabel')}>
                <Button
                    variant='ghost'
                    size='sm'
                    onClick={onSettings}
                    className='p-2'
                    ariaLabel={t('groupHeader.groupSettingsAriaLabel')}
                    data-testid='group-settings-button'
                >
                    <CogIcon className='h-5 w-5' aria-hidden='true' />
                </Button>
            </Tooltip>
        )
        : undefined;

    return (
        <SidebarCard
            id='group-header'
            title={
                <div className='flex items-center gap-2'>
                    <InformationCircleIcon className='h-5 w-5 text-text-muted' aria-hidden='true' />
                    <span>{group.name}</span>
                </div>
            }
            collapsible
            defaultCollapsed={false}
            headerActions={settingsButton}
        >
            <div className='space-y-3'>
                {group.description && <p className='text-text-primary/80' data-testid='group-description'>{group.description}</p>}
                <div className='text-sm text-text-muted' data-testid='group-stats'>
                    {t('groupHeader.membersCount', { count: members.length })}, <RelativeTime date={group.createdAt} /> {t('groupHeader.old')}, {t('groupHeader.lastUpdated')}{' '}
                    <RelativeTime date={group.updatedAt} />
                </div>
            </div>
        </SidebarCard>
    );
}
