import { addAmounts, compareAmounts, isZeroAmount, minAmount, negateAmount, SimplifiedDebt, subtractAmounts, UserBalance, zeroAmount } from '@billsplit-wl/shared';
import type { Amount } from '@billsplit-wl/shared';
import type { CurrencyISOCode } from '@billsplit-wl/shared';

interface NetBalance {
    uid: string;
    netAmount: Amount;
}

/**
 * Simplifies complex web of debts into minimal set of transactions using greedy algorithm.
 *
 * Example: If A owes B $10, B owes C $15, and A owes C $5
 * Instead of 3 transactions, returns: A pays C $15 (settles both A→B→C and A→C directly)
 */
export function simplifyDebts(balances: Record<string, UserBalance>, currency: CurrencyISOCode): SimplifiedDebt[] {
    const netBalances = calculateNetBalances(balances, currency);
    return createOptimalTransactions(netBalances, currency);
}

function calculateNetBalances(balances: Record<string, UserBalance>, currency: CurrencyISOCode): Record<string, NetBalance> {
    const netBalances: Record<string, NetBalance> = {};
    const zero = zeroAmount(currency);

    Object.values(balances).forEach((user) => {
        let netAmount: Amount = zero;

        Object.values(user.owes).forEach((amount) => {
            netAmount = subtractAmounts(netAmount, amount, currency);
        });

        Object.values(user.owedBy).forEach((amount) => {
            netAmount = addAmounts(netAmount, amount, currency);
        });

        if (!isZeroAmount(netAmount, currency)) {
            netBalances[user.uid] = {
                uid: user.uid,
                netAmount: netAmount,
            };
        }
    });

    return netBalances;
}

function createOptimalTransactions(netBalances: Record<string, NetBalance>, currency: CurrencyISOCode): SimplifiedDebt[] {
    const transactions: SimplifiedDebt[] = [];
    const creditors: NetBalance[] = [];
    const debtors: NetBalance[] = [];
    const zero = zeroAmount(currency);

    Object.values(netBalances).forEach((user) => {
        if (compareAmounts(user.netAmount, zero, currency) > 0) {
            creditors.push({ ...user, netAmount: user.netAmount });
        } else if (compareAmounts(user.netAmount, zero, currency) < 0) {
            debtors.push({ ...user, netAmount: negateAmount(user.netAmount, currency) });
        }
    });

    creditors.sort((a, b) => compareAmounts(b.netAmount, a.netAmount, currency));
    debtors.sort((a, b) => compareAmounts(b.netAmount, a.netAmount, currency));

    let creditorIndex = 0;
    let debtorIndex = 0;

    while (creditorIndex < creditors.length && debtorIndex < debtors.length) {
        const creditor = creditors[creditorIndex];
        const debtor = debtors[debtorIndex];

        const transferAmount = minAmount(creditor.netAmount, debtor.netAmount, currency);

        if (!isZeroAmount(transferAmount, currency)) {
            transactions.push({
                from: {
                    uid: debtor.uid,
                },
                to: {
                    uid: creditor.uid,
                },
                amount: transferAmount,
                currency,
            });
        }

        creditor.netAmount = subtractAmounts(creditor.netAmount, transferAmount, currency);
        debtor.netAmount = subtractAmounts(debtor.netAmount, transferAmount, currency);

        if (isZeroAmount(creditor.netAmount, currency)) {
            creditorIndex++;
        }
        if (isZeroAmount(debtor.netAmount, currency)) {
            debtorIndex++;
        }
    }

    return transactions;
}
