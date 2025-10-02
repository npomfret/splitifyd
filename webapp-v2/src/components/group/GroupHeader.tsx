import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { CogIcon } from '@heroicons/react/24/outline';
import { formatDistanceToNow } from '@/utils/dateUtils.ts';
import { GroupDTO, GroupMember } from '@splitifyd/shared';
import { useTranslation } from 'react-i18next';

interface GroupHeaderProps {
    group: GroupDTO;
    members: GroupMember[];
    expenseCount?: number;
    onSettings?: () => void;
    isGroupOwner?: boolean;
}

export function GroupHeader({ group, members, expenseCount = 0, onSettings, isGroupOwner }: GroupHeaderProps) {
    const { t } = useTranslation();
    return (
        <Card className="p-6">
            <div className="flex justify-between items-start mb-4">
                <div>
                    <h1 className="text-2xl font-bold mb-2">{group.name}</h1>
                    {group.description && <p className="text-gray-600">{group.description}</p>}
                </div>
                {isGroupOwner && onSettings && (
                    <Button variant="ghost" size="sm" onClick={onSettings} className="p-2" ariaLabel={t('groupHeader.groupSettingsAriaLabel')} data-testid="group-settings-button">
                        <CogIcon className="h-5 w-5" />
                    </Button>
                )}
            </div>

            <div className="flex gap-6 text-sm text-gray-600">
                <div data-testid="member-count">{t('groupHeader.membersCount', { count: members.length })}</div>
                <div data-testid="expense-count">
                    {expenseCount} <span className="font-medium">{t('groupHeader.recent')}</span> {t('groupHeader.expenses')}
                </div>
                {group.createdAt && (
                    <div>
                        {t('groupHeader.createdPrefix')} {formatDistanceToNow(new Date(group.createdAt))}
                    </div>
                )}
            </div>
        </Card>
    );
}
