import { GroupDTO, UserToken } from '@splitifyd/shared';
import { ApiDriver } from './ApiDriver';
import { CreateExpenseRequestBuilder } from './builders';
import { generateShortId } from './test-helpers';
import { TestGroupManager } from './TestGroupManager';

interface ExpenseOptions {
    amount?: number;
    description?: string;
    category?: string;
    fresh?: boolean;
}

/**
 * @deprecated delete this bullshit
 */
export class TestExpenseManager {
    private static expenseCache: Map<string, Promise<any>> = new Map();
    private static apiDriver = new ApiDriver();

    private static createCacheKey(groupId: string, payerId: string, participantCount: number): string {
        return `${groupId}:${payerId}:${participantCount}`;
    }

    public static async getOrCreateExpense(group: GroupDTO, users: UserToken[], payer: UserToken, options: ExpenseOptions = {}): Promise<any> {
        const { fresh = false } = options;

        if (fresh) {
            return this.createFreshExpense(group, users, payer, options);
        }

        const participantCount = users.length;
        const cacheKey = this.createCacheKey(group.id, payer.uid, participantCount);

        if (!this.expenseCache.has(cacheKey)) {
            const expensePromise = this.createFreshExpense(group, users, payer, options);
            this.expenseCache.set(cacheKey, expensePromise);
        }

        return this.expenseCache.get(cacheKey)!;
    }

    private static async createFreshExpense(group: GroupDTO, users: UserToken[], payer: UserToken, options: ExpenseOptions = {}): Promise<any> {
        const { amount = 50.0, description, category = 'food' } = options;
        const uniqueId = generateShortId();

        const expenseData = new CreateExpenseRequestBuilder()
            .withGroupId(group.id)
            .withDescription(description || `Shared expense ${uniqueId}`)
            .withAmount(amount)
            .withCurrency('USD')
            .withPaidBy(payer.uid)
            .withParticipants(users.map((u) => u.uid))
            .withCategory(category)
            .withSplitType('equal')
            .build();

        return this.apiDriver.createExpense(expenseData, payer.token);
    }

    /**
     * Creates a reusable expense setup for comment tests
     * Returns a group with a pre-existing expense for comment testing
     */
    public static async getGroupWithExpenseForComments(users: UserToken[]): Promise<{ group: GroupDTO; expense: any }> {
        const group = await TestGroupManager.getOrCreateGroup(users, { memberCount: users.length });
        const expense = await this.getOrCreateExpense(group, users, users[0], {
            description: 'Expense for comment testing',
            category: 'test',
        });

        return { group, expense };
    }
}
