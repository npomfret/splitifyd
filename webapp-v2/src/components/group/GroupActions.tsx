import { SidebarCard } from '@/components/ui';
import { Stack } from '@/components/ui';
import { ArchiveBoxArrowDownIcon, ArrowLeftStartOnRectangleIcon, ArrowPathIcon, BanknotesIcon, CogIcon, PlusIcon, UserPlusIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/Button';

interface GroupActionsProps {
    onAddExpense?: () => void;
    onSettleUp?: () => void;
    onShare?: () => void;
    onSettings?: () => void;
    onLeaveGroup?: () => void; // New prop for leave group button
    showSettingsButton?: boolean; // To conditionally show settings button
    canLeaveGroup?: boolean; // Whether leave group button should be enabled
    variant?: 'horizontal' | 'vertical';
    onArchive?: () => void;
    onUnarchive?: () => void;
    isArchived?: boolean;
    membershipActionDisabled?: boolean;
}

export function GroupActions({
    onAddExpense,
    onSettleUp,
    onShare,
    onSettings,
    onLeaveGroup,
    showSettingsButton,
    canLeaveGroup,
    variant = 'horizontal',
    onArchive,
    onUnarchive,
    isArchived,
    membershipActionDisabled,
}: GroupActionsProps) {
    const { t } = useTranslation();
    const commonButtons = (
        <>
            <button onClick={onAddExpense} className={`bg-[image:var(--gradient-primary)] text-interactive-primary-foreground px-4 py-2.5 rounded-md shadow-md transition-all duration-200 text-sm font-semibold hover:shadow-lg hover:scale-[1.02] flex items-center justify-center ${variant === 'vertical' ? 'w-full' : ''}`} data-testid='add-expense-button'>
                <PlusIcon className='h-4 w-4 mr-2' aria-hidden='true' />
                {t('groupActions.addExpense')}
            </button>
            <button onClick={onSettleUp} className={`bg-[image:var(--gradient-primary)] text-interactive-primary-foreground px-4 py-2.5 rounded-md shadow-md transition-all duration-200 text-sm font-semibold hover:shadow-lg hover:scale-[1.02] flex items-center justify-center ${variant === 'vertical' ? 'w-full' : ''}`} data-testid='settle-up-button'>
                <BanknotesIcon className='h-4 w-4 mr-2' aria-hidden='true' />
                {t('groupActions.settleUp')}
            </button>
            <button onClick={onShare} className={`bg-[image:var(--gradient-primary)] text-interactive-primary-foreground px-4 py-2.5 rounded-md shadow-md transition-all duration-200 text-sm font-semibold hover:shadow-lg hover:scale-[1.02] flex items-center justify-center ${variant === 'vertical' ? 'w-full' : ''}`} data-testid='invite-others-button'>
                <UserPlusIcon className='h-4 w-4 mr-2' aria-hidden='true' />
                {t('groupActions.inviteOthers')}
            </button>
        </>
    );

    const settingsButton = showSettingsButton && onSettings
        ? (
            <button onClick={onSettings} className={`bg-surface-base border border-border-default text-text-primary px-4 py-2.5 rounded-md transition-all duration-200 text-sm font-medium hover:bg-surface-muted hover:border-interactive-primary/40 flex items-center justify-center ${variant === 'vertical' ? 'w-full' : ''}`} data-testid='group-settings-button'>
                <CogIcon className='h-4 w-4 mr-2' aria-hidden='true' />
                {t('groupActions.settings')}
            </button>
        )
        : null;

    const archiveButton = onArchive
        ? (
            <button
                onClick={onArchive}
                disabled={membershipActionDisabled}
                className={`bg-surface-base border border-border-default text-text-primary px-4 py-2.5 rounded-md transition-all duration-200 text-sm font-medium hover:bg-surface-muted hover:border-interactive-primary/40 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed ${variant === 'vertical' ? 'w-full' : ''}`}
                data-testid='archive-group-button'
            >
                <ArchiveBoxArrowDownIcon className='h-4 w-4 mr-2' aria-hidden='true' />
                {t('groupActions.archive')}
            </button>
        )
        : null;

    const unarchiveButton = onUnarchive
        ? (
            <button
                onClick={onUnarchive}
                disabled={membershipActionDisabled}
                className={`bg-surface-base border border-border-default text-text-primary px-4 py-2.5 rounded-md transition-all duration-200 text-sm font-medium hover:bg-surface-muted hover:border-interactive-primary/40 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed ${variant === 'vertical' ? 'w-full' : ''}`}
                data-testid='unarchive-group-button'
            >
                <ArrowPathIcon className='h-4 w-4 mr-2' aria-hidden='true' />
                {t('groupActions.unarchive')}
            </button>
        )
        : null;

    const leaveGroupButton = onLeaveGroup && canLeaveGroup
        ? (
            <button onClick={onLeaveGroup} className={`bg-surface-base border border-border-default text-text-primary px-4 py-2.5 rounded-md transition-all duration-200 text-sm font-medium hover:bg-surface-muted hover:border-interactive-primary/40 flex items-center justify-center ${variant === 'vertical' ? 'w-full' : ''}`} data-testid='leave-group-button'>
                <ArrowLeftStartOnRectangleIcon className='h-4 w-4 mr-2' aria-hidden='true' />
                {t('groupActions.leaveGroup')}
            </button>
        )
        : null;

    if (variant === 'vertical') {
        return (
            <SidebarCard title={t('groupActions.title')}>
                <Stack spacing='sm'>
                    {commonButtons}
                    {settingsButton}
                    {isArchived ? unarchiveButton : archiveButton}
                    {leaveGroupButton}
                </Stack>
            </SidebarCard>
        );
    }

    return (
        <div className='flex gap-4'>
            {commonButtons}
            {settingsButton}
            {isArchived ? unarchiveButton : archiveButton}
            {leaveGroupButton}
        </div>
    );
}
