/**
 * @jest-environment node
 */

import { ApiDriver, User } from '../support/ApiDriver';
import { PerformanceTestWorkers } from './PerformanceTestWorkers';
import { UserBuilder } from '../support/builders';

describe('Performance - Concurrent User Operations', () => {
    let driver: ApiDriver;
    let mainUser: User;
    let workers: PerformanceTestWorkers;

    jest.setTimeout(60000);

    beforeAll(async () => {
        driver = new ApiDriver();
        workers = new PerformanceTestWorkers(driver);

        mainUser = await driver.createUser(new UserBuilder().build());
    });

    const testCases = [
        { users: 3, expensesPerUser: 1, timeoutMs: 5000, description: 'small load' },
        { users: 5, expensesPerUser: 1, timeoutMs: 8000, description: 'medium load' },
        { users: 7, expensesPerUser: 1, timeoutMs: 10000, description: 'large load' },
    ];

    testCases.forEach(({ users, expensesPerUser, timeoutMs, description }) => {
        it(`should handle ${users} users creating ${expensesPerUser} expenses each (${description})`, async () => {
            const testUsers: User[] = [];
            for (let i = 0; i < users; i++) {
                const user = await driver.createUser(new UserBuilder().build());
                testUsers.push(user);
            }

            const concurrentGroup = await driver.createGroupWithMembers(`Concurrent Test Group (${users} users)`, [mainUser, ...testUsers], mainUser.token);

            const result = await workers.createConcurrentExpenses({
                users: testUsers,
                group: concurrentGroup,
                expensesPerUser,
                timeoutMs
            });

            const expectedTotal = users * expensesPerUser;
            expect(result.succeeded).toBe(expectedTotal);
            expect(result.failed).toBe(0);
            expect(result.totalTime).toBeLessThan(timeoutMs);
            
            const groupExpenses = await driver.getGroupExpenses(concurrentGroup.id, mainUser.token);
            expect(groupExpenses.expenses.length).toBeGreaterThanOrEqual(Math.min(expectedTotal, 100));
        });
    });
});