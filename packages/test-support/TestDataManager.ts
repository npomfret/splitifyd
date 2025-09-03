import { AuthenticatedFirebaseUser, Group } from '@splitifyd/shared';
import { TestGroupManager } from './TestGroupManager';
import { TestExpenseManager } from './TestExpenseManager';
import { TestSettlementManager } from './TestSettlementManager';

interface TestScenarioOptions {
    memberCount?: number;
    expenseCount?: number;
    settlementCount?: number;
    fresh?: boolean;
}

interface CompleteTestScenario {
    group: Group;
    users: AuthenticatedFirebaseUser[];
    expenses?: any[];
    settlements?: any[];
}

/**
 * Master test data manager that provides complete pre-configured scenarios
 * for complex integration tests requiring multiple data types
 */
export class TestDataManager {
    private static scenarioCache: Map<string, Promise<CompleteTestScenario>> = new Map();

    private static createScenarioKey(
        userCount: number, 
        expenseCount: number, 
        settlementCount: number
    ): string {
        return `scenario:${userCount}u:${expenseCount}e:${settlementCount}s`;
    }

    /**
     * Get or create a complete test scenario with group, users, expenses, and settlements
     */
    public static async getCompleteScenario(
        users: AuthenticatedFirebaseUser[],
        options: TestScenarioOptions = {}
    ): Promise<CompleteTestScenario> {
        const {
            memberCount = users.length,
            expenseCount = 0,
            settlementCount = 0,
            fresh = false
        } = options;

        if (fresh) {
            return this.createFreshScenario(users, options);
        }

        const cacheKey = this.createScenarioKey(memberCount, expenseCount, settlementCount);

        if (!this.scenarioCache.has(cacheKey)) {
            const scenarioPromise = this.createFreshScenario(users, options);
            this.scenarioCache.set(cacheKey, scenarioPromise);
        }

        return this.scenarioCache.get(cacheKey)!;
    }

    private static async createFreshScenario(
        users: AuthenticatedFirebaseUser[],
        options: TestScenarioOptions
    ): Promise<CompleteTestScenario> {
        const { memberCount = users.length, expenseCount = 0, settlementCount = 0 } = options;
        const scenarioUsers = users.slice(0, memberCount);

        // Create the base group
        const group = await TestGroupManager.getOrCreateGroup(scenarioUsers, { 
            memberCount,
            fresh: options.fresh 
        });

        const scenario: CompleteTestScenario = {
            group,
            users: scenarioUsers
        };

        // Add expenses if requested
        if (expenseCount > 0) {
            scenario.expenses = [];
            for (let i = 0; i < expenseCount; i++) {
                const expense = await TestExpenseManager.getOrCreateExpense(
                    group,
                    scenarioUsers,
                    scenarioUsers[i % scenarioUsers.length],
                    {
                        amount: 20 + (i * 10),
                        description: `Scenario expense ${i + 1}`,
                        fresh: true // Create unique expenses for scenarios
                    }
                );
                scenario.expenses.push(expense);
            }
        }

        // Add settlements if requested
        if (settlementCount > 0 && scenarioUsers.length >= 2) {
            scenario.settlements = await TestSettlementManager.createMultipleSettlements(
                group,
                scenarioUsers,
                settlementCount
            );
        }

        return scenario;
    }

    /**
     * Common scenarios for quick setup
     */
    public static async getBasicGroupScenario(
        users: AuthenticatedFirebaseUser[]
    ): Promise<{ group: Group; users: AuthenticatedFirebaseUser[] }> {
        const scenario = await this.getCompleteScenario(users, { memberCount: 2 });
        return { group: scenario.group, users: scenario.users };
    }

    public static async getExpenseTestingScenario(
        users: AuthenticatedFirebaseUser[]
    ): Promise<{ group: Group; users: AuthenticatedFirebaseUser[]; expenses: any[] }> {
        const scenario = await this.getCompleteScenario(users, { 
            memberCount: 3, 
            expenseCount: 2 
        });
        return { 
            group: scenario.group, 
            users: scenario.users, 
            expenses: scenario.expenses! 
        };
    }

    public static async getSettlementTestingScenario(
        users: AuthenticatedFirebaseUser[]
    ): Promise<{ group: Group; users: AuthenticatedFirebaseUser[]; settlements: any[] }> {
        const scenario = await this.getCompleteScenario(users, { 
            memberCount: 3, 
            settlementCount: 2 
        });
        return { 
            group: scenario.group, 
            users: scenario.users, 
            settlements: scenario.settlements! 
        };
    }

    public static async getComplexScenario(
        users: AuthenticatedFirebaseUser[]
    ): Promise<CompleteTestScenario> {
        return this.getCompleteScenario(users, {
            memberCount: 4,
            expenseCount: 3,
            settlementCount: 2
        });
    }

    public static clearAllCaches(): void {
        this.scenarioCache.clear();
        TestGroupManager.clearCache();
        TestExpenseManager.clearCache();
        TestSettlementManager.clearCache();
    }

    public static getCacheStats(): {
        scenarios: number;
        groups: number;
        expenses: number;
        settlements: number;
    } {
        return {
            scenarios: this.scenarioCache.size,
            groups: TestGroupManager.getCacheSize(),
            expenses: TestExpenseManager.getCacheSize(),
            settlements: TestSettlementManager.getCacheSize()
        };
    }
}