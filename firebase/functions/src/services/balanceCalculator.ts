import * as admin from 'firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import { UserBalance, simplifyDebts } from '../utils/debtSimplifier';
import { GroupBalance } from '../models/groupBalance';

export async function calculateGroupBalances(groupId: string): Promise<GroupBalance> {
    const expensesSnapshot = await admin.firestore()
        .collection('expenses')
        .where('groupId', '==', groupId)
        .where('deletedAt', '==', null)
        .get();

    const expenses = expensesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    })) as any[];

    const userBalances: Record<string, UserBalance> = {};

    for (const expense of expenses) {
        const payerId = expense.paidBy.userId;
        const payerName = expense.paidBy.name;

        if (!userBalances[payerId]) {
            userBalances[payerId] = {
                userId: payerId,
                name: payerName,
                owes: {},
                owedBy: {}
            };
        }

        for (const split of expense.splits) {
            const splitUserId = split.userId;
            const splitUserName = split.name;

            if (!userBalances[splitUserId]) {
                userBalances[splitUserId] = {
                    userId: splitUserId,
                    name: splitUserName,
                    owes: {},
                    owedBy: {}
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

    const netBalances: Record<string, number> = {};
    for (const userId in userBalances) {
        const user = userBalances[userId];
        let netBalance = 0;
        
        for (const amount of Object.values(user.owes)) {
            netBalance -= amount;
        }
        
        for (const amount of Object.values(user.owedBy)) {
            netBalance += amount;
        }
        
        netBalances[userId] = netBalance;
        userBalances[userId] = {
            ...user,
            netBalance: netBalance
        } as any;
    }

    const simplifiedDebts = simplifyDebts(userBalances);

    return {
        groupId,
        userBalances,
        simplifiedDebts,
        lastUpdated: Timestamp.now()
    };
}

export async function updateGroupBalances(groupId: string): Promise<void> {
    const balances = await calculateGroupBalances(groupId);
    
    await admin.firestore()
        .collection('group-balances')
        .doc(groupId)
        .set(balances);
}