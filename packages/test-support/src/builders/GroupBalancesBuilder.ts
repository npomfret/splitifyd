import type { GroupBalances, SimplifiedDebt } from '@splitifyd/shared';

/**
 * Extended UserBalance with optional displayName and balances fields
 * Used in UI display of user balances
 */
interface ExtendedUserBalance {
    uid: string;
    displayName?: string;
    owes: Record<string, number>;
    owedBy: Record<string, number>;
    netBalance: number;
    balances?: Record<string, number>;
}

/**
 * Builder for creating GroupBalances objects for testing
 * Used to construct balance data for group detail displays
 */
export class GroupBalancesBuilder {
    private balances: GroupBalances & {
        userBalances: Record<string, ExtendedUserBalance>;
        simplifiedDebts: Array<
            SimplifiedDebt & {
                from: { uid: string; displayName?: string };
                to: { uid: string; displayName?: string };
            }
        >;
    };

    constructor() {
        this.balances = {
            groupId: 'default-group-id',
            lastUpdated: new Date().toISOString(),
            userBalances: {},
            simplifiedDebts: [],
            balancesByCurrency: {},
        };
    }

    /**
     * Set the group ID
     */
    withGroupId(groupId: string): this {
        this.balances.groupId = groupId;
        return this;
    }

    /**
     * Set the last updated timestamp
     */
    withLastUpdated(timestamp: string | Date): this {
        this.balances.lastUpdated = timestamp instanceof Date ? timestamp.toISOString() : timestamp;
        return this;
    }

    /**
     * Add a user balance entry
     */
    addUserBalance(
        uid: string,
        options: {
            displayName?: string;
            owes?: Record<string, number>;
            owedBy?: Record<string, number>;
            netBalance?: number;
            balances?: Record<string, number>;
        } = {},
    ): this {
        this.balances.userBalances[uid] = {
            uid,
            displayName: options.displayName,
            owes: options.owes || {},
            owedBy: options.owedBy || {},
            netBalance: options.netBalance || 0,
            balances: options.balances || {},
        };
        return this;
    }

    /**
     * Add a simplified debt entry
     */
    addSimplifiedDebt(from: { uid: string; displayName?: string }, to: { uid: string; displayName?: string }, amount: number, currency: string = 'USD'): this {
        this.balances.simplifiedDebts.push({
            from,
            to,
            amount,
            currency,
        });
        return this;
    }

    /**
     * Set balances by currency
     */
    withBalancesByCurrency(balancesByCurrency: Record<string, Record<string, any>>): this {
        this.balances.balancesByCurrency = balancesByCurrency;
        return this;
    }

    /**
     * Convenience method: Set up a simple two-person debt scenario
     * User 'from' owes user 'to' the specified amount
     */
    withSimpleTwoPersonDebt(fromUid: string, fromName: string, toUid: string, toName: string, amount: number, currency: string = 'USD'): this {
        // Add user balances
        this.addUserBalance(fromUid, {
            displayName: fromName,
            netBalance: -amount,
            owes: { [toUid]: amount },
            owedBy: {},
        });

        this.addUserBalance(toUid, {
            displayName: toName,
            netBalance: amount,
            owes: {},
            owedBy: { [fromUid]: amount },
        });

        // Add simplified debt
        this.addSimplifiedDebt({ uid: fromUid, displayName: fromName }, { uid: toUid, displayName: toName }, amount, currency);

        return this;
    }

    /**
     * Convenience method: Set up a scenario with no debts (all settled up)
     */
    withNoDebts(...users: Array<{ uid: string; displayName: string }>): this {
        users.forEach((user) => {
            this.addUserBalance(user.uid, {
                displayName: user.displayName,
                netBalance: 0,
                owes: {},
                owedBy: {},
            });
        });
        return this;
    }

    build(): GroupBalances & {
        userBalances: Record<string, ExtendedUserBalance>;
        simplifiedDebts: Array<
            SimplifiedDebt & {
                from: { uid: string; displayName?: string };
                to: { uid: string; displayName?: string };
            }
        >;
    } {
        return {
            ...this.balances,
            userBalances: { ...this.balances.userBalances },
            simplifiedDebts: [...this.balances.simplifiedDebts],
        };
    }
}
