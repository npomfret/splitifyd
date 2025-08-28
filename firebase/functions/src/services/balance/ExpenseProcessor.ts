import { UserBalance } from '@splitifyd/shared';
import { Expense, CurrencyBalances } from './types';

export class ExpenseProcessor {
    processExpenses(expenses: Expense[], memberIds: string[]): CurrencyBalances {
        const balancesByCurrency: CurrencyBalances = {};

        for (const expense of expenses) {
            if (!expense.currency) {
                throw new Error(`Expense ${expense.id} is missing currency - invalid state`);
            }

            // Initialize currency balance if not exists
            if (!balancesByCurrency[expense.currency]) {
                balancesByCurrency[expense.currency] = {};

                // Initialize all members for this currency
                for (const memberId of memberIds) {
                    balancesByCurrency[expense.currency][memberId] = {
                        userId: memberId,
                        owes: {},
                        owedBy: {},
                        netBalance: 0,
                    };
                }
            }

            this.processExpenseForCurrency(expense, balancesByCurrency[expense.currency]);
        }

        return balancesByCurrency;
    }

    private processExpenseForCurrency(expense: Expense, userBalances: Record<string, UserBalance>): void {
        const payerId = expense.paidBy;

        // Process each split in the expense
        for (const split of expense.splits) {
            const splitUserId = split.userId;
            const splitAmount = split.amount;

            // Initialize user balances if they don't exist
            if (!userBalances[splitUserId]) {
                userBalances[splitUserId] = {
                    userId: splitUserId,
                    owes: {},
                    owedBy: {},
                    netBalance: 0,
                };
            }

            if (!userBalances[payerId]) {
                userBalances[payerId] = {
                    userId: payerId,
                    owes: {},
                    owedBy: {},
                    netBalance: 0,
                };
            }

            // Skip if the payer is paying for themselves
            if (splitUserId === payerId) {
                continue;
            }

            // Update balances: splitUser owes payerId the split amount
            this.updateUserBalance(userBalances[splitUserId], payerId, splitAmount, 'owes');
            this.updateUserBalance(userBalances[payerId], splitUserId, splitAmount, 'owedBy');
        }

        // Recalculate net balances for all users
        for (const userId of Object.keys(userBalances)) {
            this.recalculateNetBalance(userBalances[userId]);
        }
    }

    private updateUserBalance(userBalance: UserBalance, otherUserId: string, amount: number, type: 'owes' | 'owedBy'): void {
        const balanceMap = userBalance[type];
        balanceMap[otherUserId] = (balanceMap[otherUserId] || 0) + amount;
    }

    private recalculateNetBalance(userBalance: UserBalance): void {
        const totalOwed = Object.values(userBalance.owedBy).reduce((sum, amount) => sum + amount, 0);
        const totalOwing = Object.values(userBalance.owes).reduce((sum, amount) => sum + amount, 0);
        userBalance.netBalance = totalOwed - totalOwing;
    }
}
