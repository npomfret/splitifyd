import { Button } from '../ui/Button';
import { SidebarCard } from '../ui/SidebarCard';

interface QuickActionsProps {
  onAddExpense?: () => void;
  onSettleUp?: () => void;
  onShare?: () => void;
  variant?: 'horizontal' | 'vertical';
}

export function QuickActions({ onAddExpense, onSettleUp, onShare, variant = 'horizontal' }: QuickActionsProps) {
  const buttons = (
    <>
      <Button 
        variant="primary"
        onClick={onAddExpense}
        className={variant === 'vertical' ? 'w-full' : ''}
      >
        Add Expense
      </Button>
      <Button 
        variant="secondary"
        onClick={onSettleUp}
        className={variant === 'vertical' ? 'w-full' : ''}
      >
        Settle Up
      </Button>
      <Button 
        variant="ghost"
        onClick={onShare}
        className={variant === 'vertical' ? 'w-full' : ''}
      >
        Share Group
      </Button>
    </>
  );

  if (variant === 'vertical') {
    return (
      <SidebarCard title="Quick Actions">
        <div className="space-y-2">
          {buttons}
        </div>
      </SidebarCard>
    );
  }

  return (
    <div className="flex gap-4">
      {buttons}
    </div>
  );
}