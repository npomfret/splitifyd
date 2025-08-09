import { Card } from '../ui/Card';
import { SidebarCard } from '../ui/SidebarCard';
import { Stack } from '../ui/Stack';
import type { GroupBalances, User } from '../../../../firebase/functions/src/types/webapp-shared-types';

interface BalanceSummaryProps {
  balances: GroupBalances | null;
  members?: User[];
  variant?: 'default' | 'sidebar';
}

export function BalanceSummary({ balances, members = [], variant = 'default' }: BalanceSummaryProps) {
  // Helper to get user display name
  const getUserName = (userId: string) => {
    const member = members.find(m => m.uid === userId);
    return member?.displayName || 'Unknown';
  };

  const content = !balances ? (
    <p className="text-gray-600 text-sm">Loading balances...</p>
  ) : balances.simplifiedDebts.length === 0 ? (
    <p className="text-gray-600 text-sm">All settled up!</p>
  ) : (
    <div className={variant === 'sidebar' ? 'space-y-3' : ''}>
      {balances.simplifiedDebts.map((debt, index: number) => (
        <div key={index} className={variant === 'sidebar' ? 'border-b border-gray-100 pb-2 last:border-0' : 'flex justify-between items-center py-2'}>
          <div className={variant === 'sidebar' ? '' : 'text-sm'}>
            <span className={variant === 'sidebar' ? 'text-xs block' : 'font-medium'}>
              {getUserName(debt.from.userId)} → {getUserName(debt.to.userId)}
            </span>
            <span className={variant === 'sidebar' ? 'text-sm font-semibold text-red-600' : 'font-semibold text-red-600 ml-auto'}>
              ${debt.amount.toFixed(2)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );

  if (variant === 'sidebar') {
    return (
      <SidebarCard title="Balances">
        {content}
      </SidebarCard>
    );
  }

  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold mb-4">Balances</h2>
      {content}
    </Card>
  );
}