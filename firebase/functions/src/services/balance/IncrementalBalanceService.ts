import type { ExpenseDTO, SettlementDTO, UserBalance } from '@splitifyd/shared';
import { amountToSmallestUnit, negateAmount, smallestUnitToAmountString, subtractAmounts, sumAmounts, zeroAmount } from '@splitifyd/shared';
import { negateNormalizedAmount } from '@splitifyd/shared';
import type { ITransaction } from '../../firestore-wrapper';
import { logger } from '../../logger';
import type { GroupBalanceDTO, ParsedCurrencyBalances as CurrencyBalances } from '../../schemas';
import type { IFirestoreWriter } from '../firestore';
import { DebtSimplificationService } from './DebtSimplificationService';
import { ExpenseProcessor } from './ExpenseProcessor';
import { SettlementProcessor } from './SettlementProcessor';
import {GroupId} from "@splitifyd/shared";

export class IncrementalBalanceService {
    private expenseProcessor: ExpenseProcessor;
    private settlementProcessor: SettlementProcessor;
    private debtSimplificationService: DebtSimplificationService;

    constructor(private firestoreWriter: IFirestoreWriter) {
        this.expenseProcessor = new ExpenseProcessor();
        this.settlementProcessor = new SettlementProcessor();
        this.debtSimplificationService = new DebtSimplificationService();
    }

    applyExpenseCreated(transaction: ITransaction, groupId: GroupId, currentBalance: GroupBalanceDTO, expense: ExpenseDTO, memberIds: string[]): void {
        logger.info('Applying expense creation to balance', { groupId, expenseId: expense.id });

        this.firestoreWriter.updateGroupBalanceInTransaction(transaction, groupId, currentBalance, (currentBalance) => {
            const delta = this.expenseProcessor.processExpenses([expense], memberIds);
            const newBalancesByCurrency = this.applyDelta(currentBalance.balancesByCurrency, delta, memberIds, 1);
            const simplifiedDebts = this.debtSimplificationService.simplifyDebtsForAllCurrencies(newBalancesByCurrency);

            return {
                ...currentBalance,
                balancesByCurrency: newBalancesByCurrency,
                simplifiedDebts,
                version: currentBalance.version + 1,
            };
        });
    }

    applyExpenseDeleted(transaction: ITransaction, groupId: GroupId, currentBalance: GroupBalanceDTO, expense: ExpenseDTO, memberIds: string[]): void {
        logger.info('Applying expense deletion to balance', { groupId, expenseId: expense.id });

        this.firestoreWriter.updateGroupBalanceInTransaction(transaction, groupId, currentBalance, (currentBalance) => {
            const delta = this.expenseProcessor.processExpenses([expense], memberIds);
            const newBalancesByCurrency = this.applyDelta(currentBalance.balancesByCurrency, delta, memberIds, -1);
            const simplifiedDebts = this.debtSimplificationService.simplifyDebtsForAllCurrencies(newBalancesByCurrency);

            return {
                ...currentBalance,
                balancesByCurrency: newBalancesByCurrency,
                simplifiedDebts,
                version: currentBalance.version + 1,
            };
        });
    }

    applyExpenseUpdated(transaction: ITransaction, groupId: GroupId, currentBalance: GroupBalanceDTO, oldExpense: ExpenseDTO, newExpense: ExpenseDTO, memberIds: string[]): void {
        logger.info('Applying expense update to balance', { groupId, expenseId: newExpense.id });

        this.firestoreWriter.updateGroupBalanceInTransaction(transaction, groupId, currentBalance, (currentBalance) => {
            const removeDelta = this.expenseProcessor.processExpenses([oldExpense], memberIds);
            const addDelta = this.expenseProcessor.processExpenses([newExpense], memberIds);

            let updatedBalances = this.applyDelta(currentBalance.balancesByCurrency, removeDelta, memberIds, -1);
            updatedBalances = this.applyDelta(updatedBalances, addDelta, memberIds, 1);

            const simplifiedDebts = this.debtSimplificationService.simplifyDebtsForAllCurrencies(updatedBalances);

            return {
                ...currentBalance,
                balancesByCurrency: updatedBalances,
                simplifiedDebts,
                version: currentBalance.version + 1,
            };
        });
    }

