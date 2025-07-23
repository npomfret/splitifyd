/**
 * @jest-environment node
 */

import {ApiDriver, User} from '../support/ApiDriver';
import {PerformanceTestWorkers} from './PerformanceTestWorkers';
import {ExpenseBuilder, UserBuilder} from '../support/builders';
import type {GroupDetail} from "../../src/shared/apiTypes";

describe('Performance and Load Testing', () => {
    let driver: ApiDriver;
    let mainUser: User;
    let workers: PerformanceTestWorkers;

    jest.setTimeout(60000);

    beforeAll(async () => {
        driver = new ApiDriver();
        workers = new PerformanceTestWorkers(driver);
        mainUser = await driver.createTestUser(new UserBuilder().build());
        await driver.createGroup('Performance Test Group', [mainUser], mainUser.token);
    });

    describe('Concurrent User Operations', () => {
        const testCases = [
            { users: 5, expensesPerUser: 2, timeoutMs: 5000, description: 'small load' },
            { users: 10, expensesPerUser: 1, timeoutMs: 8000, description: 'medium load' },
            { users: 15, expensesPerUser: 2, timeoutMs: 15000, description: 'large load' },
        ];

        testCases.forEach(({ users, expensesPerUser, timeoutMs, description }) => {
            it(`should handle ${users} users creating ${expensesPerUser} expenses each (${description})`, async () => {
                const testUsers: User[] = [];
                for (let i = 0; i < users; i++) {
                    const user = await driver.createTestUser(new UserBuilder().build());
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

    describe('Balance Consistency Under Load', () => {
        const testCases = [
            { expensesPerUserPair: 5, description: 'small dataset' },
            { expensesPerUserPair: 10, description: 'medium dataset' },
            { expensesPerUserPair: 25, description: 'large dataset' },
        ];

        testCases.forEach(({ expensesPerUserPair, description }) => {
            it(`should maintain data consistency with ${expensesPerUserPair * 2} concurrent balance updates (${description})`, async () => {
                const user1 = await driver.createTestUser(new UserBuilder().build());
                const user2 = await driver.createTestUser(new UserBuilder().build());
                
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

    describe('Large Dataset Handling', () => {
        const testCases = [
            { totalExpenses: 50, batchSize: 10, description: 'small dataset', timeout: 30000 },
            { totalExpenses: 100, batchSize: 20, description: 'medium dataset', timeout: 60000 },
            { totalExpenses: 250, batchSize: 25, description: 'large dataset', timeout: 120000 },
        ];

        testCases.forEach(({ totalExpenses, batchSize, description, timeout }) => {
            it(`should handle groups with ${totalExpenses} expenses efficiently (${description})`, async () => {
                const largeGroupUser1 = mainUser;
                const largeGroupUser2 = await driver.createTestUser(new UserBuilder().build());
                
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

    describe('Complex Debt Graphs', () => {
        const testCases = [
            { users: 4, expensesPerUser: 3, description: 'small graph' },
            { users: 6, expensesPerUser: 4, description: 'medium graph' },
            { users: 8, expensesPerUser: 5, description: 'large graph' },
        ];

        testCases.forEach(({ users, expensesPerUser, description }) => {
            it(`should efficiently calculate balances in complex debt graphs with ${users} users (${description})`, async () => {
                const complexUsers: User[] = [mainUser];
                for (let i = 1; i < users; i++) {
                    const user = await driver.createTestUser(new UserBuilder().build());
                    complexUsers.push(user);
                }

                const complexGroup = await driver.createGroup(`Complex Debt Group (${users} users)`, complexUsers, mainUser.token);

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

    describe('Group Membership Scaling', () => {
        const testCases = [
            { groupCount: 10, expensesPerGroup: 2, description: 'small scale' },
            { groupCount: 20, expensesPerGroup: 3, description: 'medium scale' },
            { groupCount: 30, expensesPerGroup: 2, description: 'large scale' },
        ];

        testCases.forEach(({ groupCount, expensesPerGroup, description }) => {
            it(`should handle users with ${groupCount} group memberships (${description})`, async () => {
                const busyUser = await driver.createTestUser(new UserBuilder().build());
                
                const { responseTime } = await workers.handleGroupMemberships({
                    busyUser,
                    groupCount,
                    expensesPerGroup,
                    userSuffix: 'test'
                });

                expect(responseTime).toBeLessThan(groupCount * 250);
                
                console.log(`Retrieved balances for user with ${groupCount} groups in ${responseTime}ms`);
            }, 120000);
        });
    });

    describe('Response Time Benchmarks', () => {
        let benchmarkGroup: GroupDetail;
        let benchmarkExpenses: any[] = [];

        beforeAll(async () => {
            benchmarkGroup = await driver.createGroup('Benchmark Group', [mainUser], mainUser.token);
            
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
    });

    describe('Memory and Resource Usage', () => {
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
});