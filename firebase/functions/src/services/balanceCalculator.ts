import { Timestamp } from 'firebase-admin/firestore';
import { UserBalance, simplifyDebts } from '../utils/debtSimplifier';
import { GroupBalance } from '../models/groupBalance';
import { logger } from '../logger';
import { db } from '../firebase';
import { userService } from './userService';
import { FirestoreCollections, DELETED_AT_FIELD } from '../shared/shared-types';

export async function calculateGroupBalances(groupId: string): Promise<GroupBalance> {
    logger.info('[BalanceCalculator] Calculating balances', { groupId });
    const expensesSnapshot = await db
        .collection(FirestoreCollections.EXPENSES)
        .where('groupId', '==', groupId)
        .get();

    const expenses = expensesSnapshot.docs
        .map(doc => ({
            id: doc.id,
            ...doc.data()
        }) as any)
        .filter(expense => !expense[DELETED_AT_FIELD]);
    
    logger.info('[BalanceCalculator] Found expenses', { 
        totalExpenses: expensesSnapshot.size,
        nonDeletedExpenses: expenses.length 
    });

    const settlementsSnapshot = await db
        .collection(FirestoreCollections.SETTLEMENTS)
        .where('groupId', '==', groupId)
        .get();

    const settlements = settlementsSnapshot.docs
        .map(doc => ({
            id: doc.id,
            ...doc.data()
        }) as any);
    
    logger.info('[BalanceCalculator] Found settlements', { 
        totalSettlements: settlements.length
    });

    const groupDoc = await db
        .collection(FirestoreCollections.GROUPS)
        .doc(groupId)
        .get();

    if (!groupDoc.exists) {
        throw new Error('Group not found');
    }

    const groupData = groupDoc.data() as any;
    if (!groupData.data?.memberIds) {
        throw new Error('Group missing memberIds - invalid data structure');
    }
    const memberIds = groupData.data.memberIds;
    if (memberIds.length === 0) {
        throw new Error(`Group ${groupId} has no members for balance calculation`);
    }
    
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

    for (const settlement of settlements) {
        const payerId = settlement.payerId;
        const payeeId = settlement.payeeId;
        const amount = settlement.amount;
        
        logger.info('[BalanceCalculator] Processing settlement', {
            settlementId: settlement.id,
            payerId,
            payeeId,
            amount,
            date: settlement.date
        });
        
        if (!userBalances[payerId]) {
            userBalances[payerId] = {
                userId: payerId,
                owes: {},
                owedBy: {},
                netBalance: 0
            };
        }
        
        if (!userBalances[payeeId]) {
            userBalances[payeeId] = {
                userId: payeeId,
                owes: {},
                owedBy: {},
                netBalance: 0
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

    logger.info('[BalanceCalculator] Final userBalances after settlements', { userBalances });
    
    const userNames = new Map<string, string>();
    for (const [userId, profile] of memberProfiles) {
        userNames.set(userId, profile.displayName);
    }
    
    const simplifiedDebts = simplifyDebts(userBalances);

    return {
        groupId,
        userBalances,
        simplifiedDebts,
        lastUpdated: Timestamp.now()
    };
}

