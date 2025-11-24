import type { SimplifiedDebt, UserBalance, UserId } from '@billsplit-wl/shared';
import { Amount, GroupId, negateNormalizedAmount, toGroupId, toISOString, USD, ZERO } from '@billsplit-wl/shared';
import type { CurrencyISOCode } from '@billsplit-wl/shared';
import { toUserId } from '@billsplit-wl/shared';
import { generateShortId } from '@billsplit-wl/test-support';
import type { GroupBalanceDTO } from '../../schemas';

/**
 * Builder for creating GroupBalanceDTO objects for unit testing balance calculations
 * Provides fluent API to construct complex multi-currency balance scenarios
 */
export class GroupBalanceDTOBuilder {
    private balance: GroupBalanceDTO;

    constructor() {
        this.balance = {
            groupId: toGroupId(`group-${generateShortId()}`),
            balancesByCurrency: {},
            simplifiedDebts: [],
            lastUpdatedAt: toISOString(new Date().toISOString()),
            version: 0,
        };
    }

    withGroupId(groupId: GroupId | string): this {
        this.balance.groupId = typeof groupId === 'string' ? toGroupId(groupId) : groupId;
        return this;
    }

    withVersion(version: number): this {
        this.balance.version = version;
        return this;
    }

    withLastUpdatedAt(timestamp: string | Date): this {
        this.balance.lastUpdatedAt = toISOString(typeof timestamp === 'string' ? timestamp : timestamp.toISOString());
        return this;
    }

    /**
     * Add a user balance for a specific currency
     * Creates the currency structure if it doesn't exist
     */
    withUserBalance(currency: CurrencyISOCode | string, userId: UserId, balance: Partial<UserBalance>): this {
        if (!this.balance.balancesByCurrency[currency]) {
            this.balance.balancesByCurrency[currency] = {};
        }

        this.balance.balancesByCurrency[currency][userId] = {
            uid: userId,
            owes: balance.owes || {},
            owedBy: balance.owedBy || {},
            netBalance: balance.netBalance || ZERO,
        };

        return this;
    }

    /**
     * Set complete currency balances structure
     * Useful for complex multi-user scenarios
     */
    withCurrencyBalances(currency: CurrencyISOCode, balances: Record<string, UserBalance>): this {
        this.balance.balancesByCurrency[currency] = { ...balances };
        return this;
    }

    /**
     * Add a simplified debt relationship
     */
    withSimplifiedDebt(debt: SimplifiedDebt): this {
        this.balance.simplifiedDebts.push(debt);
        return this;
    }

    /**
     * Set all simplified debts at once
     */
    withSimplifiedDebts(debts: SimplifiedDebt[]): this {
        this.balance.simplifiedDebts = [...debts];
        return this;
    }

    /**
     * Convenience method: Create simple two-user USD debt
     * User2 owes User1 the specified amount
     */
    withSimpleUSDDebt(user1: string | UserId, user2: string | UserId, amt: Amount | number): this {
        const amount = typeof amt === 'number' ? amt.toString() : amt;

        const uid1 = typeof user1 === 'string' ? toUserId(user1) : user1;
        const uid2 = typeof user2 === 'string' ? toUserId(user2) : user2;

        this
            .withUserBalance('USD', uid1, {
                uid: uid1,
                owes: {},
                owedBy: { [uid2]: amount },
                netBalance: amount,
            });

        this
            .withUserBalance('USD', uid2, {
                uid: uid2,
                owes: { [uid1]: amount },
                owedBy: {},
                netBalance: negateNormalizedAmount(amount),
            });

        this
            .withSimplifiedDebt({
                from: { uid: uid2 },
                to: { uid: uid1 },
                amount,
                currency: USD,
            });

        return this;
    }

    /**
     * Initialize empty balances for a currency with specified users
     * Useful for setting up clean initial state
     */
    withEmptyCurrencyBalances(currency: CurrencyISOCode, userIds: UserId[] | string[]): this {
        if (!this.balance.balancesByCurrency[currency]) {
            this.balance.balancesByCurrency[currency] = {};
        }

        for (const userId of userIds.map(item => typeof item === 'string' ? toUserId(item) : item)) {
            this.balance.balancesByCurrency[currency][userId] = {
                uid: userId,
                owes: {},
                owedBy: {},
                netBalance: ZERO,
            };
        }

        return this;
    }

    build(): GroupBalanceDTO {
        return {
            ...this.balance,
            // Deep copy to prevent mutations
            balancesByCurrency: JSON.parse(JSON.stringify(this.balance.balancesByCurrency)) as Record<string, Record<string, UserBalance>>,
            simplifiedDebts: [...this.balance.simplifiedDebts],
        };
    }
}
