/**
 * @jest-environment node
 */

import { v4 as uuidv4 } from 'uuid';
import { ApiDriver } from '../support/ApiDriver';
import { PerformanceTestWorkers } from './PerformanceTestWorkers';

describe('Performance - Balance Consistency Under Load', () => {
    let driver: ApiDriver;
    let workers: PerformanceTestWorkers;

    jest.setTimeout(60000);

    beforeAll(async () => {
        driver = new ApiDriver();
        workers = new PerformanceTestWorkers(driver);
    });

    const testCases = [
        { expensesPerUserPair: 5, description: 'small dataset' },
        { expensesPerUserPair: 10, description: 'medium dataset' },
        { expensesPerUserPair: 25, description: 'large dataset' },
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

            await workers.createBalanceTestExpenses({
                user1,
                user2,
                group: balanceGroup,
                expensesPerUserPair
            });

            await new Promise(resolve => setTimeout(resolve, 2000));
            const balances = await driver.getGroupBalances(balanceGroup.id, user1.token);
            
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