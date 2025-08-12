import { useMemo } from 'preact/hooks';
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

  // Group debts by currency for proper display - memoized to avoid recalculation
  const groupedDebts = useMemo(() => {
    if (!balances?.simplifiedDebts) return [];
    
    const grouped = balances.simplifiedDebts.reduce((acc, debt) => {
      const currency = debt.currency;
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
  }, [balances?.simplifiedDebts]);

  const content = !balances ? (
    <p className="text-gray-600 text-sm">Loading balances...</p>
  ) : balances.simplifiedDebts.length === 0 ? (
    <p className="text-gray-600 text-sm">All settled up!</p>
  ) : (
    <div className={variant === 'sidebar' ? 'space-y-4' : 'space-y-6'}>
      {groupedDebts.map(({ currency, debts }, groupIndex) => (
        <div 
          key={currency} 
          className={
            variant === 'sidebar' 
              ? 'border-l-2 border-gray-200 pl-3' 
              : `border-b border-gray-200 pb-4 last:border-0 ${groupIndex > 0 ? 'pt-4' : ''}`
          }
        >
          {groupedDebts.length > 1 && (
            <h3 className={
              variant === 'sidebar' 
                ? 'text-xs font-bold text-gray-600 mb-2 uppercase tracking-wider' 
                : 'text-base font-bold text-gray-800 mb-3 flex items-center gap-2'
            }>
              <span className={variant === 'sidebar' ? '' : 'bg-gray-100 px-2 py-1 rounded'}>
                {currency}
              </span>
            </h3>
          )}
          <div className={variant === 'sidebar' ? 'space-y-2' : 'space-y-3'}>
            {debts.map((debt, index) => (
              <div 
                key={`${currency}-${index}`} 
                className={
                  variant === 'sidebar' 
                    ? 'border-b border-gray-50 pb-2 last:border-0' 
                    : 'flex justify-between items-center py-2 px-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors'
                }
              >
                <div className={variant === 'sidebar' ? 'flex flex-col gap-1' : 'flex justify-between items-center w-full'}>
                  <span className={variant === 'sidebar' ? 'text-xs text-gray-600' : 'font-medium text-gray-700'}>
                    {getUserName(debt.from.userId)} → {getUserName(debt.to.userId)}
                  </span>
                  <span className={
                    variant === 'sidebar' 
                      ? 'text-sm font-bold text-red-600' 
                      : 'text-lg font-bold text-red-600'
                  }>
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