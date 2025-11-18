import { GroupDTO, GroupMember } from '@billsplit-wl/shared';
import { CogIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import { Button, Card, RelativeTime, Tooltip } from '../ui';

interface GroupHeaderProps {
    group: GroupDTO;
    members: GroupMember[];
    expenseCount?: number;
    onSettings?: () => void;
    showSettingsButton?: boolean;
}

export function GroupHeader({ group, members, expenseCount = 0, onSettings, showSettingsButton }: GroupHeaderProps) {
    const { t } = useTranslation();
    return (
        <Card variant='glass' className='p-6 border-border-default'>
            <div className='flex justify-between items-start mb-4'>
                <div>
                    <h1 className='text-2xl font-bold mb-2'>{group.name}</h1>
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

            <div className='flex gap-6 text-sm text-text-muted'>
                <div data-testid='member-count'>{t('groupHeader.membersCount', { count: members.length })}</div>
                <div data-testid='expense-count'>
                    {expenseCount} <span className='font-medium'>{t('groupHeader.recent')}</span> {t('groupHeader.expenses')}
                </div>
                {group.createdAt && (
                    <div>
                        {t('groupHeader.createdPrefix')} <RelativeTime date={group.createdAt} />
                    </div>
                )}
            </div>
        </Card>
    );
}
