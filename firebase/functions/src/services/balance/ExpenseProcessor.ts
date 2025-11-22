import {addAmounts, Amount, ExpenseDTO, normalizeAmount, subtractAmounts, sumAmounts, UserBalance, UserId, zeroAmount} from '@billsplit-wl/shared';
import type { CurrencyISOCode } from '@billsplit-wl/shared';
import type { ParsedCurrencyBalances as CurrencyBalances } from '../../schemas';

export class ExpenseProcessor {
    processExpenses(expenses: ExpenseDTO[], memberIds: UserId[]): CurrencyBalances {
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
                        uid: memberId,
                        owes: {},
                        owedBy: {},
                        netBalance: zeroAmount(expense.currency),
                    };
                }
            }

            this.processExpenseForCurrency(expense, balancesByCurrency[expense.currency]);
        }

        return balancesByCurrency;
    }

    private processExpenseForCurrency(expense: ExpenseDTO, userBalances: Record<string, UserBalance>): void {
        const payerId = expense.paidBy;

        // Process each split in the expense
        for (const split of expense.splits) {
            const splitUserId = split.uid;
            const splitAmount = normalizeAmount(split.amount, expense.currency);

            // Initialize user balances if they don't exist
            if (!userBalances[splitUserId]) {
                userBalances[splitUserId] = {
                    uid: splitUserId,
                    owes: {},
                    owedBy: {},
                    netBalance: zeroAmount(expense.currency),
                };
            }

            if (!userBalances[payerId]) {
                userBalances[payerId] = {
                    uid: payerId,
                    owes: {},
                    owedBy: {},
                    netBalance: zeroAmount(expense.currency),
                };
            }

            // Skip if the payer is paying for themselves
            if (splitUserId === payerId) {
                continue;
            }

            // Update balances: splitUser owes payerId the split amount
            this.updateUserBalance(userBalances[splitUserId], payerId, splitAmount, 'owes', expense.currency);
            this.updateUserBalance(userBalances[payerId], splitUserId, splitAmount, 'owedBy', expense.currency);
        }

        // Recalculate net balances for all users
        for (const userId of Object.keys(userBalances)) {
            this.recalculateNetBalance(userBalances[userId], expense.currency);
        }
    }

    private updateUserBalance(userBalance: UserBalance, otherUserId: UserId, amount: Amount, type: 'owes' | 'owedBy', currency: CurrencyISOCode): void {
        const balanceMap = userBalance[type];
        const existing = balanceMap[otherUserId] ?? zeroAmount(currency);
        balanceMap[otherUserId] = addAmounts(existing, amount, currency);
    }

    private recalculateNetBalance(userBalance: UserBalance, currency: CurrencyISOCode): void {
        const totalOwed = sumAmounts(Object.values(userBalance.owedBy), currency);
        const totalOwing = sumAmounts(Object.values(userBalance.owes), currency);
        userBalance.netBalance = subtractAmounts(totalOwed, totalOwing, currency);
    }
}
