import { Timestamp } from 'firebase-admin/firestore';
import { UserBalance, simplifyDebts } from '../utils/debtSimplifier';
import { GroupBalance } from '../models/groupBalance';
import { db } from '../firebase';
import { userService } from './userService';
import { FirestoreCollections, DELETED_AT_FIELD } from '../shared/shared-types';

export async function calculateGroupBalances(groupId: string): Promise<GroupBalance> {
    // Calculating balances for group
    const expensesSnapshot = await db.collection(FirestoreCollections.EXPENSES).where('groupId', '==', groupId).get();

    const expenses = expensesSnapshot.docs
        .map(
            (doc) =>
                ({
                    id: doc.id,
                    ...doc.data(),
                }) as any,
        )
        .filter((expense) => !expense[DELETED_AT_FIELD]);

    // Found expenses

    const settlementsSnapshot = await db.collection(FirestoreCollections.SETTLEMENTS).where('groupId', '==', groupId).get();

    const settlements = settlementsSnapshot.docs.map(
        (doc) =>
            ({
                id: doc.id,
                ...doc.data(),
            }) as any,
    );

    // Found settlements

    const groupDoc = await db.collection(FirestoreCollections.GROUPS).doc(groupId).get();

    if (!groupDoc.exists) {
        throw new Error('Group not found');
    }

    const groupData = groupDoc.data() as any;
    if (!groupData.data?.members) {
        throw new Error('Group missing members - invalid data structure');
    }
    const memberIds = Object.keys(groupData.data.members);
    if (memberIds.length === 0) {
        throw new Error(`Group ${groupId} has no members for balance calculation`);
    }

    const memberProfiles = await userService.getUsers(memberIds);

    // Processing group members

    // Track balances per currency
    const balancesByCurrency: Record<string, Record<string, UserBalance>> = {};

    // Group expenses by currency - every expense MUST have a currency
    const expensesByCurrency = expenses.reduce(
        (acc, expense) => {
            if (!expense.currency) {
                throw new Error(`Expense ${expense.id} is missing currency - invalid state`);
            }
            const currency = expense.currency;
            if (!acc[currency]) {
                acc[currency] = [];
            }
            acc[currency].push(expense);
            return acc;
        },
        {} as Record<string, any[]>,
    );

    // Group settlements by currency - every settlement MUST have a currency
    const settlementsByCurrency = settlements.reduce(
        (acc, settlement) => {
            if (!settlement.currency) {
                throw new Error(`Settlement ${settlement.id} is missing currency - invalid state`);
            }
            const currency = settlement.currency;
            if (!acc[currency]) {
                acc[currency] = [];
            }
            acc[currency].push(settlement);
            return acc;
        },
        {} as Record<string, any[]>,
    );

    // Get all unique currencies
    const allCurrencies = new Set([...Object.keys(expensesByCurrency), ...Object.keys(settlementsByCurrency)]);

    // Process expenses for each currency
    for (const currency of allCurrencies) {
        if (!balancesByCurrency[currency]) {
            balancesByCurrency[currency] = {};
        }

        const currencyExpenses = expensesByCurrency[currency] || [];
        const userBalances = balancesByCurrency[currency];

        for (const expense of currencyExpenses) {
            const payerId = expense.paidBy;

            // Processing expense

            if (!userBalances[payerId]) {
                userBalances[payerId] = {
                    userId: payerId,
                    owes: {},
                    owedBy: {},
                    netBalance: 0,
                };
            }

            for (const split of expense.splits) {
                const splitUserId = split.userId;

                if (!userBalances[splitUserId]) {
                    userBalances[splitUserId] = {
                        userId: splitUserId,
                        owes: {},
                        owedBy: {},
                        netBalance: 0,
                    };
                }

                if (payerId !== splitUserId) {
                    if (!userBalances[splitUserId].owes[payerId]) {
                        userBalances[splitUserId].owes[payerId] = 0;
                    }
                    userBalances[splitUserId].owes[payerId] += split.amount;

                    if (!userBalances[payerId].owedBy[splitUserId]) {
                        userBalances[payerId].owedBy[splitUserId] = 0;
                    }
                    userBalances[payerId].owedBy[splitUserId] += split.amount;
                }
            }
        }

        // Process settlements for this currency
        const currencySettlements = settlementsByCurrency[currency] || [];

        for (const settlement of currencySettlements) {
            const payerId = settlement.payerId;
            const payeeId = settlement.payeeId;
            const amount = settlement.amount;

            // Processing settlement

            if (!userBalances[payerId]) {
                userBalances[payerId] = {
                    userId: payerId,
                    owes: {},
                    owedBy: {},
                    netBalance: 0,
                };
            }

            if (!userBalances[payeeId]) {
                userBalances[payeeId] = {
                    userId: payeeId,
                    owes: {},
                    owedBy: {},
                    netBalance: 0,
                };
            }

            if (userBalances[payerId].owes[payeeId]) {
                const reduction = Math.min(userBalances[payerId].owes[payeeId], amount);
                userBalances[payerId].owes[payeeId] -= reduction;

                if (userBalances[payerId].owes[payeeId] <= 0.01) {
                    delete userBalances[payerId].owes[payeeId];
                }

                if (userBalances[payeeId].owedBy[payerId]) {
                    userBalances[payeeId].owedBy[payerId] -= reduction;
                    if (userBalances[payeeId].owedBy[payerId] <= 0.01) {
                        delete userBalances[payeeId].owedBy[payerId];
                    }
                }

                const excess = amount - reduction;
                if (excess > 0.01) {
                    if (!userBalances[payeeId].owes[payerId]) {
                        userBalances[payeeId].owes[payerId] = 0;
                    }
                    userBalances[payeeId].owes[payerId] += excess;

                    if (!userBalances[payerId].owedBy[payeeId]) {
                        userBalances[payerId].owedBy[payeeId] = 0;
                    }
                    userBalances[payerId].owedBy[payeeId] += excess;
                }
            } else {
                if (!userBalances[payeeId].owes[payerId]) {
                    userBalances[payeeId].owes[payerId] = 0;
                }
                userBalances[payeeId].owes[payerId] += amount;

                if (!userBalances[payerId].owedBy[payeeId]) {
                    userBalances[payerId].owedBy[payeeId] = 0;
                }
                userBalances[payerId].owedBy[payeeId] += amount;
            }
        }
    }

    // Calculate net balances for each currency
    for (const currency of allCurrencies) {
        const currencyUserBalances = balancesByCurrency[currency];
        for (const userId in currencyUserBalances) {
            const user = currencyUserBalances[userId];
            let netBalance = 0;

            for (const amount of Object.values(user.owes)) {
                netBalance -= amount;
            }

            for (const amount of Object.values(user.owedBy)) {
                netBalance += amount;
            }

            currencyUserBalances[userId].netBalance = netBalance;
        }
    }

    // Populate userBalances from first available currency
    // This is for the single-currency userBalances API response
    const userBalances: Record<string, UserBalance> = {};
    if (allCurrencies.size > 0) {
        const firstCurrency = Array.from(allCurrencies)[0];
        if (balancesByCurrency[firstCurrency]) {
            Object.assign(userBalances, balancesByCurrency[firstCurrency]);
        }
    }

    // Calculated final balances

    const userNames = new Map<string, string>();
    for (const [userId, profile] of memberProfiles) {
        userNames.set(userId, profile.displayName);
    }

    // Create simplified debts for each currency
    const allSimplifiedDebts: any[] = [];
    for (const currency of allCurrencies) {
        const currencyBalances = balancesByCurrency[currency];
        if (currencyBalances) {
            const currencyDebts = simplifyDebts(currencyBalances, currency);
            allSimplifiedDebts.push(...currencyDebts);
        }
    }

    return {
        groupId,
        userBalances,
        simplifiedDebts: allSimplifiedDebts,
        lastUpdated: Timestamp.now(),
        balancesByCurrency,
    };
}
