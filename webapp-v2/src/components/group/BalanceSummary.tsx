import { useMemo } from 'preact/hooks';
import { useComputed } from '@preact/signals';
import { Card } from '../ui/Card';
import { SidebarCard } from '@/components/ui';
import { formatCurrency } from '@/utils/currency';
import type { SimplifiedDebt } from '@splitifyd/shared';
import { useTranslation } from 'react-i18next';
import { enhancedGroupDetailStore } from '@/app/stores/group-detail-store-enhanced';

interface BalanceSummaryProps {
    variant?: 'default' | 'sidebar';
}

export function BalanceSummary({ variant = 'default' }: BalanceSummaryProps) {
    const { t } = useTranslation();

    // Fetch data directly from the store
    const balances = useComputed(() => enhancedGroupDetailStore.balances);
    const members = useComputed(() => enhancedGroupDetailStore.members);

    // Helper to get user display name
    const getUserName = (userId: string) => {
        const member = members.value.find((m) => m.uid === userId);
        return member?.displayName || 'Unknown';
    };

    // Group debts by currency for proper display - memoized to avoid recalculation
    const groupedDebts = useMemo(() => {
        if (!balances.value?.simplifiedDebts) return [];

        const grouped = balances.value.simplifiedDebts.reduce(
            (acc, debt) => {
                const currency = debt.currency;
                if (!acc[currency]) {
                    acc[currency] = [];
                }
                acc[currency].push(debt);
                return acc;
            },
            {} as Record<string, SimplifiedDebt[]>,
        );

        // Sort currencies: USD first, then alphabetically
        const sortedCurrencies = Object.keys(grouped).sort((a, b) => {
            if (a === 'USD') return -1;
            if (b === 'USD') return 1;
            return a.localeCompare(b);
        });

        return sortedCurrencies.map((currency) => ({
            currency,
            debts: grouped[currency],
        }));
    }, [balances.value?.simplifiedDebts]);

    const content = !balances.value ? (
        <p className="text-gray-600 text-sm">{t('balanceSummary.loadingBalances')}</p>
    ) : balances.value.simplifiedDebts.length === 0 ? (
        <p className="text-gray-600 text-sm">{t('balanceSummary.allSettledUp')}</p>
    ) : (
        <div className={variant === 'sidebar' ? 'space-y-4' : 'space-y-6'}>
            {groupedDebts.map(({ currency, debts }, groupIndex) => (
                <div key={currency} className={variant === 'sidebar' ? 'border-l-2 border-gray-200 pl-3' : `border-b border-gray-200 pb-4 last:border-0 ${groupIndex > 0 ? 'pt-4' : ''}`}>
                    {groupedDebts.length > 1 && (
                        <h3 className={variant === 'sidebar' ? 'text-xs font-bold text-gray-600 mb-2 uppercase tracking-wider' : 'text-base font-bold text-gray-800 mb-3 flex items-center gap-2'}>
                            <span className={variant === 'sidebar' ? '' : 'bg-gray-100 px-2 py-1 rounded'}>{currency}</span>
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
                                    <span 
                                        className={variant === 'sidebar' ? 'text-xs text-gray-600' : 'font-medium text-gray-700'}
                                        data-testid={`debt-relationship-${debt.from.userId}-${debt.to.userId}`}
                                    >
                                        {getUserName(debt.from.userId)}
                                        {t('balanceSummary.debtArrow')}
                                        {getUserName(debt.to.userId)}
                                    </span>
                                    <span className={variant === 'sidebar' ? 'text-sm font-bold text-red-600' : 'text-lg font-bold text-red-600'} data-financial-amount="debt">
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
        return <SidebarCard title={t('balanceSummary.title')}>{content}</SidebarCard>;
    }

    return (
        <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4">{t('balanceSummary.title')}</h2>
            {content}
        </Card>
    );
}