    applySettlementCreated(transaction: ITransaction, groupId: GroupId, currentBalance: GroupBalanceDTO, settlement: SettlementDTO, memberIds: string[]): void {
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

    applySettlementDeleted(transaction: ITransaction, groupId: GroupId, currentBalance: GroupBalanceDTO, settlement: SettlementDTO, memberIds: string[]): void {
        this.firestoreWriter.updateGroupBalanceInTransaction(transaction, groupId, currentBalance, (currentBalance) => {
            const balancesByCurrency = JSON.parse(JSON.stringify(currentBalance.balancesByCurrency)) as CurrencyBalances;

            this.ensureMembersInitialized(balancesByCurrency, settlement.currency, memberIds);

            const negatedSettlement: SettlementDTO = {
                ...settlement,
                amount: negateNormalizedAmount(settlement.amount),
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

    applySettlementUpdated(transaction: ITransaction, groupId: GroupId, currentBalance: GroupBalanceDTO, oldSettlement: SettlementDTO, newSettlement: SettlementDTO, memberIds: string[]): void {
        logger.info('Applying settlement update to balance', { groupId, settlementId: newSettlement.id });

        this.firestoreWriter.updateGroupBalanceInTransaction(transaction, groupId, currentBalance, (currentBalance) => {
            const balancesByCurrency = JSON.parse(JSON.stringify(currentBalance.balancesByCurrency)) as CurrencyBalances;

            this.ensureMembersInitialized(balancesByCurrency, oldSettlement.currency, memberIds);
            this.ensureMembersInitialized(balancesByCurrency, newSettlement.currency, memberIds);

            const negatedOldSettlement: SettlementDTO = {
                ...oldSettlement,
                amount: negateAmount(oldSettlement.amount, oldSettlement.currency),
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
                    netBalance: zeroAmount(currency),
                };
            }
        }
    }

    private applyDelta(
        existing: CurrencyBalances,
        delta: CurrencyBalances,
        memberIds: string[],
        sign: 1 | -1,
    ): CurrencyBalances {
        const currencies = new Set<string>([
            ...Object.keys(existing || {}),
            ...Object.keys(delta || {}),
        ]);

        const result: CurrencyBalances = {};

        for (const currency of currencies) {
            const users = new Set<string>(memberIds);

            const existingCurrencyBalances = existing[currency] ?? {};
            const deltaCurrencyBalances = delta[currency] ?? {};

            this.collectUsers(existingCurrencyBalances, users);
            this.collectUsers(deltaCurrencyBalances, users);

            const existingPairs = this.balancesToPairs(existingCurrencyBalances, currency);
            const deltaPairs = this.balancesToPairs(deltaCurrencyBalances, currency);

            for (const [pairKey, units] of deltaPairs.entries()) {
                this.adjustPair(existingPairs, pairKey, units * sign);
            }

            result[currency] = this.pairsToBalances(existingPairs, users, currency);
        }

        return result;
    }

    private collectUsers(currencyBalances: Record<string, UserBalance>, users: Set<string>): void {
        for (const [userId, balance] of Object.entries(currencyBalances)) {
            users.add(userId);
            for (const other of Object.keys(balance.owes ?? {})) {
                users.add(other);
            }
            for (const other of Object.keys(balance.owedBy ?? {})) {
                users.add(other);
            }
        }
    }

    private balancesToPairs(currencyBalances: Record<string, UserBalance>, currency: string): Map<string, number> {
        const pairs = new Map<string, number>();
        for (const [debtorId, balance] of Object.entries(currencyBalances ?? {})) {
            for (const [creditorId, amount] of Object.entries(balance.owes ?? {})) {
                const key = `${debtorId}->${creditorId}`;
                const units = amountToSmallestUnit(amount, currency);
                pairs.set(key, (pairs.get(key) ?? 0) + units);
            }
        }
        return pairs;
    }

    private adjustPair(pairs: Map<string, number>, key: string, deltaUnits: number): void {
        if (deltaUnits === 0) {
            return;
        }

        const current = pairs.get(key) ?? 0;
        const newValue = current + deltaUnits;

        if (newValue > 0) {
            pairs.set(key, newValue);
            return;
        }

        if (newValue === 0) {
            pairs.delete(key);
            return;
        }

        pairs.delete(key);
        const [debtor, creditor] = key.split('->');
        const flippedKey = `${creditor}->${debtor}`;
        const flippedValue = (pairs.get(flippedKey) ?? 0) + (-newValue);
        if (flippedValue === 0) {
            pairs.delete(flippedKey);
        } else {
            pairs.set(flippedKey, flippedValue);
        }
    }

    private pairsToBalances(pairs: Map<string, number>, users: Set<string>, currency: string): Record<string, UserBalance> {
        const zero = zeroAmount(currency);
        const balances: Record<string, UserBalance> = {};

        for (const userId of users) {
            balances[userId] = {
                uid: userId,
                owes: {},
                owedBy: {},
                netBalance: zero,
            };
        }

        for (const [key, units] of pairs.entries()) {
            if (units <= 0) {
                continue;
            }

            const [debtor, creditor] = key.split('->');
            const amount = smallestUnitToAmountString(units, currency);

            if (!balances[debtor]) {
                balances[debtor] = { uid: debtor, owes: {}, owedBy: {}, netBalance: zero };
            }
            if (!balances[creditor]) {
                balances[creditor] = { uid: creditor, owes: {}, owedBy: {}, netBalance: zero };
            }

            balances[debtor].owes[creditor] = amount;
            balances[creditor].owedBy[debtor] = amount;
        }

        for (const balance of Object.values(balances)) {
            const totalOwed = sumAmounts(Object.values(balance.owedBy), currency);
            const totalOwing = sumAmounts(Object.values(balance.owes), currency);
            balance.netBalance = subtractAmounts(totalOwed, totalOwing, currency);
        }

        return balances;
    }
}
