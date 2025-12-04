import { GroupDTO, GroupMember } from '@billsplit-wl/shared';
import { CogIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import { Button, Card, RelativeTime, Tooltip, Typography } from '../ui';

interface GroupHeaderProps {
    group: GroupDTO;
    members: GroupMember[];
    onSettings?: () => void;
    showSettingsButton?: boolean;
}

export function GroupHeader({ group, members, onSettings, showSettingsButton }: GroupHeaderProps) {
    const { t } = useTranslation();
    return (
        <Card variant='glass' className='p-6 border-border-default'>
            <div className='flex justify-between items-start mb-4'>
                <div>
                    <Typography variant="pageTitle" className="mb-2">{group.name}</Typography>
                    {group.description && <p className='text-text-primary/80' data-testid='group-description'>{group.description}</p>}
                </div>
                <div className='flex gap-2'>
                    {showSettingsButton && onSettings && (
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
                    )}
                </div>
            </div>

            <div className='text-sm text-text-muted' data-testid='group-stats'>
                {t('groupHeader.membersCount', { count: members.length })},{' '}
                <RelativeTime date={group.createdAt} /> {t('groupHeader.old')},{' '}
                {t('groupHeader.lastUpdated')} <RelativeTime date={group.updatedAt} />
            </div>
        </Card>
    );
}
