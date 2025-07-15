/**
 * @jest-environment node
 */

import { v4 as uuidv4 } from 'uuid';
import { ApiDriver, User } from '../support/ApiDriver';
import { PerformanceTestWorkers } from './PerformanceTestWorkers';

describe('Performance - Large Dataset Handling', () => {
    let driver: ApiDriver;
    let mainUser: User;
    let workers: PerformanceTestWorkers;

    jest.setTimeout(90000);

    beforeAll(async () => {
        driver = new ApiDriver();
        workers = new PerformanceTestWorkers(driver);
        const userSuffix = uuidv4().slice(0, 8);

        mainUser = await driver.createTestUser({
            email: `performance-dataset-${userSuffix}@example.com`,
            password: 'Password123!',
            displayName: 'Dataset Test User'
        });
    });

    const testCases = [
        { totalExpenses: 20, batchSize: 5, description: 'small dataset', timeout: 30000 },
        { totalExpenses: 40, batchSize: 10, description: 'medium dataset', timeout: 45000 },
        { totalExpenses: 60, batchSize: 15, description: 'large dataset', timeout: 60000 },
    ];

    testCases.forEach(({ totalExpenses, batchSize, description, timeout }) => {
        it(`should handle groups with ${totalExpenses} expenses efficiently (${description})`, async () => {
            const userSuffix = uuidv4().slice(0, 8);
            
            const largeGroupUser1 = mainUser;
            const largeGroupUser2 = await driver.createTestUser({
                email: `perf-large-${userSuffix}@example.com`,
                password: 'Password123!',
                displayName: 'Large Dataset User'
            });
            
            const largeGroup = await driver.createGroup(`Large Dataset Group (${totalExpenses} expenses)`, [largeGroupUser1, largeGroupUser2], largeGroupUser1.token);

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