import type { GroupBalances, ISOString, SimplifiedDebt, UserBalance } from '@splitifyd/shared';
import { Amount } from '@splitifyd/shared';
import { negateNormalizedAmount, ZERO } from '@splitifyd/shared';
import { GroupId } from '@splitifyd/shared';
import { DisplayName } from '@splitifyd/shared';
import type { CurrencyISOCode } from '@splitifyd/shared';
import { toGroupId } from '@splitifyd/shared';
import { convertToISOString } from '../test-helpers';

/**
 * Extended UserBalance with optional displayName and balances fields
 * Used in UI display of user balances
 */
interface ExtendedUserBalance {
    uid: string;
    displayName?: string;
    owes: Record<string, Amount>;
    owedBy: Record<string, Amount>;
    netBalance: Amount;
    balances?: Record<string, Amount>;
}

const ensureAmount = (value?: Amount | number): Amount => {
    if (value === undefined) {
        return ZERO;
    }
    return typeof value === 'number' ? value.toString() : value;
};

const ensureAmountMap = (map?: Record<string, Amount | number>): Record<string, Amount> => {
    if (!map) {
        return {};
    }
    return Object.fromEntries(
        Object.entries(map).map(([key, amount]) => [key, ensureAmount(amount)]),
    );
};

/**
 * Builder for creating GroupBalances objects for testing
 * Used to construct balance data for group detail displays
 */
export class GroupBalancesBuilder {
    private balances: GroupBalances & {
        userBalances: Record<string, ExtendedUserBalance>;
        simplifiedDebts: Array<
            SimplifiedDebt & {
                from: { uid: string; displayName?: string; };
                to: { uid: string; displayName?: string; };
            }
        >;
    };

    constructor() {
        this.balances = {
            groupId: toGroupId('default-group-id'),
            lastUpdated: convertToISOString(new Date()),
            userBalances: {},
            simplifiedDebts: [],
            balancesByCurrency: {},
        };
    }

    /**
     * Set the group ID
     */
    withGroupId(groupId: GroupId | string): this {
        this.balances.groupId = typeof groupId === 'string' ? toGroupId(groupId) : groupId;
        return this;
    }

    /**
     * Set the last updated timestamp
     */
    withLastUpdated(timestamp: Date | string | ISOString): this {
        this.balances.lastUpdated = convertToISOString(timestamp);
        return this;
    }

    /**
     * Add a user balance entry
     */
    addUserBalance(
        uid: string,
        options: {
            displayName?: string;
            owes?: Record<string, Amount>;
            owedBy?: Record<string, Amount>;
            netBalance?: Amount;
            balances?: Record<string, Amount>;
        } = {},
    ): this {
        this.balances.userBalances[uid] = {
            uid,
            displayName: options.displayName,
            owes: ensureAmountMap(options.owes),
            owedBy: ensureAmountMap(options.owedBy),
            netBalance: ensureAmount(options.netBalance),
            balances: ensureAmountMap(options.balances),
        };
        return this;
    }

    /**
     * Add a simplified debt entry
     */
    addSimplifiedDebt(from: { uid: string; displayName?: string; }, to: { uid: string; displayName?: string; }, amount: Amount, currency: CurrencyISOCode = 'USD'): this {
        this.balances.simplifiedDebts.push({
            from,
            to,
            amount,
            currency,
        });
        return this;
    }

    withBalancesByCurrency(
        balancesByCurrency: Record<string, Record<string, Partial<UserBalance> & { balances?: Record<string, Amount | number>; displayName?: string; }>>,
    ): this {
        const normalized: Record<string, Record<string, UserBalance>> = {};

        for (const [currency, userBalances] of Object.entries(balancesByCurrency)) {
            normalized[currency] = {};
            for (const [uid, balance] of Object.entries(userBalances)) {
                normalized[currency][uid] = {
                    uid: balance.uid ?? uid,
                    owes: ensureAmountMap(balance.owes as Record<string, Amount | number> | undefined),
                    owedBy: ensureAmountMap(balance.owedBy as Record<string, Amount | number> | undefined),
                    netBalance: ensureAmount(balance.netBalance as Amount | number | undefined),
                };
            }
        }

        this.balances.balancesByCurrency = normalized;
        return this;
    }

    /**
     * Convenience method: Set up a simple two-person debt scenario
     * User 'from' owes user 'to' the specified amount
     */
    withSimpleTwoPersonDebt(fromUid: string, fromName: string, toUid: string, toName: string, amount: Amount | number, currency: CurrencyISOCode = 'USD'): this {
        const amt: Amount = typeof amount === 'number' ? amount.toString() : amount;

        // Add user balances
        this.addUserBalance(fromUid, {
            displayName: fromName,
            netBalance: negateNormalizedAmount(amt),
            owes: { [toUid]: amt },
            owedBy: {},
        });

        this.addUserBalance(toUid, {
            displayName: toName,
            netBalance: amt,
            owes: {},
            owedBy: { [fromUid]: amt },
        });

        // Add simplified debt
        this.addSimplifiedDebt({ uid: fromUid, displayName: fromName }, { uid: toUid, displayName: toName }, amt, currency);

        return this;
    }

    /**
     * Convenience method: Set up a scenario with no debts (all settled up)
     */
    withNoDebts(...users: Array<{ uid: string; displayName: DisplayName; }>): this {
        users.forEach((user) => {
            this.addUserBalance(user.uid, {
                displayName: user.displayName,
                netBalance: ZERO,
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
                from: { uid: string; displayName?: string; };
                to: { uid: string; displayName?: string; };
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
