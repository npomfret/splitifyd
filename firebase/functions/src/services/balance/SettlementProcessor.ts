import { UserBalance } from '@splitifyd/shared';
import { CurrencyBalances } from './types';
import type { SettlementDocument } from '../../schemas';

export class SettlementProcessor {
    processSettlements(settlements: SettlementDocument[], balancesByCurrency: CurrencyBalances): void {
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

    private processSettlementForCurrency(settlement: SettlementDocument, userBalances: Record<string, UserBalance>): void {
        const payerId = settlement.payerId;
        const payeeId = settlement.payeeId;
        const amount = settlement.amount;

        // Initialize user balances if they don't exist
        if (!userBalances[payerId]) {
            userBalances[payerId] = {
                uid: payerId,
                owes: {},
                owedBy: {},
                netBalance: 0,
            };
        }

        if (!userBalances[payeeId]) {
            userBalances[payeeId] = {
                uid: payeeId,
                owes: {},
                owedBy: {},
                netBalance: 0,
            };
        }

        // Process the settlement: payerId pays payeeId the settlement amount
        // This reduces what payerId owes payeeId or creates a reverse debt
        this.processSettlementBetweenUsers(userBalances[payerId], userBalances[payeeId], amount);

        // Recalculate net balances
        this.recalculateNetBalance(userBalances[payerId]);
        this.recalculateNetBalance(userBalances[payeeId]);
    }

    private processSettlementBetweenUsers(payerBalance: UserBalance, payeeBalance: UserBalance, settlementAmount: number): void {
        const payerId = payerBalance.uid;
        const payeeId = payeeBalance.uid;

        // How much does payer currently owe payee?
        const currentDebt = payerBalance.owes[payeeId] || 0;

        if (settlementAmount <= currentDebt) {
            // Settlement reduces existing debt
            payerBalance.owes[payeeId] = currentDebt - settlementAmount;
            payeeBalance.owedBy[payerId] = (payeeBalance.owedBy[payerId] || 0) - settlementAmount;

            // Clean up zero balances
            if (payerBalance.owes[payeeId] === 0) {
                delete payerBalance.owes[payeeId];
            }
            if (payeeBalance.owedBy[payerId] === 0) {
                delete payeeBalance.owedBy[payerId];
            }
        } else {
            // Settlement exceeds debt - creates reverse debt
            const overpayment = settlementAmount - currentDebt;

            // Clear existing debt
            delete payerBalance.owes[payeeId];
            delete payeeBalance.owedBy[payerId];

            // Create reverse debt (payee now owes payer)
            payeeBalance.owes[payerId] = (payeeBalance.owes[payerId] || 0) + overpayment;
            payerBalance.owedBy[payeeId] = (payerBalance.owedBy[payeeId] || 0) + overpayment;
        }
    }

    private recalculateNetBalance(userBalance: UserBalance): void {
        const totalOwed = Object.values(userBalance.owedBy).reduce((sum, amount) => sum + amount, 0);
        const totalOwing = Object.values(userBalance.owes).reduce((sum, amount) => sum + amount, 0);
        userBalance.netBalance = totalOwed - totalOwing;
    }
}
