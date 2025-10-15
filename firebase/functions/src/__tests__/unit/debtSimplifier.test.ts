import { DebtScenarios, SimplifiedDebtBuilder, UserBalanceBuilder } from '@splitifyd/test-support';
import type { Amount, SimplifiedDebt, UserBalance } from '@splitifyd/shared';
import {
    addAmounts,
    compareAmounts,
    isZeroAmount,
    subtractAmounts,
    zeroAmount,
} from '@splitifyd/shared';
import { describe, expect, it } from 'vitest';
import { simplifyDebts } from '../../utils/debtSimplifier';

const USD = 'USD';
const EUR = 'EUR';

const buildDebt = (from: string, to: string, amount: Amount | number, currency: string = USD) =>
    new SimplifiedDebtBuilder()
        .from(from)
        .to(to)
        .withAmount(amount)
        .withCurrency(currency)
        .build();

const normalizeTransactions = (transactions: SimplifiedDebt[]) =>
    [...transactions]
        .map((transaction) => ({
            from: transaction.from.uid,
            to: transaction.to.uid,
            amount: transaction.amount,
            currency: transaction.currency,
        }))
        .sort((a, b) => {
            if (a.from !== b.from) {
                return a.from.localeCompare(b.from);
            }
            if (a.to !== b.to) {
                return a.to.localeCompare(b.to);
            }
            if (a.amount !== b.amount) {
                return a.amount.localeCompare(b.amount);
            }
            return a.currency.localeCompare(b.currency);
        });

const expectTransactionsMatch = (actual: SimplifiedDebt[], expected: SimplifiedDebt[]) => {
    expect(normalizeTransactions(actual)).toEqual(normalizeTransactions(expected));
};

const netFromBalances = (balances: Record<string, UserBalance>, currency: string) => {
    const zero = zeroAmount(currency);
    const net: Record<string, Amount> = {};

    Object.values(balances).forEach((user) => {
        let userNet: Amount = zero;

        Object.values(user.owedBy).forEach((amount) => {
            userNet = addAmounts(userNet, amount, currency);
        });

        Object.values(user.owes).forEach((amount) => {
            userNet = subtractAmounts(userNet, amount, currency);
        });

        if (!isZeroAmount(userNet, currency)) {
            net[user.uid] = userNet;
        }
    });

    return net;
};

const netFromTransactions = (transactions: SimplifiedDebt[], currency: string) => {
    const zero = zeroAmount(currency);
    const net: Record<string, Amount> = {};

    transactions.forEach((transaction) => {
        const currentDebtor = net[transaction.from.uid] ?? zero;
        net[transaction.from.uid] = subtractAmounts(currentDebtor, transaction.amount, currency);

        const currentCreditor = net[transaction.to.uid] ?? zero;
        net[transaction.to.uid] = addAmounts(currentCreditor, transaction.amount, currency);
    });

    Object.entries(net).forEach(([uid, amount]) => {
        if (isZeroAmount(amount, currency)) {
            delete net[uid];
        }
    });

    return net;
};

const expectNetBalancesMatch = (balances: Record<string, UserBalance>, transactions: SimplifiedDebt[], currency: string) => {
    const expectedNet = netFromBalances(balances, currency);
    const actualNet = netFromTransactions(transactions, currency);

    expect(Object.keys(actualNet).sort()).toEqual(Object.keys(expectedNet).sort());
    Object.entries(expectedNet).forEach(([uid, expectedAmount]) => {
        expect(compareAmounts(actualNet[uid], expectedAmount, currency)).toBe(0);
    });
};

const expectAmountEqual = (actual: Amount, expected: Amount | number, currency: string = USD) => {
    expect(compareAmounts(actual, expected, currency)).toBe(0);
};

const expectAmountPositive = (actual: Amount, currency: string) => {
    expect(compareAmounts(actual, zeroAmount(currency), currency)).toBeGreaterThan(0);
};

