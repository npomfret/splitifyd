import type { ExpenseDTO, SettlementDTO, UserBalance } from '@splitifyd/shared';
import type { ParsedCurrencyBalances as CurrencyBalances, GroupBalanceDTO } from '../../schemas';
import { ExpenseProcessor } from './ExpenseProcessor';
import { SettlementProcessor } from './SettlementProcessor';
import { DebtSimplificationService } from './DebtSimplificationService';
import { logger } from '../../logger';
import type { IFirestoreWriter } from '../firestore';
import type { Transaction } from 'firebase-admin/firestore';

export class IncrementalBalanceService {
    private expenseProcessor: ExpenseProcessor;
    private settlementProcessor: SettlementProcessor;
    private debtSimplificationService: DebtSimplificationService;

    constructor(private firestoreWriter: IFirestoreWriter) {
        this.expenseProcessor = new ExpenseProcessor();
        this.settlementProcessor = new SettlementProcessor();
        this.debtSimplificationService = new DebtSimplificationService();
    }

    applyExpenseCreated(transaction: Transaction, groupId: string, currentBalance: GroupBalanceDTO, expense: ExpenseDTO, memberIds: string[]): void {
        logger.info('Applying expense creation to balance', { groupId, expenseId: expense.id });

        this.firestoreWriter.updateGroupBalanceInTransaction(transaction, groupId, currentBalance, (currentBalance) => {
            const delta = this.expenseProcessor.processExpenses([expense], memberIds);
            const newBalancesByCurrency = this.mergeBalances(currentBalance.balancesByCurrency, delta);
            const simplifiedDebts = this.debtSimplificationService.simplifyDebtsForAllCurrencies(newBalancesByCurrency);

            return {
                ...currentBalance,
                balancesByCurrency: newBalancesByCurrency,
                simplifiedDebts,
                version: currentBalance.version + 1,
            };
        });
    }

    applyExpenseDeleted(transaction: Transaction, groupId: string, currentBalance: GroupBalanceDTO, expense: ExpenseDTO, memberIds: string[]): void {
        logger.info('Applying expense deletion to balance', { groupId, expenseId: expense.id });

        this.firestoreWriter.updateGroupBalanceInTransaction(transaction, groupId, currentBalance, (currentBalance) => {
            const delta = this.expenseProcessor.processExpenses([expense], memberIds);
            const negatedDelta = this.negateBalances(delta);
            const newBalancesByCurrency = this.mergeBalances(currentBalance.balancesByCurrency, negatedDelta);
            const simplifiedDebts = this.debtSimplificationService.simplifyDebtsForAllCurrencies(newBalancesByCurrency);

            return {
                ...currentBalance,
                balancesByCurrency: newBalancesByCurrency,
                simplifiedDebts,
                version: currentBalance.version + 1,
            };
        });
    }

    applyExpenseUpdated(transaction: Transaction, groupId: string, currentBalance: GroupBalanceDTO, oldExpense: ExpenseDTO, newExpense: ExpenseDTO, memberIds: string[]): void {
        logger.info('Applying expense update to balance', { groupId, expenseId: newExpense.id });

        this.firestoreWriter.updateGroupBalanceInTransaction(transaction, groupId, currentBalance, (currentBalance) => {
            const oldDelta = this.expenseProcessor.processExpenses([oldExpense], memberIds);
            const negatedOldDelta = this.negateBalances(oldDelta);

            const newDelta = this.expenseProcessor.processExpenses([newExpense], memberIds);

            let updatedBalances = this.mergeBalances(currentBalance.balancesByCurrency, negatedOldDelta);
            updatedBalances = this.mergeBalances(updatedBalances, newDelta);

            const simplifiedDebts = this.debtSimplificationService.simplifyDebtsForAllCurrencies(updatedBalances);

            return {
                ...currentBalance,
                balancesByCurrency: updatedBalances,
                simplifiedDebts,
                version: currentBalance.version + 1,
            };
        });
    }

    applySettlementCreated(transaction: Transaction, groupId: string, currentBalance: GroupBalanceDTO, settlement: SettlementDTO, memberIds: string[]): void {
        logger.info('Applying settlement creation to balance', { groupId, settlementId: settlement.id });

        this.firestoreWriter.updateGroupBalanceInTransaction(transaction, groupId, currentBalance, (currentBalance) => {
            const balancesByCurrency = JSON.parse(JSON.stringify(currentBalance.balancesByCurrency)) as CurrencyBalances;

            this.ensureMembersInitialized(balancesByCurrency, settlement.currency, memberIds);

            this.settlementProcessor.processSettlements([settlement], balancesByCurrency);
            const simplifiedDebts = this.debtSimplificationService.simplifyDebtsForAllCurrencies(balancesByCurrency);

            return {
                ...currentBalance,
                balancesByCurrency,
                simplifiedDebts,
                version: currentBalance.version + 1,
            };
        });
    }

