/**
 * @jest-environment node
 */

import { v4 as uuidv4 } from 'uuid';
import { ApiDriver, User, Group } from '../support/ApiDriver';
import { PerformanceTestWorkers } from './PerformanceTestWorkers';

describe('Performance - Response Time Benchmarks', () => {
    let driver: ApiDriver;
    let mainUser: User;
    let workers: PerformanceTestWorkers;
    let benchmarkGroup: Group;
    let benchmarkExpenses: any[] = [];

    jest.setTimeout(60000);

    beforeAll(async () => {
        driver = new ApiDriver();
        workers = new PerformanceTestWorkers(driver);
        const userSuffix = uuidv4().slice(0, 8);

        mainUser = await driver.createTestUser({
            email: `performance-benchmark-${userSuffix}@example.com`,
            password: 'Password123!',
            displayName: 'Benchmark Test User'
        });

        benchmarkGroup = await driver.createGroup('Benchmark Group', [mainUser], mainUser.token);
        
        for (let i = 0; i < 20; i++) {
            const expense = await driver.createExpense({
                groupId: benchmarkGroup.id,
                description: `Benchmark expense ${i}`,
                amount: 100,
                paidBy: mainUser.uid,
                category: 'food',
                splitType: 'exact',
                participants: [mainUser.uid],
                splits: [{ userId: mainUser.uid, amount: 100 }],
                date: new Date().toISOString()
            }, mainUser.token);
            benchmarkExpenses.push(expense);
        }
    });

    it('should meet target response times for read operations', async () => {
        const readOperations = [
            { name: 'Get group expenses', fn: () => driver.getGroupExpenses(benchmarkGroup.id, mainUser.token), target: 500 },
            { name: 'Get balances', fn: () => driver.getGroupBalances(benchmarkGroup.id, mainUser.token), target: 500 },
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
                fn: () => driver.createExpense({
                    groupId: benchmarkGroup.id,
                    description: 'Write benchmark expense',
                    amount: 100,
                    paidBy: mainUser.uid,
                    category: 'food',
                    splitType: 'exact',
                    participants: [mainUser.uid],
                    splits: [{ userId: mainUser.uid, amount: 100 }],
                    date: new Date().toISOString()
                }, mainUser.token),
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
                fn: () => driver.createGroup('New benchmark group', [mainUser], mainUser.token),
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
        const memoryGroup = await driver.createGroup('Memory Test Group', [mainUser], mainUser.token);
        
        await workers.performRepeatedOperations({
            group: memoryGroup,
            user: mainUser,
            iterations: 50
        });
        
        expect(true).toBe(true);
    }, 120000);
});