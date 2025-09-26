import { SimplifiedDebt, UserBalance } from '@splitifyd/shared';

export interface NetBalance {
    uid: string;
    netAmount: number;
}

/**
 * Simplifies complex web of debts into minimal set of transactions using greedy algorithm.
 *
 * Example: If A owes B $10, B owes C $15, and A owes C $5
 * Instead of 3 transactions, returns: A pays C $15 (settles both A→B→C and A→C directly)
 */
export function simplifyDebts(balances: Record<string, UserBalance>, currency: string): SimplifiedDebt[] {
    const netBalances = calculateNetBalances(balances);
    return createOptimalTransactions(netBalances, currency);
}

function calculateNetBalances(balances: Record<string, UserBalance>): Record<string, NetBalance> {
    const netBalances: Record<string, NetBalance> = {};

    Object.values(balances).forEach((user) => {
        let netAmount = 0;

        Object.values(user.owes).forEach((amount) => {
            netAmount -= amount;
        });

        Object.values(user.owedBy).forEach((amount) => {
            netAmount += amount;
        });

        // Only include users with significant balances (avoid floating-point precision issues)
        if (Math.abs(netAmount) > 0.01) {
            netBalances[user.uid] = {
                uid: user.uid,
                netAmount: netAmount,
            };
        }
    });

    return netBalances;
}

function createOptimalTransactions(netBalances: Record<string, NetBalance>, currency: string): SimplifiedDebt[] {
    const transactions: SimplifiedDebt[] = [];
    const creditors: NetBalance[] = [];
    const debtors: NetBalance[] = [];

    Object.values(netBalances).forEach((user) => {
        if (user.netAmount > 0) {
            creditors.push({ ...user });
        } else if (user.netAmount < 0) {
            debtors.push({ ...user, netAmount: -user.netAmount });
        }
    });

    creditors.sort((a, b) => b.netAmount - a.netAmount);
    debtors.sort((a, b) => b.netAmount - a.netAmount);

    let creditorIndex = 0;
    let debtorIndex = 0;

    while (creditorIndex < creditors.length && debtorIndex < debtors.length) {
        const creditor = creditors[creditorIndex];
        const debtor = debtors[debtorIndex];

        const transferAmount = Math.min(creditor.netAmount, debtor.netAmount);

        if (transferAmount > 0.01) {
            transactions.push({
                from: {
                    uid: debtor.uid,
                },
                to: {
                    uid: creditor.uid,
                },
                amount: transferAmount,
                currency: currency,
            });
        }

        creditor.netAmount -= transferAmount;
        debtor.netAmount -= transferAmount;

        if (creditor.netAmount <= 0.01) {
            creditorIndex++;
        }
        if (debtor.netAmount <= 0.01) {
            debtorIndex++;
        }
    }

    return transactions;
}
