import { Card } from '../ui/Card';
import { Stack } from '../ui/Stack';
import type { GroupBalances } from '../../types/webapp-shared-types';

interface BalanceSummaryProps {
  balances: GroupBalances | null;
}

export function BalanceSummary({ balances }: BalanceSummaryProps) {
  if (!balances) return null;

  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold mb-4">Balances</h2>
      {balances.simplifiedDebts.length === 0 ? (
        <p className="text-gray-600">All settled up!</p>
      ) : (
        <Stack spacing="sm">
          {balances.simplifiedDebts.map((debt, index: number) => (
            <div key={index} className="flex justify-between items-center py-2">
              <span className="text-sm">
                <span className="font-medium">{debt.from.name}</span> owes{' '}
                <span className="font-medium">{debt.to.name}</span>
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