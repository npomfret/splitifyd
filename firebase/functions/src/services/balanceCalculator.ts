import { Timestamp } from 'firebase-admin/firestore';
import { UserBalance, simplifyDebts } from '../utils/debtSimplifier';
import { GroupBalance } from '../models/groupBalance';
import { logger } from '../logger';
import { db } from '../firebase';
import { User } from '../types/webapp-shared-types';

export async function calculateGroupBalances(groupId: string): Promise<GroupBalance> {
    logger.info('[BalanceCalculator] Calculating balances', { groupId });
    const expensesSnapshot = await db
        .collection('expenses')
        .where('groupId', '==', groupId)
        .get();

    const expenses = expensesSnapshot.docs
        .map(doc => ({
            id: doc.id,
            ...doc.data()
        }) as any)
        .filter(expense => !expense.deletedAt);
    
    logger.info('[BalanceCalculator] Found expenses', { 
        totalExpenses: expensesSnapshot.size,
        nonDeletedExpenses: expenses.length 
    });

    const groupDoc = await db
        .collection('documents')
        .doc(groupId)
        .get();

    if (!groupDoc.exists) {
        throw new Error('Group not found');
    }

    const groupData = groupDoc.data() as any;
    const members = groupData.data?.members || [];
    if (members.length === 0) {
        throw new Error(`Group ${groupId} has no members for balance calculation`);
    }
    const memberMap: Record<string, string> = {};
    
    logger.info('[BalanceCalculator] Group members', { 
        memberCount: members.length,
        members: members.map((m: User) => ({ uid: m.uid, name: m.displayName }))
    });

    for (const member of members) {
        memberMap[member.uid] = member.displayName;
    }

    const userBalances: Record<string, UserBalance> = {};

    for (const expense of expenses) {
        const payerId = expense.paidBy;
        const payerName = memberMap[payerId] || 'Unknown User';
        
        logger.info('[BalanceCalculator] Processing expense', {
            expenseId: expense.id,
            description: expense.description,
            amount: expense.amount,
            paidBy: payerId,
            participants: expense.participants,
            splits: expense.splits
        });

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
            const splitUserName = memberMap[splitUserId] || 'Unknown User';

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

    logger.info('[BalanceCalculator] Final userBalances', { userBalances });
    
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
    
    await db
        .collection('group-balances')
        .doc(groupId)
        .set(balances);
}