    applySettlementDeleted(transaction: Transaction, groupId: string, currentBalance: GroupBalanceDTO, settlement: SettlementDTO, memberIds: string[]): void {
        logger.info('Applying settlement deletion to balance', { groupId, settlementId: settlement.id });

        this.firestoreWriter.updateGroupBalanceInTransaction(transaction, groupId, currentBalance, (currentBalance) => {
            const balancesByCurrency = JSON.parse(JSON.stringify(currentBalance.balancesByCurrency)) as CurrencyBalances;

            this.ensureMembersInitialized(balancesByCurrency, settlement.currency, memberIds);

            const negatedSettlement: SettlementDTO = {
                ...settlement,
                amount: -settlement.amount,
            };

            this.settlementProcessor.processSettlements([negatedSettlement], balancesByCurrency);
            const simplifiedDebts = this.debtSimplificationService.simplifyDebtsForAllCurrencies(balancesByCurrency);

            return {
                ...currentBalance,
                balancesByCurrency,
                simplifiedDebts,
                version: currentBalance.version + 1,
            };
        });
    }

    applySettlementUpdated(transaction: Transaction, groupId: string, currentBalance: GroupBalanceDTO, oldSettlement: SettlementDTO, newSettlement: SettlementDTO, memberIds: string[]): void {
        logger.info('Applying settlement update to balance', { groupId, settlementId: newSettlement.id });

        this.firestoreWriter.updateGroupBalanceInTransaction(transaction, groupId, currentBalance, (currentBalance) => {
            const balancesByCurrency = JSON.parse(JSON.stringify(currentBalance.balancesByCurrency)) as CurrencyBalances;

            this.ensureMembersInitialized(balancesByCurrency, oldSettlement.currency, memberIds);
            this.ensureMembersInitialized(balancesByCurrency, newSettlement.currency, memberIds);

            const negatedOldSettlement: SettlementDTO = {
                ...oldSettlement,
                amount: -oldSettlement.amount,
            };

            this.settlementProcessor.processSettlements([negatedOldSettlement], balancesByCurrency);
            this.settlementProcessor.processSettlements([newSettlement], balancesByCurrency);

            const simplifiedDebts = this.debtSimplificationService.simplifyDebtsForAllCurrencies(balancesByCurrency);

            return {
                ...currentBalance,
                balancesByCurrency,
                simplifiedDebts,
                version: currentBalance.version + 1,
            };
        });
    }

    private mergeBalances(existing: CurrencyBalances, delta: CurrencyBalances): CurrencyBalances {
        const result: CurrencyBalances = JSON.parse(JSON.stringify(existing));

        for (const currency of Object.keys(delta)) {
            if (!result[currency]) {
                result[currency] = delta[currency];
                continue;
            }

            const existingCurrencyBalances = result[currency];
            const deltaCurrencyBalances = delta[currency];

            for (const userId of Object.keys(deltaCurrencyBalances)) {
                if (!existingCurrencyBalances[userId]) {
                    existingCurrencyBalances[userId] = deltaCurrencyBalances[userId];
                    continue;
                }

                const existingUserBalance = existingCurrencyBalances[userId];
                const deltaUserBalance = deltaCurrencyBalances[userId];

                for (const otherUserId of Object.keys(deltaUserBalance.owes)) {
                    existingUserBalance.owes[otherUserId] = (existingUserBalance.owes[otherUserId] || 0) + deltaUserBalance.owes[otherUserId];

                    if (Math.abs(existingUserBalance.owes[otherUserId]) < 0.01) {
                        delete existingUserBalance.owes[otherUserId];
                    }
                }

                for (const otherUserId of Object.keys(deltaUserBalance.owedBy)) {
                    existingUserBalance.owedBy[otherUserId] = (existingUserBalance.owedBy[otherUserId] || 0) + deltaUserBalance.owedBy[otherUserId];

                    if (Math.abs(existingUserBalance.owedBy[otherUserId]) < 0.01) {
                        delete existingUserBalance.owedBy[otherUserId];
                    }
                }

                this.recalculateNetBalance(existingUserBalance);
            }
        }

        return result;
    }

    private negateBalances(balances: CurrencyBalances): CurrencyBalances {
        const result: CurrencyBalances = {};

        for (const currency of Object.keys(balances)) {
            result[currency] = {};

            for (const userId of Object.keys(balances[currency])) {
                const userBalance = balances[currency][userId];
                const negatedOwes: Record<string, number> = {};
                const negatedOwedBy: Record<string, number> = {};

                for (const otherUserId of Object.keys(userBalance.owes)) {
                    negatedOwes[otherUserId] = -userBalance.owes[otherUserId];
                }

                for (const otherUserId of Object.keys(userBalance.owedBy)) {
                    negatedOwedBy[otherUserId] = -userBalance.owedBy[otherUserId];
                }

                result[currency][userId] = {
                    uid: userId,
                    owes: negatedOwes,
                    owedBy: negatedOwedBy,
                    netBalance: -userBalance.netBalance,
                };
            }
        }

        return result;
    }

    private ensureMembersInitialized(balancesByCurrency: CurrencyBalances, currency: string, memberIds: string[]): void {
        if (!balancesByCurrency[currency]) {
            balancesByCurrency[currency] = {};
        }

        for (const memberId of memberIds) {
            if (!balancesByCurrency[currency][memberId]) {
                balancesByCurrency[currency][memberId] = {
                    uid: memberId,
                    owes: {},
                    owedBy: {},
                    netBalance: 0,
                };
            }
        }
    }

    private recalculateNetBalance(userBalance: UserBalance): void {
        const totalOwed = Object.values(userBalance.owedBy).reduce((sum, amount) => sum + amount, 0);
        const totalOwing = Object.values(userBalance.owes).reduce((sum, amount) => sum + amount, 0);
        userBalance.netBalance = totalOwed - totalOwing;
    }
}
