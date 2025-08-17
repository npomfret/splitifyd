import { Button } from '../ui/Button';
import { SidebarCard } from '@/components/ui';
import { Stack } from '@/components/ui';
import { PlusIcon, UserPlusIcon, CreditCardIcon, CogIcon } from '@heroicons/react/24/outline';

interface GroupActionsProps {
    onAddExpense?: () => void;
    onSettleUp?: () => void;
    onShare?: () => void;
    onSettings?: () => void; // New prop for settings button
    isGroupOwner?: boolean; // To conditionally show settings button
    variant?: 'horizontal' | 'vertical';
}

export function GroupActions({ onAddExpense, onSettleUp, onShare, onSettings, isGroupOwner, variant = 'horizontal' }: GroupActionsProps) {
    const commonButtons = (
        <>
            <Button variant="primary" onClick={onAddExpense} className={variant === 'vertical' ? 'w-full' : ''}>
                <>
                    <PlusIcon className="h-4 w-4 mr-2" />
                    Add Expense
                </>
            </Button>
            <Button variant="primary" onClick={onSettleUp} className={variant === 'vertical' ? 'w-full' : ''}>
                <>
                    <CreditCardIcon className="h-4 w-4 mr-2" />
                    Settle Up
                </>
            </Button>
            <Button variant="primary" onClick={onShare} className={variant === 'vertical' ? 'w-full' : ''}>
                <>
                    <UserPlusIcon className="h-4 w-4 mr-2" />
                    Invite Others
                </>
            </Button>
        </>
    );

    const settingsButton = isGroupOwner && onSettings ? (
        <Button variant="ghost" onClick={onSettings} className={variant === 'vertical' ? 'w-full' : ''}>
            <>
                <CogIcon className="h-4 w-4 mr-2" />
                Group Settings
            </>
        </Button>
    ) : null;

    if (variant === 'vertical') {
        return (
            <SidebarCard title="Group Actions">
                <Stack spacing="sm">
                    {commonButtons}
                    {settingsButton}
                </Stack>
            </SidebarCard>
        );
    }

    return (
        <div className="flex gap-4">
            {commonButtons}
            {settingsButton}
        </div>
    );
}