import { useTranslation } from 'react-i18next';
import { Button } from '../ui/Button';
import { SidebarCard } from '@/components/ui';
import { Stack } from '@/components/ui';
import { PlusIcon, UserPlusIcon, CreditCardIcon, CogIcon, ArrowLeftStartOnRectangleIcon } from '@heroicons/react/24/outline';

interface GroupActionsProps {
    onAddExpense?: () => void;
    onSettleUp?: () => void;
    onShare?: () => void;
    onSettings?: () => void; // New prop for settings button
    onLeaveGroup?: () => void; // New prop for leave group button
    isGroupOwner?: boolean; // To conditionally show settings button
    canLeaveGroup?: boolean; // Whether leave group button should be enabled
    variant?: 'horizontal' | 'vertical';
}

export function GroupActions({ onAddExpense, onSettleUp, onShare, onSettings, onLeaveGroup, isGroupOwner, canLeaveGroup, variant = 'horizontal' }: GroupActionsProps) {
    const { t } = useTranslation();
    const commonButtons = (
        <>
            <Button variant="primary" onClick={onAddExpense} className={variant === 'vertical' ? 'w-full' : ''} data-testid="add-expense-button">
                <>
                    <PlusIcon className="h-4 w-4 mr-2" />
                    {t('groupActions.addExpense')}
                </>
            </Button>
            <Button variant="primary" onClick={onSettleUp} className={variant === 'vertical' ? 'w-full' : ''} data-testid="settle-up-button">
                <>
                    <CreditCardIcon className="h-4 w-4 mr-2" />
                    {t('groupActions.settleUp')}
                </>
            </Button>
            <Button variant="primary" onClick={onShare} className={variant === 'vertical' ? 'w-full' : ''} data-testid="invite-others-button">
                <>
                    <UserPlusIcon className="h-4 w-4 mr-2" />
                    {t('groupActions.inviteOthers')}
                </>
            </Button>
        </>
    );

    const settingsButton =
        isGroupOwner && onSettings ? (
            <Button variant="primary" onClick={onSettings} className={variant === 'vertical' ? 'w-full' : ''} data-testid="group-settings-button">
                <>
                    <CogIcon className="h-4 w-4 mr-2" />
                    {t('groupActions.groupSettings')}
                </>
            </Button>
        ) : null;

    const leaveGroupButton =
        onLeaveGroup && canLeaveGroup ? (
            <Button variant="secondary" onClick={onLeaveGroup} className={variant === 'vertical' ? 'w-full' : ''} data-testid="leave-group-button">
                <>
                    <ArrowLeftStartOnRectangleIcon className="h-4 w-4 mr-2" />
                    {t('groupActions.leaveGroup')}
                </>
            </Button>
        ) : null;

    if (variant === 'vertical') {
        return (
            <SidebarCard title={t('groupActions.title')}>
                <Stack spacing="sm">
                    {commonButtons}
                    {settingsButton}
                    {leaveGroupButton}
                </Stack>
            </SidebarCard>
        );
    }

    return (
        <div className="flex gap-4">
            {commonButtons}
            {settingsButton}
            {leaveGroupButton}
        </div>
    );
}
