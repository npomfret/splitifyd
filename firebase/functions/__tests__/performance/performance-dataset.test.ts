/**
 * @jest-environment node
 */

import { ApiDriver, User } from '../support/ApiDriver';
import { PerformanceTestWorkers } from './PerformanceTestWorkers';
import { UserBuilder } from '../support/builders';

describe('Performance - Large Dataset Handling', () => {
    let driver: ApiDriver;
    let mainUser: User;
    let workers: PerformanceTestWorkers;

    jest.setTimeout(90000);

    beforeAll(async () => {
        driver = new ApiDriver();
        workers = new PerformanceTestWorkers(driver);

        mainUser = await driver.createUser(new UserBuilder().build());
    });

    const testCases = [
        { totalExpenses: 10, batchSize: 5, description: 'small dataset', timeout: 30000 },
        { totalExpenses: 20, batchSize: 5, description: 'medium dataset', timeout: 45000 },
        { totalExpenses: 30, batchSize: 10, description: 'large dataset', timeout: 60000 },
    ];

    testCases.forEach(({ totalExpenses, batchSize, description, timeout }) => {
        it(`should handle groups with ${totalExpenses} expenses efficiently (${description})`, async () => {
            const largeGroupUser1 = mainUser;
            const largeGroupUser2 = await driver.createUser(new UserBuilder().build());
            
            const largeGroup = await driver.createGroupWithMembers(`Large Dataset Group (${totalExpenses} expenses)`, [largeGroupUser1, largeGroupUser2], largeGroupUser1.token);

            const metrics = await workers.createLargeGroupExpenses({
                group: largeGroup,
                user1: largeGroupUser1,
                user2: largeGroupUser2,
                totalExpenses,
                batchSize
            });

            expect(metrics.retrievalTime).toBeLessThan(2000);
            expect(metrics.balanceTime).toBeLessThan(3000);
            
            console.log(`Performance metrics for ${totalExpenses} expenses:
                - Creation: ${metrics.creationTime}ms
                - Retrieval: ${metrics.retrievalTime}ms
                - Balance calculation: ${metrics.balanceTime}ms`);
        }, timeout);
    });
});