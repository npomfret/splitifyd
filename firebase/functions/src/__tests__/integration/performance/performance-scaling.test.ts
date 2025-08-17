/**
 * @jest-environment node
 */

import { ApiDriver } from '../../support/ApiDriver';
import { PerformanceTestWorkers } from './PerformanceTestWorkers';
import { UserBuilder } from '../../support/builders';
import { clearAllTestData } from '../../support/cleanupHelpers';

describe('Performance - Group Membership Scaling', () => {
    let driver: ApiDriver;
    let workers: PerformanceTestWorkers;

    jest.setTimeout(15000); // Tests take ~14.0s

    beforeAll(async () => {
        // Clear any existing test data first
        await clearAllTestData();

        driver = new ApiDriver();
        workers = new PerformanceTestWorkers(driver);
    });

    afterAll(async () => {
        // Clean up all test data
        await clearAllTestData();
    });

    const testCases = [
        { groupCount: 10, expensesPerGroup: 2, description: 'small scale' },
        { groupCount: 20, expensesPerGroup: 3, description: 'medium scale' },
        { groupCount: 30, expensesPerGroup: 2, description: 'large scale' },
    ];

    testCases.forEach(({ groupCount, expensesPerGroup, description }) => {
        it(`should handle users with ${groupCount} group memberships (${description})`, async () => {
            const busyUser = await driver.createUser(new UserBuilder().build());

            const { responseTime } = await workers.handleGroupMemberships({
                busyUser,
                groupCount,
                expensesPerGroup,
                userSuffix: 'test',
            });

            expect(responseTime).toBeLessThan(groupCount * 250);

            console.log(`Retrieved balances for user with ${groupCount} groups in ${responseTime}ms`);
        }, 120000);
    });
});
