import { Card } from '../ui/Card';
import { Stack } from '../ui/Stack';
import type { GroupBalances, User } from '../../../../firebase/functions/src/types/webapp-shared-types';

interface BalanceSummaryProps {
  balances: GroupBalances | null;
  members?: User[];
}

export function BalanceSummary({ balances, members = [] }: BalanceSummaryProps) {
  // Helper to get user display name
  const getUserName = (userId: string) => {
    const member = members.find(m => m.uid === userId);
    return member?.displayName || 'Unknown';
  };

  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold mb-4">Balances</h2>
      {!balances ? (
        <p className="text-gray-600">Loading balances...</p>
      ) : balances.simplifiedDebts.length === 0 ? (
        <p className="text-gray-600">All settled up!</p>
      ) : (
        <Stack spacing="sm">
          {balances.simplifiedDebts.map((debt, index: number) => (
            <div key={index} className="flex justify-between items-center py-2">
              <span className="text-sm">
                <span className="font-medium">{getUserName(debt.from.userId)}</span> owes{' '}
                <span className="font-medium">{getUserName(debt.to.userId)}</span>
              </span>
              <span className="font-semibold text-red-600">
                ${debt.amount.toFixed(2)}
              </span>
            </div>
          ))}
        </Stack>
      )}
    </Card>
  );
}