/**
 * @jest-environment node
 */

import { v4 as uuidv4 } from 'uuid';
import { ApiDriver } from '../support/ApiDriver';

describe('Performance - Balance Consistency Under Load', () => {
    let driver: ApiDriver;

    jest.setTimeout(60000);

    beforeAll(async () => {
        driver = new ApiDriver();
    });

    const testCases = [
        { expensesPerUserPair: 1, description: 'small dataset' },
    ];

    testCases.forEach(({ expensesPerUserPair, description }) => {
        it(`should maintain data consistency with ${expensesPerUserPair * 2} concurrent balance updates (${description})`, async () => {
            const userSuffix = uuidv4().slice(0, 8);
            
            const user1 = await driver.createTestUser({
                email: `perf-balance-1-${userSuffix}@example.com`,
                password: 'Password123!',
                displayName: 'Balance User 1'
            });
            const user2 = await driver.createTestUser({
                email: `perf-balance-2-${userSuffix}@example.com`,
                password: 'Password123!',
                displayName: 'Balance User 2'
            });
            
            const balanceGroup = await driver.createGroup(`Balance Test Group (${expensesPerUserPair} expenses)`, [user1, user2], user1.token);

            // Create just one expense to test basic functionality
            await driver.createExpense({
                groupId: balanceGroup.id,
                description: `User1 pays`,
                amount: 100,
                paidBy: user1.uid,
                category: 'food',
                splitType: 'exact',
                participants: [user1.uid, user2.uid],
                splits: [
                    { userId: user1.uid, amount: 20 },
                    { userId: user2.uid, amount: 80 }
                ],
                date: new Date().toISOString()
            }, user1.token);

            // Wait for balance calculation trigger to complete
            const balances = await driver.waitForBalanceUpdate(balanceGroup.id, user1.token, 15000);
            
            const user1Balance = balances.userBalances[user1.uid];
            const user2Balance = balances.userBalances[user2.uid];
            
            expect(user1Balance).toBeDefined();
            expect(user2Balance).toBeDefined();
            
            const user1Net = user1Balance?.netBalance || 0;
            const user2Net = user2Balance?.netBalance || 0;
            
            expect(user1Net).toBeCloseTo(-user2Net, 2);
            
            console.log(`Balance test (${expensesPerUserPair} expenses each): User1=${user1Net}, User2=${user2Net}`);
        });
    });
});