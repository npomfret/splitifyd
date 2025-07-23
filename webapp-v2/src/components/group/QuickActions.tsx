import { Button } from '../ui/Button';

interface QuickActionsProps {
  onAddExpense?: () => void;
  onSettleUp?: () => void;
  onShare?: () => void;
}

export function QuickActions({ onAddExpense, onSettleUp, onShare }: QuickActionsProps) {
  return (
    <div className="flex gap-4">
      <Button 
        variant="primary"
        onClick={onAddExpense}
      >
        Add Expense
      </Button>
      <Button 
        variant="secondary"
        onClick={onSettleUp}
      >
        Settle Up
      </Button>
      <Button 
        variant="ghost"
        onClick={onShare}
      >
        Share Group
      </Button>
    </div>
  );
}