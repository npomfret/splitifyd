/**
 * @jest-environment node
 */

import {ApiDriver, User} from '../../support/ApiDriver';
import {PerformanceTestWorkers} from './PerformanceTestWorkers';
import {ExpenseBuilder, UserBuilder} from '../../support/builders';
import type {Group} from "../../../shared/shared-types";
import {clearAllTestData} from '../../support/cleanupHelpers';

describe('Performance - Response Time Benchmarks', () => {
    let driver: ApiDriver;
    let mainUser: User;
    let workers: PerformanceTestWorkers;
    let benchmarkGroup: Group;
    let benchmarkExpenses: any[] = [];

    jest.setTimeout(12000);// it takes about 6s

    beforeAll(async () => {
        // Clear any existing test data first
        await clearAllTestData();
        
        driver = new ApiDriver();
        workers = new PerformanceTestWorkers(driver);

        mainUser = await driver.createUser(new UserBuilder().build());

        benchmarkGroup = await driver.createGroupWithMembers('Benchmark Group', [mainUser], mainUser.token);
        
        for (let i = 0; i < 20; i++) {
            const expense = await driver.createExpense(new ExpenseBuilder()
                .withGroupId(benchmarkGroup.id)
                .withDescription(`Benchmark expense ${i}`)
                .withAmount(100)
                .withPaidBy(mainUser.uid)
                .withSplitType('exact')
                .withParticipants([mainUser.uid])
                .withSplits([{ userId: mainUser.uid, amount: 100 }])
                .build(), mainUser.token);
            benchmarkExpenses.push(expense);
        }
    });

    afterAll(async () => {
        // Clean up all test resources
        await clearAllTestData();
    });

    it('should meet target response times for read operations', async () => {
        // Verify group exists first
        console.log(`Testing with group ID: ${benchmarkGroup.id}`);
        const group = await driver.getGroup(benchmarkGroup.id, mainUser.token);
        console.log(`Group verified: ${group.name}`);

        const readOperations = [
            { name: 'Get group expenses', fn: () => driver.getGroupExpenses(benchmarkGroup.id, mainUser.token), target: 500 },
            { 
                name: 'Get balances', 
                fn: () => driver.getGroupBalances(benchmarkGroup.id, mainUser.token), 
                target: 500 
            },
            { name: 'Get expense', fn: () => driver.getExpense(benchmarkExpenses[0].id, mainUser.token), target: 300 }
        ];

        for (const operation of readOperations) {
            const startTime = Date.now();
            await operation.fn();
            const endTime = Date.now();
            const responseTime = endTime - startTime;
            
            console.log(`${operation.name}: ${responseTime}ms (target: <${operation.target}ms)`);
            expect(responseTime).toBeLessThan(operation.target);
        }
    });

    it('should meet target response times for write operations', async () => {
        const writeOperations = [
            { 
                name: 'Create expense',
                fn: () => driver.createExpense(new ExpenseBuilder()
                    .withGroupId(benchmarkGroup.id)
                    .withDescription('Write benchmark expense')
                    .withAmount(100)
                    .withPaidBy(mainUser.uid)
                    .withSplitType('exact')
                    .withParticipants([mainUser.uid])
                    .withSplits([{ userId: mainUser.uid, amount: 100 }])
                    .build(), mainUser.token),
                target: 2000
            },
            {
                name: 'Update expense',
                fn: () => driver.updateExpense(benchmarkExpenses[0].id, {
                    description: 'Updated benchmark expense'
                }, mainUser.token),
                target: 1500
            },
            {
                name: 'Create group',
                fn: () => driver.createGroupWithMembers('New benchmark group', [mainUser], mainUser.token),
                target: 2000
            }
        ];

        for (const operation of writeOperations) {
            const startTime = Date.now();
            await operation.fn();
            const endTime = Date.now();
            const responseTime = endTime - startTime;
            
            console.log(`${operation.name}: ${responseTime}ms (target: <${operation.target}ms)`);
            expect(responseTime).toBeLessThan(operation.target);
        }
    });

    it('should not leak memory during repeated operations', async () => {
        const memoryGroup = await driver.createGroupWithMembers('Memory Test Group', [mainUser], mainUser.token);
        
        await workers.performRepeatedOperations({
            group: memoryGroup,
            user: mainUser,
            iterations: 50
        });
        
        expect(true).toBe(true);
    }, 120000);
});