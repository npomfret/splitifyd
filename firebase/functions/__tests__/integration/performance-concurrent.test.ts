/**
 * @jest-environment node
 */

import { v4 as uuidv4 } from 'uuid';
import { ApiDriver, User } from '../support/ApiDriver';
import { PerformanceTestWorkers } from '../support/PerformanceTestWorkers';

describe('Performance - Concurrent User Operations', () => {
    let driver: ApiDriver;
    let mainUser: User;
    let workers: PerformanceTestWorkers;

    jest.setTimeout(60000);

    beforeAll(async () => {
        driver = new ApiDriver();
        workers = new PerformanceTestWorkers(driver);
        const userSuffix = uuidv4().slice(0, 8);

        mainUser = await driver.createTestUser({
            email: `performance-concurrent-${userSuffix}@example.com`,
            password: 'Password123!',
            displayName: 'Concurrent Test User'
        });
    });

    const testCases = [
        { users: 5, expensesPerUser: 2, timeoutMs: 5000, description: 'small load' },
        { users: 10, expensesPerUser: 1, timeoutMs: 8000, description: 'medium load' },
        { users: 15, expensesPerUser: 2, timeoutMs: 15000, description: 'large load' },
    ];

    testCases.forEach(({ users, expensesPerUser, timeoutMs, description }) => {
        it(`should handle ${users} users creating ${expensesPerUser} expenses each (${description})`, async () => {
            const userSuffix = uuidv4().slice(0, 8);
            
            const testUsers: User[] = [];
            for (let i = 0; i < users; i++) {
                const user = await driver.createTestUser({
                    email: `perf-concurrent-${userSuffix}-${i}@example.com`,
                    password: 'Password123!',
                    displayName: `User ${i}`
                });
                testUsers.push(user);
            }

            const concurrentGroup = await driver.createGroup(`Concurrent Test Group (${users} users)`, [mainUser, ...testUsers], mainUser.token);

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