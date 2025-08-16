/**
 * @jest-environment node
 */

import { ApiDriver, User } from '../../support/ApiDriver';
import { PerformanceTestWorkers } from './PerformanceTestWorkers';
import { UserBuilder } from '../../support/builders';
import { clearAllTestData } from '../../support/cleanupHelpers';

describe('Performance - Complex Debt Graphs', () => {
    let driver: ApiDriver;
    let mainUser: User;
    let workers: PerformanceTestWorkers;

    jest.setTimeout(10000); // Tests take ~2.8s

    beforeAll(async () => {
    // Clear any existing test data first
    await clearAllTestData();
    
        driver = new ApiDriver();
        workers = new PerformanceTestWorkers(driver);
        mainUser = await driver.createUser(new UserBuilder().build());
    });

  afterAll(async () => {
    // Clean up all test data
    await clearAllTestData();
  });

    const testCases = [
        { users: 4, expensesPerUser: 3, description: 'small graph' },
        { users: 6, expensesPerUser: 4, description: 'medium graph' },
        { users: 8, expensesPerUser: 5, description: 'large graph' },
    ];

    testCases.forEach(({ users, expensesPerUser, description }) => {
        it(`should efficiently calculate balances in complex debt graphs with ${users} users (${description})`, async () => {
            const complexUsers: User[] = [mainUser];
            for (let i = 1; i < users; i++) {
                const user = await driver.createUser(new UserBuilder().build());
                complexUsers.push(user);
            }

            const complexGroup = await driver.createGroupWithMembers(`Complex Debt Group (${users} users)`, complexUsers, mainUser.token);

            const metrics = await workers.createComplexDebtGraph({
                users: complexUsers,
                group: complexGroup,
                expensesPerUser
            });

            expect(metrics.balanceCalculationTime).toBeLessThan(5000);
            
            const balances = await driver.getGroupBalances(complexGroup.id, mainUser.token);
            const totalBalance = Object.values(balances.userBalances).reduce((sum: number, balance: any) => {
                return sum + (balance?.netBalance || 0);
            }, 0);
            expect(Math.abs(totalBalance)).toBeLessThan(0.01);
            
            console.log(`Calculated balances for ${users} users with ${metrics.totalExpenses} expenses in ${metrics.balanceCalculationTime}ms`);
        }, 120000);
    });
});