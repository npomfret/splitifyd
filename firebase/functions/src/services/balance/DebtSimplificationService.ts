import { simplifyDebts } from '../../utils/debtSimplifier';
import { SimplifiedDebt, UserBalance } from '@splitifyd/shared';
import type { ParsedCurrencyBalances as CurrencyBalances } from '../../schemas';

export class DebtSimplificationService {
    simplifyDebtsForAllCurrencies(balancesByCurrency: CurrencyBalances): SimplifiedDebt[] {
        const allSimplifiedDebts: SimplifiedDebt[] = [];

        for (const currency of Object.keys(balancesByCurrency)) {
            const currencyBalances = balancesByCurrency[currency];

            // Only simplify if there are actual balances
            if (this.hasNonZeroBalances(currencyBalances)) {
                const currencyDebts = simplifyDebts(currencyBalances, currency);
                allSimplifiedDebts.push(...currencyDebts);
            }
        }

        return allSimplifiedDebts;
    }

    private hasNonZeroBalances(userBalances: Record<string, UserBalance>): boolean {
        return Object.values(userBalances).some(
            (balance) => Math.abs(balance.netBalance) > 0.01, // Use small threshold for floating point comparison
        );
    }
}
