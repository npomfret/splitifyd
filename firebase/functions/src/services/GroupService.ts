import * as admin from 'firebase-admin';
import { firestoreDb } from '../firebase';
import { Errors } from '../utils/errors';
import { Group, GroupWithBalance } from '../types/group-types';
import { FirestoreCollections } from '@splitifyd/shared';
import { calculateGroupBalances } from './balance';
import { calculateExpenseMetadata } from './expenseMetadataService';
import { transformGroupDocument } from '../groups/handlers';
import { isGroupOwner, isGroupMember } from '../utils/groupHelpers';

/**
 * Service for managing group operations
 */
export class GroupService {

    /**
     * Get the groups collection reference
     */
    private getGroupsCollection() {
        return firestoreDb.collection(FirestoreCollections.GROUPS);
    }

    /**
     * Add computed fields to Group (balance, last activity)
     */
    private async addComputedFields(group: Group, userId: string): Promise<Group> {
        // Calculate real balance for the user
        const groupBalances = await calculateGroupBalances(group.id);

        // Calculate expense metadata on-demand
        const expenseMetadata = await calculateExpenseMetadata(group.id);

        // Calculate currency-specific balances
        const balancesByCurrency: Record<string, any> = {};
        if (groupBalances.balancesByCurrency) {
            for (const [currency, currencyBalances] of Object.entries(groupBalances.balancesByCurrency)) {
                const currencyUserBalance = currencyBalances[userId];
                if (currencyUserBalance && Math.abs(currencyUserBalance.netBalance) > 0.01) {
                    balancesByCurrency[currency] = {
                        currency,
                        netBalance: currencyUserBalance.netBalance,
                        totalOwed: currencyUserBalance.netBalance > 0 ? currencyUserBalance.netBalance : 0,
                        totalOwing: currencyUserBalance.netBalance < 0 ? Math.abs(currencyUserBalance.netBalance) : 0,
                    };
                }
            }
        }

        return {
            ...group,
            balance: {
                balancesByCurrency,
            },
            lastActivity: expenseMetadata.lastExpenseTime ? `Last expense ${expenseMetadata.lastExpenseTime.toLocaleDateString()}` : 'No recent activity',
            lastActivityRaw: expenseMetadata.lastExpenseTime ? expenseMetadata.lastExpenseTime.toISOString() : group.createdAt,
        };
    }

    /**
     * Fetch a group and verify user access
     */
    private async fetchGroupWithAccess(groupId: string, userId: string, requireWriteAccess: boolean = false): Promise<{ docRef: admin.firestore.DocumentReference; group: Group }> {
        const docRef = this.getGroupsCollection().doc(groupId);
        const doc = await docRef.get();

        if (!doc.exists) {
            throw Errors.NOT_FOUND('Group');
        }

        const group = transformGroupDocument(doc);

        // Check if user is the owner
        if (isGroupOwner(group, userId)) {
            const groupWithComputed = await this.addComputedFields(group, userId);
            return { docRef, group: groupWithComputed };
        }

        // For write operations, only the owner is allowed
        if (requireWriteAccess) {
            throw Errors.FORBIDDEN();
        }

        // For read operations, check if user is a member
        if (isGroupMember(group, userId)) {
            const groupWithComputed = await this.addComputedFields(group, userId);
            return { docRef, group: groupWithComputed };
        }

        // User doesn't have access to this group
        // SECURITY: Return 404 instead of 403 to prevent information disclosure.
        // This prevents attackers from enumerating valid group IDs.
        throw Errors.NOT_FOUND('Group');
    }

    /**
     * Get a single group by ID with user-specific balance information
     */
    async getGroup(groupId: string, userId: string): Promise<GroupWithBalance> {
        const { group } = await this.fetchGroupWithAccess(groupId, userId);

        // Calculate balance information on-demand
        const groupBalances = await calculateGroupBalances(groupId);

        // Calculate currency-specific balances
        const balancesByCurrency: Record<string, any> = {};
        if (groupBalances.balancesByCurrency) {
            for (const [currency, currencyBalances] of Object.entries(groupBalances.balancesByCurrency)) {
                const currencyUserBalance = currencyBalances[userId];
                if (currencyUserBalance && Math.abs(currencyUserBalance.netBalance) > 0.01) {
                    balancesByCurrency[currency] = {
                        currency,
                        netBalance: currencyUserBalance.netBalance,
                        totalOwed: currencyUserBalance.netBalance > 0 ? currencyUserBalance.netBalance : 0,
                        totalOwing: currencyUserBalance.netBalance < 0 ? Math.abs(currencyUserBalance.netBalance) : 0,
                    };
                }
            }
        }

        // Get user's balance from first available currency
        let userBalance: any = null;
        if (groupBalances.balancesByCurrency) {
            const currencyBalances = Object.values(groupBalances.balancesByCurrency)[0];

            if (currencyBalances && currencyBalances[userId]) {
                const balance = currencyBalances[userId];
                userBalance = {
                    netBalance: balance.netBalance,
                    totalOwed: balance.netBalance > 0 ? balance.netBalance : 0,
                    totalOwing: balance.netBalance < 0 ? Math.abs(balance.netBalance) : 0,
                };
            }
        }

        const groupWithBalance: GroupWithBalance = {
            ...group,
            balance: {
                userBalance,
                balancesByCurrency,
            },
        };

        return groupWithBalance;
    }
}

// Create and export singleton instance
export const groupService = new GroupService();