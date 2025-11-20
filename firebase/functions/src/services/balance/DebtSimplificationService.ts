import { isZeroAmount, SimplifiedDebt, toCurrencyISOCode, UserBalance } from '@billsplit-wl/shared';
import type { CurrencyISOCode } from '@billsplit-wl/shared';
import type { ParsedCurrencyBalances as CurrencyBalances } from '../../schemas';
import { simplifyDebts } from '../../utils/debtSimplifier';

export class DebtSimplificationService {
    simplifyDebtsForAllCurrencies(balancesByCurrency: CurrencyBalances): SimplifiedDebt[] {
        const allSimplifiedDebts: SimplifiedDebt[] = [];

        for (const currencyStr of Object.keys(balancesByCurrency)) {
            const currency = toCurrencyISOCode(currencyStr);
            const currencyBalances = balancesByCurrency[currency];

            // Only simplify if there are actual balances
            if (this.hasNonZeroBalances(currencyBalances, currency)) {
                const currencyDebts = simplifyDebts(currencyBalances, currency);
                allSimplifiedDebts.push(...currencyDebts);
            }
        }

        return allSimplifiedDebts;
    }

    private hasNonZeroBalances(userBalances: Record<string, UserBalance>, currency: CurrencyISOCode): boolean {
        return Object.values(userBalances).some((balance) => !isZeroAmount(balance.netBalance, currency));
    }
}
