import { Timestamp } from 'firebase-admin/firestore';
import { UserBalance, simplifyDebts } from '../utils/debtSimplifier';
import { GroupBalance } from '../models/groupBalance';
import { logger } from '../logger';
import { db } from '../firebase';
import { userService } from './userService';

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
    const memberIds = groupData.data?.memberIds || [];
    if (memberIds.length === 0) {
        throw new Error(`Group ${groupId} has no members for balance calculation`);
    }
    
    // Fetch user profiles dynamically
    const memberProfiles = await userService.getUsers(memberIds);
    
    logger.info('[BalanceCalculator] Group members', { 
        memberCount: memberIds.length,
        memberIds
    });

    const userBalances: Record<string, UserBalance> = {};

    for (const expense of expenses) {
        const payerId = expense.paidBy;
        
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
                owes: {},
                owedBy: {},
                netBalance: 0
            };
        }

        for (const split of expense.splits) {
            const splitUserId = split.userId;

            if (!userBalances[splitUserId]) {
                userBalances[splitUserId] = {
                    userId: splitUserId,
                    owes: {},
                    owedBy: {},
                    netBalance: 0
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
        userBalances[userId].netBalance = netBalance;
    }

    logger.info('[BalanceCalculator] Final userBalances', { userBalances });
    
    // Create user names map for debt simplification
    const userNames = new Map<string, string>();
    for (const [userId, profile] of memberProfiles) {
        userNames.set(userId, profile.displayName);
    }
    
    const simplifiedDebts = simplifyDebts(userBalances, userNames);

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