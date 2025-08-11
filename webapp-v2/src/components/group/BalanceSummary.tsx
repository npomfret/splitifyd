import { Card } from '../ui/Card';
import { SidebarCard } from '../ui/SidebarCard';
import { Stack } from '../ui/Stack';
import { formatCurrency } from '../../utils/currency';
import type { GroupBalances, User, SimplifiedDebt } from '../../../../firebase/functions/src/shared/shared-types';

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

  // Group debts by currency for proper display
  const groupDebtsByCurrency = (debts: SimplifiedDebt[]) => {
    const grouped = debts.reduce((acc, debt) => {
      const currency = debt.currency || 'USD';
      if (!acc[currency]) {
        acc[currency] = [];
      }
      acc[currency].push(debt);
      return acc;
    }, {} as Record<string, SimplifiedDebt[]>);

    // Sort currencies: USD first, then alphabetically
    const sortedCurrencies = Object.keys(grouped).sort((a, b) => {
      if (a === 'USD') return -1;
      if (b === 'USD') return 1;
      return a.localeCompare(b);
    });

    return sortedCurrencies.map(currency => ({
      currency,
      debts: grouped[currency]
    }));
  };

  const content = !balances ? (
    <p className="text-gray-600 text-sm">Loading balances...</p>
  ) : balances.simplifiedDebts.length === 0 ? (
    <p className="text-gray-600 text-sm">All settled up!</p>
  ) : (
    <div className={variant === 'sidebar' ? 'space-y-4' : 'space-y-6'}>
      {groupDebtsByCurrency(balances.simplifiedDebts).map(({ currency, debts }) => (
        <div key={currency} className={variant === 'sidebar' ? '' : 'border-b border-gray-100 pb-4 last:border-0'}>
          {groupDebtsByCurrency(balances.simplifiedDebts).length > 1 && (
            <h3 className={variant === 'sidebar' ? 'text-xs font-semibold text-gray-500 mb-2' : 'text-sm font-semibold text-gray-700 mb-3'}>
              {currency}
            </h3>
          )}
          <div className={variant === 'sidebar' ? 'space-y-2' : 'space-y-2'}>
            {debts.map((debt, index) => (
              <div key={`${currency}-${index}`} className={variant === 'sidebar' ? 'border-b border-gray-50 pb-2 last:border-0' : 'flex justify-between items-center py-1'}>
                <div className={variant === 'sidebar' ? '' : 'text-sm'}>
                  <span className={variant === 'sidebar' ? 'text-xs block' : 'font-medium'}>
                    {getUserName(debt.from.userId)} → {getUserName(debt.to.userId)}
                  </span>
                  <span className={variant === 'sidebar' ? 'text-sm font-semibold text-red-600' : 'font-semibold text-red-600 ml-auto'}>
                    {formatCurrency(debt.amount, debt.currency)}
                  </span>
                </div>
              </div>
            ))}
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