describe('simplifyDebts', () => {
    it('returns empty array for empty balances', () => {
        expect(simplifyDebts({}, USD)).toEqual([]);
    });

    it('returns empty array when all balances net to zero', () => {
        const result = simplifyDebts(DebtScenarios.allZeroBalances(), USD);
        expect(result).toEqual([]);
    });

    it('settles a simple two-person debt with a single transfer', () => {
        const result = simplifyDebts(DebtScenarios.simpleTwoPerson(), USD);

        expectTransactionsMatch(result, [
            buildDebt('user1', 'user2', '50.00'),
        ]);
    });

    it('consolidates reciprocal debts to the net difference', () => {
        const result = simplifyDebts(DebtScenarios.reciprocalDebts(), USD);

        expectTransactionsMatch(result, [
            buildDebt('user1', 'user2', '20.00'),
        ]);
    });

    it('eliminates a perfect triangular debt cycle', () => {
        const result = simplifyDebts(DebtScenarios.triangularCycle(), USD);
        expect(result).toEqual([]);
    });

    it('produces minimal transfers for an uneven chain', () => {
        const result = simplifyDebts(DebtScenarios.unevenChain(), USD);

        expectTransactionsMatch(result, [
            buildDebt('user1', 'user3', '50.00'),
            buildDebt('user1', 'user4', '50.00'),
        ]);
    });

    it('preserves original net balances for a complex network', () => {
        const balances: Record<string, UserBalance> = {
            alice: new UserBalanceBuilder()
                .withUserId('alice')
                .owesUser('bob', '40')
                .owesUser('charlie', '10')
                .owedByUser('dave', '20')
                .build(),
            bob: new UserBalanceBuilder()
                .withUserId('bob')
                .owesUser('charlie', '15')
                .owedByUser('alice', '40')
                .owedByUser('dave', '10')
                .build(),
            charlie: new UserBalanceBuilder()
                .withUserId('charlie')
                .owesUser('dave', '5')
                .owedByUser('alice', '10')
                .owedByUser('bob', '15')
                .build(),
            dave: new UserBalanceBuilder()
                .withUserId('dave')
                .owesUser('alice', '20')
                .owesUser('bob', '10')
                .owedByUser('charlie', '5')
                .build(),
        };

        const result = simplifyDebts(balances, USD);

        expect(result.length).toBeGreaterThan(0);
        result.forEach((transaction) => {
            expectAmountPositive(transaction.amount, USD);
            expect(transaction.from.uid).not.toBe(transaction.to.uid);
            expect(transaction.currency).toBe(USD);
        });

        expectNetBalancesMatch(balances, result, USD);
    });

    it('ignores sub-cent amounts that round down for the currency', () => {
        const balances: Record<string, UserBalance> = {
            user1: new UserBalanceBuilder()
                .withUserId('user1')
                .owesUser('user2', '0.004')
                .build(),
            user2: new UserBalanceBuilder()
                .withUserId('user2')
                .owedByUser('user1', '0.004')
                .build(),
        };

        const result = simplifyDebts(balances, USD);
        expect(result).toEqual([]);
    });

    it('never mixes currencies when simplifying', () => {
        const { usd, eur } = DebtScenarios.mixedCurrencyScenarios();

        const usdResult = simplifyDebts(usd, USD);
        expect(usdResult.length).toBeGreaterThan(0);
        usdResult.forEach((transaction) => {
            expect(transaction.currency).toBe(USD);
        });
        expectNetBalancesMatch(usd, usdResult, USD);

        const eurResult = simplifyDebts(eur, EUR);
        expect(eurResult.length).toBeGreaterThan(0);
        eurResult.forEach((transaction) => {
            expect(transaction.currency).toBe(EUR);
        });
        expectNetBalancesMatch(eur, eurResult, EUR);

        const currencies = new Set([...usdResult, ...eurResult].map((transaction) => transaction.currency));
        expect(currencies.has(USD)).toBe(true);
        expect(currencies.has(EUR)).toBe(true);
        expect(currencies.size).toBe(2);
    });

    it('aggregates payouts correctly in asymmetric networks', () => {
        const result = simplifyDebts(DebtScenarios.asymmetricWhale(), USD);

        expect(result.length).toBeGreaterThan(0);
        result.forEach((transaction) => {
            expectAmountPositive(transaction.amount, USD);
        });

        const zero = zeroAmount(USD);
        const paymentsToUser4 = result.filter((transaction) => transaction.to.uid === 'user4');
        const totalToUser4 = paymentsToUser4.reduce<Amount>(
            (sum, transaction) => addAmounts(sum, transaction.amount, USD),
            zero,
        );

        expectAmountEqual(totalToUser4, '100.00');
    });
});
