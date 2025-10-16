import { addAmounts, Amount, compareAmounts, isZeroAmount, normalizeAmount, SettlementDTO, subtractAmounts, sumAmounts, UserBalance, zeroAmount } from '@splitifyd/shared';
import type { ParsedCurrencyBalances as CurrencyBalances } from '../../schemas';

export class SettlementProcessor {
    processSettlements(settlements: SettlementDTO[], balancesByCurrency: CurrencyBalances): void {
        for (const settlement of settlements) {
            if (!settlement.currency) {
                throw new Error(`Settlement ${settlement.id} is missing currency - invalid state`);
            }

            // Get the currency balances to update
            const currencyBalances = balancesByCurrency[settlement.currency];
            if (!currencyBalances) {
                // If we don't have expenses in this currency, initialize empty balances
                balancesByCurrency[settlement.currency] = {};
            }

            this.processSettlementForCurrency(settlement, balancesByCurrency[settlement.currency]);
        }
    }

    private processSettlementForCurrency(settlement: SettlementDTO, userBalances: Record<string, UserBalance>): void {
        const payerId = settlement.payerId;
        const payeeId = settlement.payeeId;
        const amount = normalizeAmount(settlement.amount, settlement.currency);

        // Initialize user balances if they don't exist
        if (!userBalances[payerId]) {
            userBalances[payerId] = {
                uid: payerId,
                owes: {},
                owedBy: {},
                netBalance: zeroAmount(settlement.currency),
            };
        }

        if (!userBalances[payeeId]) {
            userBalances[payeeId] = {
                uid: payeeId,
                owes: {},
                owedBy: {},
                netBalance: zeroAmount(settlement.currency),
            };
        }

        // Process the settlement: payerId pays payeeId the settlement amount
        // This reduces what payerId owes payeeId or creates a reverse debt
        this.processSettlementBetweenUsers(userBalances[payerId], userBalances[payeeId], amount, settlement.currency);

        // Recalculate net balances
        this.recalculateNetBalance(userBalances[payerId], settlement.currency);
        this.recalculateNetBalance(userBalances[payeeId], settlement.currency);
    }

    private processSettlementBetweenUsers(payerBalance: UserBalance, payeeBalance: UserBalance, settlementAmount: Amount, currency: string): void {
        const payerId = payerBalance.uid;
        const payeeId = payeeBalance.uid;

        // How much does payer currently owe payee?
        const currentDebt = payerBalance.owes[payeeId] ?? zeroAmount(currency);

        if (compareAmounts(settlementAmount, currentDebt, currency) <= 0) {
            // Settlement reduces existing debt
            payerBalance.owes[payeeId] = subtractAmounts(currentDebt, settlementAmount, currency);
            payeeBalance.owedBy[payerId] = subtractAmounts(payeeBalance.owedBy[payerId] ?? zeroAmount(currency), settlementAmount, currency);

            // Clean up zero balances
            if (isZeroAmount(payerBalance.owes[payeeId], currency)) {
                delete payerBalance.owes[payeeId];
            }
            if (isZeroAmount(payeeBalance.owedBy[payerId], currency)) {
                delete payeeBalance.owedBy[payerId];
            }
        } else {
            // Settlement exceeds debt - creates reverse debt
            const overpayment = subtractAmounts(settlementAmount, currentDebt, currency);

            // Clear existing debt
            delete payerBalance.owes[payeeId];
            delete payeeBalance.owedBy[payerId];

            // Create reverse debt (payee now owes payer)
            payeeBalance.owes[payerId] = addAmounts(payeeBalance.owes[payerId] ?? zeroAmount(currency), overpayment, currency);
            payerBalance.owedBy[payeeId] = addAmounts(payerBalance.owedBy[payeeId] ?? zeroAmount(currency), overpayment, currency);
        }
    }

    private recalculateNetBalance(userBalance: UserBalance, currency: string): void {
        const totalOwed = sumAmounts(Object.values(userBalance.owedBy), currency);
        const totalOwing = sumAmounts(Object.values(userBalance.owes), currency);
        userBalance.netBalance = subtractAmounts(totalOwed, totalOwing, currency);
    }
}
