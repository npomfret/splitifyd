import { Button, SidebarCard } from '@/components/ui';
import { Stack } from '@/components/ui';
import { ArchiveBoxArrowDownIcon, ArrowLeftStartOnRectangleIcon, ArrowPathIcon, BanknotesIcon, CogIcon, PlayIcon, PlusIcon, UserPlusIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';

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
    isGroupLocked?: boolean; // When true, disables add expense, settle up, and invite actions
    emailNotVerified?: boolean; // When true, disables write actions and shows tooltip
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
    isGroupLocked = false,
    emailNotVerified = false,
}: GroupActionsProps) {
    const { t } = useTranslation();

    // Determine if write actions are disabled and the tooltip to show
    const writeActionsDisabled = isGroupLocked || emailNotVerified;
    const writeActionTooltip = emailNotVerified
        ? t('emailVerification.tooltip.disabled')
        : undefined;

    const commonButtons = (
        <>
            <div title={writeActionTooltip}>
                <Button
                    onClick={onAddExpense}
                    disabled={writeActionsDisabled || !onAddExpense}
                    variant='primary'
                    size='md'
                    fullWidth={variant === 'vertical'}
                    className='flex items-center justify-center'
                >
                    <PlusIcon className='h-4 w-4 mr-2' aria-hidden='true' />
                    {t('groupActions.addExpense')}
                </Button>
            </div>
            <div title={writeActionTooltip}>
                <Button
                    onClick={onSettleUp}
                    disabled={writeActionsDisabled || !onSettleUp}
                    variant='primary'
                    size='md'
                    fullWidth={variant === 'vertical'}
                    className='flex items-center justify-center'
                >
                    <BanknotesIcon className='h-4 w-4 mr-2' aria-hidden='true' />
                    {t('groupActions.settleUp')}
                </Button>
            </div>
            <div title={writeActionTooltip}>
                <Button
                    onClick={onShare}
                    disabled={writeActionsDisabled || !onShare}
                    variant='primary'
                    size='md'
                    fullWidth={variant === 'vertical'}
                    className='flex items-center justify-center'
                >
                    <UserPlusIcon className='h-4 w-4 mr-2' aria-hidden='true' />
                    {t('groupActions.inviteOthers')}
                </Button>
            </div>
        </>
    );

    const settingsButton = showSettingsButton && onSettings
        ? (
            <Button
                onClick={onSettings}
                variant='secondary'
                size='md'
                fullWidth={variant === 'vertical'}
                className='flex items-center justify-center'
            >
                <CogIcon className='h-4 w-4 mr-2' aria-hidden='true' />
                {t('groupActions.settings')}
            </Button>
        )
        : null;

    const archiveButton = onArchive
        ? (
            <Button
                onClick={onArchive}
                disabled={membershipActionDisabled}
                variant='secondary'
                size='md'
                fullWidth={variant === 'vertical'}
                className='flex items-center justify-center'
            >
                <ArchiveBoxArrowDownIcon className='h-4 w-4 mr-2' aria-hidden='true' />
                {t('groupActions.archive')}
            </Button>
        )
        : null;

    const unarchiveButton = onUnarchive
        ? (
            <Button
                onClick={onUnarchive}
                disabled={membershipActionDisabled}
                variant='secondary'
                size='md'
                fullWidth={variant === 'vertical'}
                className='flex items-center justify-center'
            >
                <ArrowPathIcon className='h-4 w-4 mr-2' aria-hidden='true' />
                {t('groupActions.unarchive')}
            </Button>
        )
        : null;

    const leaveGroupButton = onLeaveGroup && canLeaveGroup
        ? (
            <Button
                onClick={onLeaveGroup}
                variant='secondary'
                size='md'
                fullWidth={variant === 'vertical'}
                className='flex items-center justify-center'
            >
                <ArrowLeftStartOnRectangleIcon className='h-4 w-4 mr-2' aria-hidden='true' />
                {t('groupActions.leaveGroup')}
            </Button>
        )
        : null;

    if (variant === 'vertical') {
        return (
            <SidebarCard
                id='group-actions'
                title={
                    <div className='flex items-center gap-2'>
                        <PlayIcon className='h-5 w-5 text-text-muted' aria-hidden='true' />
                        <span>{t('groupActions.title')}</span>
                    </div>
                }
                collapsible
                defaultCollapsed={false}
            >
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
