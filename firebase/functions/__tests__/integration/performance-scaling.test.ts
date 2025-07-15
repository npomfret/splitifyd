/**
 * @jest-environment node
 */

import { v4 as uuidv4 } from 'uuid';
import { ApiDriver, User } from '../support/ApiDriver';
import { PerformanceTestWorkers } from '../support/PerformanceTestWorkers';

describe('Performance - Group Membership Scaling', () => {
    let driver: ApiDriver;
    let workers: PerformanceTestWorkers;

    jest.setTimeout(120000);

    beforeAll(async () => {
        driver = new ApiDriver();
        workers = new PerformanceTestWorkers(driver);
    });

    const testCases = [
        { groupCount: 10, expensesPerGroup: 2, description: 'small scale' },
        { groupCount: 20, expensesPerGroup: 3, description: 'medium scale' },
        { groupCount: 30, expensesPerGroup: 2, description: 'large scale' },
    ];

    testCases.forEach(({ groupCount, expensesPerGroup, description }) => {
        it(`should handle users with ${groupCount} group memberships (${description})`, async () => {
            const userSuffix = uuidv4().slice(0, 8);
            
            const busyUser = await driver.createTestUser({
                email: `perf-busy-${userSuffix}@example.com`,
                password: 'Password123!',
                displayName: 'Busy User'
            });
            
            const { responseTime } = await workers.handleGroupMemberships({
                busyUser,
                groupCount,
                expensesPerGroup,
                userSuffix
            });

            expect(responseTime).toBeLessThan(groupCount * 250);
            
            console.log(`Retrieved balances for user with ${groupCount} groups in ${responseTime}ms`);
        }, 120000);
    });
});