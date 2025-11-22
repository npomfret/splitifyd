import type { Amount, UserBalance, UserId } from '@billsplit-wl/shared';
import { ZERO } from '@billsplit-wl/shared';
import {toUserId} from "@billsplit-wl/shared";

/**
 * Builder for creating UserBalance objects for debt simplification tests
 * Used for creating test scenarios with various debt relationships
 */
export class UserBalanceBuilder {
    private userBalance: UserBalance = {
        uid: toUserId('user1'),
        owes: {},
        owedBy: {},
        netBalance: ZERO,
    };

    withUserId(userId: UserId | string): UserBalanceBuilder {
        this.userBalance.uid = typeof userId === 'string' ? toUserId(userId) : userId;
        return this;
    }

    owesUser(userId: UserId | string, amount: Amount | number): UserBalanceBuilder {
        this.userBalance.owes[typeof userId === 'string' ? toUserId(userId) : userId] = typeof amount === 'number' ? amount.toString() : amount;
        return this;
    }

    owedByUser(userId: UserId | string, amount: Amount | number): UserBalanceBuilder {
        this.userBalance.owedBy[typeof userId === 'string' ? toUserId(userId) : userId] = typeof amount === 'number' ? amount.toString() : amount;
        return this;
    }

    withNetBalance(balance: Amount | number): UserBalanceBuilder {
        this.userBalance.netBalance = typeof balance === 'number' ? balance.toString() : balance;
        return this;
    }

    build(): UserBalance {
        return { ...this.userBalance };
    }
}

/**
 * Factory for common debt test scenarios
 * Provides pre-built configurations for typical debt simplification test cases
 */
export class DebtScenarios {
    /**
     * Simple two-person debt: user1 owes user2 $50
     */
    static simpleTwoPerson(): Record<string, UserBalance> {
        return {
            user1: new UserBalanceBuilder()
                .withUserId('user1')
                .owesUser('user2', 50)
                .build(),
            user2: new UserBalanceBuilder()
                .withUserId('user2')
                .owedByUser('user1', 50)
                .build(),
        };
    }

    /**
     * Reciprocal debts: user1 owes user2 $50, user2 owes user1 $30
     * Should simplify to user1 pays user2 $20
     */
    static reciprocalDebts(): Record<string, UserBalance> {
        return {
            user1: new UserBalanceBuilder()
                .withUserId('user1')
                .owesUser('user2', 50)
                .owedByUser('user2', 30)
                .build(),
            user2: new UserBalanceBuilder()
                .withUserId('user2')
                .owesUser('user1', 30)
                .owedByUser('user1', 50)
                .build(),
        };
    }

    /**
     * Perfect triangular cycle: A→B→C→A (each owes next $30)
     * Should completely eliminate all debts
     */
    static triangularCycle(): Record<string, UserBalance> {
        return {
            user1: new UserBalanceBuilder()
                .withUserId('user1')
                .owesUser('user2', 30)
                .owedByUser('user3', 30)
                .build(),
            user2: new UserBalanceBuilder()
                .withUserId('user2')
                .owesUser('user3', 30)
                .owedByUser('user1', 30)
                .build(),
            user3: new UserBalanceBuilder()
                .withUserId('user3')
                .owesUser('user1', 30)
                .owedByUser('user2', 30)
                .build(),
        };
    }

    /**
     * Perfect 5-user circular debt: A→B→C→D→E→A (each owes next $20)
     * Should completely eliminate all debts
     */
    static fiveUserCircle(): Record<string, UserBalance> {
        return {
            userA: new UserBalanceBuilder()
                .withUserId('userA')
                .owesUser('userB', 20)
                .owedByUser('userE', 20)
                .build(),
            userB: new UserBalanceBuilder()
                .withUserId('userB')
                .owesUser('userC', 20)
                .owedByUser('userA', 20)
                .build(),
            userC: new UserBalanceBuilder()
                .withUserId('userC')
                .owesUser('userD', 20)
                .owedByUser('userB', 20)
                .build(),
            userD: new UserBalanceBuilder()
                .withUserId('userD')
                .owesUser('userE', 20)
                .owedByUser('userC', 20)
                .build(),
            userE: new UserBalanceBuilder()
                .withUserId('userE')
                .owesUser('userA', 20)
                .owedByUser('userD', 20)
                .build(),
        };
    }

    /**
     * Uneven chain: user1 -> user2 -> (user3, user4) split
     */
    static unevenChain(): Record<string, UserBalance> {
        return {
            user1: new UserBalanceBuilder()
                .withUserId('user1')
                .owesUser('user2', 100)
                .build(),
            user2: new UserBalanceBuilder()
                .withUserId('user2')
                .owesUser('user3', 50)
                .owesUser('user4', 50)
                .owedByUser('user1', 100)
                .build(),
            user3: new UserBalanceBuilder()
                .withUserId('user3')
                .owedByUser('user2', 50)
                .build(),
            user4: new UserBalanceBuilder()
                .withUserId('user4')
                .owedByUser('user2', 50)
                .build(),
        };
    }

    /**
     * Asymmetric whale network: one user with large amounts, others with small
     */
    static asymmetricWhale(): Record<string, UserBalance> {
        return {
            whale: new UserBalanceBuilder()
                .withUserId('whale')
                .owedByUser('user1', 1000)
                .owedByUser('user2', 800)
                .owedByUser('user3', 600)
                .build(),
            user1: new UserBalanceBuilder()
                .withUserId('user1')
                .owesUser('whale', 1000)
                .owesUser('user4', 50)
                .build(),
            user2: new UserBalanceBuilder()
                .withUserId('user2')
                .owesUser('whale', 800)
                .owesUser('user4', 30)
                .build(),
            user3: new UserBalanceBuilder()
                .withUserId('user3')
                .owesUser('whale', 600)
                .owesUser('user4', 20)
                .build(),
            user4: new UserBalanceBuilder()
                .withUserId('user4')
                .owedByUser('user1', 50)
                .owedByUser('user2', 30)
                .owedByUser('user3', 20)
                .build(),
        };
    }

    /**
     * All balances zero: users with no outstanding debts
     */
    static allZeroBalances(): Record<string, UserBalance> {
        return {
            user1: new UserBalanceBuilder()
                .withUserId('user1')
                .build(),
            user2: new UserBalanceBuilder()
                .withUserId('user2')
                .build(),
        };
    }

    /**
     * Mixed currency scenarios - returns both USD and EUR balances separately
     */
    static mixedCurrencyScenarios(): { usd: Record<string, UserBalance>; eur: Record<string, UserBalance>; } {
        const usdBalances = {
            user1: new UserBalanceBuilder()
                .withUserId('user1')
                .owesUser('user2', 100)
                .owedByUser('user3', 50)
                .build(),
            user2: new UserBalanceBuilder()
                .withUserId('user2')
                .owesUser('user3', 80)
                .owedByUser('user1', 100)
                .build(),
            user3: new UserBalanceBuilder()
                .withUserId('user3')
                .owesUser('user1', 50)
                .owedByUser('user2', 80)
                .build(),
        };

        const eurBalances = {
            user1: new UserBalanceBuilder()
                .withUserId('user1')
                .owedByUser('user2', 60)
                .build(),
            user2: new UserBalanceBuilder()
                .withUserId('user2')
                .owesUser('user1', 60)
                .owesUser('user3', 40)
                .build(),
            user3: new UserBalanceBuilder()
                .withUserId('user3')
                .owedByUser('user2', 40)
                .build(),
        };

        return { usd: usdBalances, eur: eurBalances };
    }
}
