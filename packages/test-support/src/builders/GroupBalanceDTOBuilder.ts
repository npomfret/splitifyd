import type { SimplifiedDebt, UserBalance } from '@splitifyd/shared';
import { generateShortId } from '../test-helpers';

/**
 * Group balance DTO structure for testing
 * Matches the GroupBalanceDTO type from firebase/functions/src/schemas
 */
interface GroupBalanceDTO {
    groupId: string;
    balancesByCurrency: Record<string, Record<string, UserBalance>>;
    simplifiedDebts: SimplifiedDebt[];
    lastUpdatedAt: string;
    version: number;
}

/**
 * Builder for creating GroupBalanceDTO objects for unit testing balance calculations
 * Provides fluent API to construct complex multi-currency balance scenarios
 */
export class GroupBalanceDTOBuilder {
    private balance: GroupBalanceDTO;

    constructor(groupId?: string) {
        this.balance = {
            groupId: groupId || `group-${generateShortId()}`,
            balancesByCurrency: {},
            simplifiedDebts: [],
            lastUpdatedAt: new Date().toISOString(),
            version: 0,
        };
    }

    withGroupId(groupId: string): this {
        this.balance.groupId = groupId;
        return this;
    }

    withVersion(version: number): this {
        this.balance.version = version;
        return this;
    }

    withLastUpdatedAt(timestamp: string | Date): this {
        this.balance.lastUpdatedAt = typeof timestamp === 'string' ? timestamp : timestamp.toISOString();
        return this;
    }

    /**
     * Add a user balance for a specific currency
     * Creates the currency structure if it doesn't exist
     */
    withUserBalance(currency: string, userId: string, balance: Partial<UserBalance>): this {
        if (!this.balance.balancesByCurrency[currency]) {
            this.balance.balancesByCurrency[currency] = {};
        }

        this.balance.balancesByCurrency[currency][userId] = {
            uid: userId,
            owes: balance.owes || {},
            owedBy: balance.owedBy || {},
            netBalance: balance.netBalance || 0,
        };

        return this;
    }

    /**
     * Set complete currency balances structure
     * Useful for complex multi-user scenarios
     */
    withCurrencyBalances(currency: string, balances: Record<string, UserBalance>): this {
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
    withSimpleUSDDebt(user1: string, user2: string, amount: number): this {
        this.withUserBalance('USD', user1, {
            uid: user1,
            owes: {},
            owedBy: { [user2]: amount },
            netBalance: amount,
        });

        this.withUserBalance('USD', user2, {
            uid: user2,
            owes: { [user1]: amount },
            owedBy: {},
            netBalance: -amount,
        });

        this.withSimplifiedDebt({
            from: { uid: user2 },
            to: { uid: user1 },
            amount,
            currency: 'USD',
        });

        return this;
    }

    /**
     * Initialize empty balances for a currency with specified users
     * Useful for setting up clean initial state
     */
    withEmptyCurrencyBalances(currency: string, userIds: string[]): this {
        if (!this.balance.balancesByCurrency[currency]) {
            this.balance.balancesByCurrency[currency] = {};
        }

        for (const userId of userIds) {
            this.balance.balancesByCurrency[currency][userId] = {
                uid: userId,
                owes: {},
                owedBy: {},
                netBalance: 0,
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
