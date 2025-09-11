// UserBalance interface from firebase functions
interface UserBalance {
    userId: string;
    owes: Record<string, number>;
    owedBy: Record<string, number>;
    netBalance: number;
}

/**
 * Builder for creating UserBalance objects for debt simplification tests
 * Used for creating test scenarios with various debt relationships
 */
export class UserBalanceBuilder {
    private userBalance: UserBalance = {
        userId: 'user1',
        owes: {},
        owedBy: {},
        netBalance: 0,
    };

    withUserId(userId: string): UserBalanceBuilder {
        this.userBalance.userId = userId;
        return this;
    }

    owesUser(userId: string, amount: number): UserBalanceBuilder {
        this.userBalance.owes[userId] = amount;
        return this;
    }

    owedByUser(userId: string, amount: number): UserBalanceBuilder {
        this.userBalance.owedBy[userId] = amount;
        return this;
    }

    withNetBalance(balance: number): UserBalanceBuilder {
        this.userBalance.netBalance = balance;
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
            user1: new UserBalanceBuilder().withUserId('user1').owesUser('user2', 50).build(),
            user2: new UserBalanceBuilder().withUserId('user2').owedByUser('user1', 50).build(),
        };
    }

    /**
     * Reciprocal debts: user1 owes user2 $50, user2 owes user1 $30
     * Should simplify to user1 pays user2 $20
     */
    static reciprocalDebts(): Record<string, UserBalance> {
        return {
            user1: new UserBalanceBuilder().withUserId('user1').owesUser('user2', 50).owedByUser('user2', 30).build(),
            user2: new UserBalanceBuilder().withUserId('user2').owesUser('user1', 30).owedByUser('user1', 50).build(),
        };
    }

    /**
     * Perfect triangular cycle: A→B→C→A (each owes next $30)
     * Should completely eliminate all debts
     */
    static triangularCycle(): Record<string, UserBalance> {
        return {
            user1: new UserBalanceBuilder().withUserId('user1').owesUser('user2', 30).owedByUser('user3', 30).build(),
            user2: new UserBalanceBuilder().withUserId('user2').owesUser('user3', 30).owedByUser('user1', 30).build(),
            user3: new UserBalanceBuilder().withUserId('user3').owesUser('user1', 30).owedByUser('user2', 30).build(),
        };
    }

    /**
     * Perfect 5-user circular debt: A→B→C→D→E→A (each owes next $20)
     * Should completely eliminate all debts
     */
    static fiveUserCircle(): Record<string, UserBalance> {
        return {
            userA: new UserBalanceBuilder().withUserId('userA').owesUser('userB', 20).owedByUser('userE', 20).build(),
            userB: new UserBalanceBuilder().withUserId('userB').owesUser('userC', 20).owedByUser('userA', 20).build(),
            userC: new UserBalanceBuilder().withUserId('userC').owesUser('userD', 20).owedByUser('userB', 20).build(),
            userD: new UserBalanceBuilder().withUserId('userD').owesUser('userE', 20).owedByUser('userC', 20).build(),
            userE: new UserBalanceBuilder().withUserId('userE').owesUser('userA', 20).owedByUser('userD', 20).build(),
        };
    }

    /**
     * Star network: center user involved in all relationships
     */
    static starNetwork(): Record<string, UserBalance> {
        return {
            center: new UserBalanceBuilder().withUserId('center').owesUser('user1', 100).owesUser('user2', 50).owedByUser('user3', 80).owedByUser('user4', 70).build(),
            user1: new UserBalanceBuilder().withUserId('user1').owedByUser('center', 100).build(),
            user2: new UserBalanceBuilder().withUserId('user2').owedByUser('center', 50).build(),
            user3: new UserBalanceBuilder().withUserId('user3').owesUser('center', 80).build(),
            user4: new UserBalanceBuilder().withUserId('user4').owesUser('center', 70).build(),
        };
    }

    /**
     * Below threshold: amounts too small to matter (< $0.01)
     */
    static belowThreshold(): Record<string, UserBalance> {
        return {
            user1: new UserBalanceBuilder().withUserId('user1').owesUser('user2', 0.005).build(),
            user2: new UserBalanceBuilder().withUserId('user2').owedByUser('user1', 0.005).build(),
        };
    }

    /**
     * Complex 4-user network with multiple relationships
     */
    static complexFourUser(): Record<string, UserBalance> {
        return {
            user1: new UserBalanceBuilder().withUserId('user1').owesUser('user2', 40).owesUser('user3', 30).owesUser('user4', 20).owedByUser('user2', 30).build(),
            user2: new UserBalanceBuilder().withUserId('user2').owesUser('user1', 30).owesUser('user4', 40).owedByUser('user1', 40).build(),
            user3: new UserBalanceBuilder().withUserId('user3').owedByUser('user1', 30).build(),
            user4: new UserBalanceBuilder().withUserId('user4').owesUser('user1', 20).owedByUser('user2', 40).build(),
        };
    }

    /**
     * Uneven chain: user1 -> user2 -> (user3, user4) split
     */
    static unevenChain(): Record<string, UserBalance> {
        return {
            user1: new UserBalanceBuilder().withUserId('user1').owesUser('user2', 100).build(),
            user2: new UserBalanceBuilder().withUserId('user2').owesUser('user3', 50).owesUser('user4', 50).owedByUser('user1', 100).build(),
            user3: new UserBalanceBuilder().withUserId('user3').owedByUser('user2', 50).build(),
            user4: new UserBalanceBuilder().withUserId('user4').owedByUser('user2', 50).build(),
        };
    }

    /**
     * Large 6-user complex network
     */
    static sixUserNetwork(): Record<string, UserBalance> {
        return {
            alice: new UserBalanceBuilder().withUserId('alice').owesUser('bob', 50).owesUser('charlie', 30).owedByUser('frank', 40).build(),
            bob: new UserBalanceBuilder().withUserId('bob').owesUser('diana', 60).owedByUser('alice', 50).owedByUser('eve', 30).build(),
            charlie: new UserBalanceBuilder().withUserId('charlie').owesUser('eve', 45).owedByUser('alice', 30).owedByUser('diana', 25).build(),
            diana: new UserBalanceBuilder().withUserId('diana').owesUser('charlie', 25).owesUser('frank', 35).owedByUser('bob', 60).build(),
            eve: new UserBalanceBuilder().withUserId('eve').owesUser('bob', 30).owedByUser('charlie', 45).build(),
            frank: new UserBalanceBuilder().withUserId('frank').owesUser('alice', 40).owedByUser('diana', 35).build(),
        };
    }

    /**
     * Asymmetric whale network: one user with large amounts, others with small
     */
    static asymmetricWhale(): Record<string, UserBalance> {
        return {
            whale: new UserBalanceBuilder().withUserId('whale').owedByUser('user1', 1000).owedByUser('user2', 800).owedByUser('user3', 600).build(),
            user1: new UserBalanceBuilder().withUserId('user1').owesUser('whale', 1000).owesUser('user4', 50).build(),
            user2: new UserBalanceBuilder().withUserId('user2').owesUser('whale', 800).owesUser('user4', 30).build(),
            user3: new UserBalanceBuilder().withUserId('user3').owesUser('whale', 600).owesUser('user4', 20).build(),
            user4: new UserBalanceBuilder().withUserId('user4').owedByUser('user1', 50).owedByUser('user2', 30).owedByUser('user3', 20).build(),
        };
    }

    /**
     * All balances zero: users with no outstanding debts
     */
    static allZeroBalances(): Record<string, UserBalance> {
        return {
            user1: new UserBalanceBuilder().withUserId('user1').build(),
            user2: new UserBalanceBuilder().withUserId('user2').build(),
        };
    }

    /**
     * Mixed currency scenarios - returns both USD and EUR balances separately
     */
    static mixedCurrencyScenarios(): { usd: Record<string, UserBalance>; eur: Record<string, UserBalance> } {
        const usdBalances = {
            user1: new UserBalanceBuilder().withUserId('user1').owesUser('user2', 100).owedByUser('user3', 50).build(),
            user2: new UserBalanceBuilder().withUserId('user2').owesUser('user3', 80).owedByUser('user1', 100).build(),
            user3: new UserBalanceBuilder().withUserId('user3').owesUser('user1', 50).owedByUser('user2', 80).build(),
        };

        const eurBalances = {
            user1: new UserBalanceBuilder().withUserId('user1').owedByUser('user2', 60).build(),
            user2: new UserBalanceBuilder().withUserId('user2').owesUser('user1', 60).owesUser('user3', 40).build(),
            user3: new UserBalanceBuilder().withUserId('user3').owedByUser('user2', 40).build(),
        };

        return { usd: usdBalances, eur: eurBalances };
    }
}
