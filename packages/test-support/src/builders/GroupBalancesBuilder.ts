import { Amount, type CurrencyISOCode, GroupBalances, GroupId, ISOString, negateNormalizedAmount, toCurrencyISOCode, toGroupId, toUserId, UserBalance, type UserId, ZERO } from '@billsplit-wl/shared';
import { convertToISOString } from '../test-helpers';

const ensureAmount = (value?: Amount | number): Amount => {
    if (value === undefined) {
        return ZERO;
    }
    return typeof value === 'number' ? value.toString() : value;
};

const ensureAmountMap = (map?: Record<string, Amount | number>): Record<UserId, Amount> => {
    if (!map) {
        return {};
    }
    return Object.fromEntries(
        Object.entries(map).map(([key, amount]) => [toUserId(key), ensureAmount(amount)]),
    ) as Record<UserId, Amount>;
};

/**
 * Builder for creating GroupBalances objects for testing
 * Used to construct balance data for group detail displays
 */
export class GroupBalancesBuilder {
    private balances: GroupBalances;

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
        uid: string | UserId,
        options: {
            owes?: Record<string, Amount | number>;
            owedBy?: Record<string, Amount | number>;
            netBalance?: Amount | number;
        } = {},
    ): this {
        const userId = typeof uid === 'string' ? toUserId(uid) : uid;

        this.balances.userBalances[userId] = {
            uid: userId,
            owes: ensureAmountMap(options.owes),
            owedBy: ensureAmountMap(options.owedBy),
            netBalance: ensureAmount(options.netBalance),
        };
        return this;
    }

    /**
     * Add a simplified debt entry
     */
    addSimplifiedDebt(
        fromUid: string | UserId,
        toUid: string | UserId,
        amount: Amount | number,
        currency: CurrencyISOCode | string,
    ): this {
        const from = typeof fromUid === 'string' ? toUserId(fromUid) : fromUid;
        const to = typeof toUid === 'string' ? toUserId(toUid) : toUid;
        const amt = ensureAmount(amount);
        const curr = typeof currency === 'string' ? toCurrencyISOCode(currency) : currency;

        this.balances.simplifiedDebts.push({
            from: { uid: from },
            to: { uid: to },
            amount: amt,
            currency: curr,
        });
        return this;
    }

    withBalancesByCurrency(
        balancesByCurrency: Record<string, Record<string, Partial<UserBalance> & { owes?: Record<string, Amount | number>; owedBy?: Record<string, Amount | number>; netBalance?: Amount | number; }>>,
    ): this {
        const normalized: Record<string, Record<UserId, UserBalance>> = {};

        for (const [currency, userBalances] of Object.entries(balancesByCurrency)) {
            normalized[currency] = {};
            for (const [uid, balance] of Object.entries(userBalances)) {
                const userId = balance.uid ?? toUserId(uid);
                normalized[currency][userId] = {
                    uid: userId,
                    owes: ensureAmountMap(balance.owes),
                    owedBy: ensureAmountMap(balance.owedBy),
                    netBalance: ensureAmount(balance.netBalance),
                };
            }
        }

        this.balances.balancesByCurrency = normalized;
        return this;
    }

    /**
     * Convenience method: Set up a simple two-person debt scenario
     * User 'from' owes user 'to' the specified amount
     *
     * Note: fromDisplayName and toDisplayName parameters are ignored for backward compatibility.
     * Display names should come from the group members list, not from balance data.
     */
    withSimpleTwoPersonDebt(
        fromUid: string | UserId,
        fromDisplayName: string | undefined,
        toUid: string | UserId,
        toDisplayName: string | undefined,
        amount: Amount | number,
        currency: CurrencyISOCode | string,
    ): this {
        const amt: Amount = ensureAmount(amount);
        const from = typeof fromUid === 'string' ? toUserId(fromUid) : fromUid;
        const to = typeof toUid === 'string' ? toUserId(toUid) : toUid;

        // Add user balances
        this.addUserBalance(from, {
            netBalance: negateNormalizedAmount(amt),
            owes: { [to]: amt },
            owedBy: {},
        });

        this.addUserBalance(to, {
            netBalance: amt,
            owes: {},
            owedBy: { [from]: amt },
        });

        // Add simplified debt
        this.addSimplifiedDebt(from, to, amt, currency);

        return this;
    }

    /**
     * Convenience method: Set up a scenario with no debts (all settled up)
     */
    withNoDebts(...users: Array<{ uid: string | UserId; }>): this {
        users.forEach((user) => {
            this.addUserBalance(user.uid, {
                netBalance: ZERO,
                owes: {},
                owedBy: {},
            });
        });
        return this;
    }

    build(): GroupBalances {
        return {
            ...this.balances,
            userBalances: { ...this.balances.userBalances },
            simplifiedDebts: [...this.balances.simplifiedDebts],
            balancesByCurrency: { ...this.balances.balancesByCurrency },
        };
    }
}
