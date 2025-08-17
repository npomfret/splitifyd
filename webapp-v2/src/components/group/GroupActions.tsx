import { Button } from '../ui/Button';
import { SidebarCard } from '@/components/ui';
import { Stack } from '@/components/ui';

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
                Add Expense
            </Button>
            <Button variant="secondary" onClick={onSettleUp} className={variant === 'vertical' ? 'w-full' : ''}>
                Settle Up
            </Button>
            <Button variant="ghost" onClick={onShare} className={variant === 'vertical' ? 'w-full' : ''}>
                Share Group
            </Button>
        </>
    );

    const settingsButton = isGroupOwner && onSettings ? (
        <Button variant="ghost" onClick={onSettings} className={variant === 'vertical' ? 'w-full' : ''}>
            Group Settings
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