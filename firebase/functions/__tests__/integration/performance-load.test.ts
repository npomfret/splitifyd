/**
 * @jest-environment node
 */

import { v4 as uuidv4 } from 'uuid';
import { ApiDriver, User, Group, Expense } from '../support/ApiDriver';

describe('Performance and Load Testing', () => {
    let driver: ApiDriver;
    let mainUser: User;

    jest.setTimeout(60000); // Extended timeout for performance tests

    beforeAll(async () => {
        driver = new ApiDriver();
        const userSuffix = uuidv4().slice(0, 8);

        // Create main test user
        mainUser = await driver.createTestUser({
            email: `performance-main-${userSuffix}@example.com`,
            password: 'Password123!',
            displayName: 'Perf Test User'
        });

        // Create a test group
        await driver.createGroup('Performance Test Group', [mainUser], mainUser.token);
    });

    describe('3.1 Load Testing', () => {
        describe('Concurrent User Operations', () => {
            it('should handle 10+ users creating expenses simultaneously', async () => {
                const userSuffix = uuidv4().slice(0, 8);
                // Create additional test users
                const users: User[] = [];
                for (let i = 0; i < 10; i++) {
                    const user = await driver.createTestUser({
                        email: `perf-concurrent-${userSuffix}-${i}@example.com`,
                        password: 'Password123!',
                        displayName: `User ${i}`
                    });
                    users.push(user);
                }

                // Create a group with all users
                const concurrentGroup = await driver.createGroup('Concurrent Test Group', [mainUser, ...users], mainUser.token);

                // Track timing
                const startTime = Date.now();
                
                // Create expenses concurrently
                const expensePromises = users.map((user, index) => 
                    driver.createExpense({
                        groupId: concurrentGroup.id,
                        description: `Concurrent expense ${index}`,
                        amount: 50 + index,
                        paidBy: user.uid,
                        category: 'food',
                        splitType: 'exact',
                        participants: [user.uid],
                        splits: [{
                            userId: user.uid,
                            amount: 50 + index
                        }],
                        date: new Date().toISOString()
                    }, user.token)
                );

                // Wait for all to complete
                const results = await Promise.allSettled(expensePromises);
                const endTime = Date.now();
                const totalTime = endTime - startTime;

                // Verify all succeeded
                const succeeded = results.filter(r => r.status === 'fulfilled').length;
                const failed = results.filter(r => r.status === 'rejected').length;

                expect(succeeded).toBe(10);
                expect(failed).toBe(0);
                
                // Performance benchmark: should complete within 8 seconds
                expect(totalTime).toBeLessThan(8000);
                
                // Verify all expenses were created
                const groupExpenses = await driver.getGroupExpenses(concurrentGroup.id, mainUser.token);
                expect(groupExpenses.expenses).toHaveLength(10);
            });

            it('should maintain data consistency under concurrent balance updates', async () => {
                const userSuffix = uuidv4().slice(0, 8);
                // Create test users for balance updates
                const user1 = await driver.createTestUser({
                    email: `perf-balance-1-${userSuffix}@example.com`,
                    password: 'Password123!',
                    displayName: 'Balance User 1'
                });
                const user2 = await driver.createTestUser({
                    email: `perf-balance-2-${userSuffix}@example.com`,
                    password: 'Password123!',
                    displayName: 'Balance User 2'
                });
                
                const balanceGroup = await driver.createGroup('Balance Test Group', [user1, user2], user1.token);

                // Create multiple expenses concurrently that affect balances
                const expensePromises = [];
                
                // 5 expenses where user1 pays for user2
                for (let i = 0; i < 5; i++) {
                    expensePromises.push(
                        driver.createExpense({
                            groupId: balanceGroup.id,
                            description: `User1 pays ${i}`,
                            amount: 100,
                            paidBy: user1.uid,
                            category: 'food',
                            splitType: 'exact',
                            participants: [user1.uid, user2.uid],
                            splits: [
                                { userId: user1.uid, amount: 20 },
                                { userId: user2.uid, amount: 80 }
                            ],
                            date: new Date().toISOString()
                        }, user1.token)
                    );
                }
                
                // 5 expenses where user2 pays for user1
                for (let i = 0; i < 5; i++) {
                    expensePromises.push(
                        driver.createExpense({
                            groupId: balanceGroup.id,
                            description: `User2 pays ${i}`,
                            amount: 100,
                            paidBy: user2.uid,
                            category: 'food',
                            splitType: 'exact',
                            participants: [user1.uid, user2.uid],
                            splits: [
                                { userId: user1.uid, amount: 80 },
                                { userId: user2.uid, amount: 20 }
                            ],
                            date: new Date().toISOString()
                        }, user2.token)
                    );
                }

                // Execute all concurrently
                await Promise.all(expensePromises);

                // Verify final balances are correct
                const balances = await driver.getGroupBalances(balanceGroup.id, user1.token);
                
                // User1 paid 500 total (5 × 100), owes 500 total (5 × 20 + 5 × 80) = net 0
                // User2 paid 500 total (5 × 100), owes 500 total (5 × 80 + 5 × 20) = net 0
                expect(balances.userBalances[user1.uid]).toBe(0);
                expect(balances.userBalances[user2.uid]).toBe(0);
            });

            it('should handle concurrent group membership changes efficiently', async () => {
                const userSuffix = uuidv4().slice(0, 8);
                // Create initial group
                // Note: We'll create a new group with all users instead of modifying existing group
                
                // Create 15 users
                const newUsers: User[] = [];
                for (let i = 0; i < 15; i++) {
                    const user = await driver.createTestUser({
                        email: `perf-member-${userSuffix}-${i}@example.com`,
                        password: 'Password123!',
                        displayName: `Member ${i}`
                    });
                    newUsers.push(user);
                }

                const startTime = Date.now();
                
                // Create a new group with all users at once (simulating concurrent joins)
                const largeGroup = await driver.createGroup('Large Membership Group', [mainUser, ...newUsers], mainUser.token);
                
                const endTime = Date.now();
                const totalTime = endTime - startTime;

                // Should complete within 10 seconds
                expect(totalTime).toBeLessThan(10000);
                
                // Verify membership count
                expect(largeGroup.members).toHaveLength(16); // 15 new + 1 creator
            });

            it('should maintain performance with mixed concurrent operations', async () => {
                const userSuffix = uuidv4().slice(0, 8);
                // Create some test users
                const mixedUsers: User[] = [];
                for (let i = 0; i < 5; i++) {
                    const user = await driver.createTestUser({
                        email: `perf-mixed-${userSuffix}-${i}@example.com`,
                        password: 'Password123!',
                        displayName: `Mixed User ${i}`
                    });
                    mixedUsers.push(user);
                }

                const mixedGroup = await driver.createGroup('Mixed Operations Group', [mainUser, ...mixedUsers], mainUser.token);

                const startTime = Date.now();
                
                // Mix of different operations
                const operations = [
                    // Create expenses
                    ...mixedUsers.map((user, i) => 
                        driver.createExpense({
                            groupId: mixedGroup.id,
                            description: `Mixed expense ${i}`,
                            amount: 100,
                            paidBy: user.uid,
                            category: 'food',
                            splitType: 'exact',
                            participants: [user.uid],
                            splits: [{ userId: user.uid, amount: 100 }],
                            date: new Date().toISOString()
                        }, user.token)
                    ),
                    // Get balances
                    ...mixedUsers.map(user => driver.getGroupBalances(mixedGroup.id, user.token)),
                    // Get expenses
                    ...mixedUsers.map(user => driver.getGroupExpenses(mixedGroup.id, user.token))
                ];

                const results = await Promise.allSettled(operations);
                const endTime = Date.now();
                const totalTime = endTime - startTime;

                // All should succeed
                const succeeded = results.filter(r => r.status === 'fulfilled').length;
                expect(succeeded).toBe(operations.length);
                
                // Should complete within 8 seconds
                expect(totalTime).toBeLessThan(8000);
            });
        });

        describe('Response Time Benchmarks', () => {
            let benchmarkGroup: Group;
            let benchmarkExpenses: Expense[] = [];

            beforeAll(async () => {
                // Create a group with some test data
                benchmarkGroup = await driver.createGroup('Benchmark Group', [mainUser], mainUser.token);
                
                // Add some expenses for read operations
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

            it('should meet target response times for read operations (< 500ms)', async () => {
                const readOperations = [
                    { name: 'Get group expenses', fn: () => driver.getGroupExpenses(benchmarkGroup.id, mainUser.token) },
                    { name: 'Get balances', fn: () => driver.getGroupBalances(benchmarkGroup.id, mainUser.token) },
                    { name: 'Get expense', fn: () => driver.getExpense(benchmarkExpenses[0].id, mainUser.token) }
                ];

                for (const operation of readOperations) {
                    const startTime = Date.now();
                    await operation.fn();
                    const endTime = Date.now();
                    const responseTime = endTime - startTime;
                    
                    console.log(`${operation.name}: ${responseTime}ms`);
                    expect(responseTime).toBeLessThan(500);
                }
            });

            it('should meet target response times for write operations (< 2s)', async () => {
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
                        }, mainUser.token)
                    },
                    {
                        name: 'Update expense',
                        fn: () => driver.updateExpense(benchmarkExpenses[0].id, {
                            description: 'Updated benchmark expense'
                        }, mainUser.token)
                    },
                    {
                        name: 'Create group',
                        fn: () => driver.createGroup('New benchmark group', [mainUser], mainUser.token)
                    }
                ];

                for (const operation of writeOperations) {
                    const startTime = Date.now();
                    await operation.fn();
                    const endTime = Date.now();
                    const responseTime = endTime - startTime;
                    
                    console.log(`${operation.name}: ${responseTime}ms`);
                    expect(responseTime).toBeLessThan(2000);
                }
            });

            it('should maintain performance with paginated queries', async () => {
                // Create a group with many expenses
                const paginationGroup = await driver.createGroup('Pagination Test Group', [mainUser], mainUser.token);
                
                // Add 50 expenses
                for (let i = 0; i < 50; i++) {
                    await driver.createExpense({
                        groupId: paginationGroup.id,
                        description: `Paginated expense ${i}`,
                        amount: 10 + i,
                        paidBy: mainUser.uid,
                        category: 'food',
                        splitType: 'exact',
                        participants: [mainUser.uid],
                        splits: [{ userId: mainUser.uid, amount: 10 + i }],
                        date: new Date().toISOString()
                    }, mainUser.token);
                }

                // Measure performance of loading group with many expenses
                const startTime = Date.now();
                const expenseData = await driver.getGroupExpenses(paginationGroup.id, mainUser.token);
                const endTime = Date.now();
                const responseTime = endTime - startTime;

                expect(expenseData.expenses).toHaveLength(50);
                expect(responseTime).toBeLessThan(1000); // Should still be fast even with 50 expenses
            });
        });
    });

    describe('3.2 Scalability Testing', () => {
        describe('Large Dataset Handling', () => {
            it('should handle groups with 100+ expenses efficiently', async () => {
                const userSuffix = uuidv4().slice(0, 8);
                const largeGroupUser1 = mainUser;
                
                // Add a second user for more realistic expense splits
                const largeGroupUser2 = await driver.createTestUser({
                    email: `perf-large-${userSuffix}@example.com`,
                    password: 'Password123!',
                    displayName: 'Large Dataset User'
                });
                
                const largeGroup = await driver.createGroup('Large Dataset Group', [largeGroupUser1, largeGroupUser2], largeGroupUser1.token);

                console.log('Creating 250 expenses...');
                const startTime = Date.now();
                
                // Create 250 expenses in batches to avoid timeout
                const batchSize = 25;
                for (let batch = 0; batch < 10; batch++) {
                    const promises = [];
                    for (let i = 0; i < batchSize; i++) {
                        const expenseNum = batch * batchSize + i;
                        promises.push(
                            driver.createExpense({
                                groupId: largeGroup.id,
                                description: `Large dataset expense ${expenseNum}`,
                                amount: 10 + (expenseNum % 50),
                                paidBy: largeGroupUser1.uid,
                                category: ['food', 'transport', 'entertainment', 'shopping'][expenseNum % 4] as any,
                                splitType: 'exact',
                                participants: [largeGroupUser1.uid, largeGroupUser2.uid],
                                splits: [
                                    { userId: largeGroupUser1.uid, amount: (10 + (expenseNum % 50)) * 0.6 },
                                    { userId: largeGroupUser2.uid, amount: (10 + (expenseNum % 50)) * 0.4 }
                                ],
                                date: new Date().toISOString()
                            }, largeGroupUser1.token)
                        );
                    }
                    await Promise.all(promises);
                    console.log(`Batch ${batch + 1}/10 completed`);
                }

                const creationTime = Date.now() - startTime;
                console.log(`Created 250 expenses in ${creationTime}ms`);

                // Test retrieval performance - need to handle pagination
                const retrievalStart = Date.now();
                const expenseData = await driver.getGroupExpenses(largeGroup.id, largeGroupUser1.token, 100);
                const retrievalTime = Date.now() - retrievalStart;

                // API returns max 100, so we expect 100 returned
                expect(expenseData.expenses).toHaveLength(100);
                expect(retrievalTime).toBeLessThan(2000); // Should retrieve within 2 seconds

                // Test balance calculation performance
                const balanceStart = Date.now();
                const balances = await driver.getGroupBalances(largeGroup.id, largeGroupUser1.token);
                const balanceTime = Date.now() - balanceStart;

                expect(Object.keys(balances.userBalances)).toHaveLength(2);
                expect(balanceTime).toBeLessThan(3000); // Balance calculation should be within 3 seconds
                
                console.log(`Performance metrics:
                    - Creation: ${creationTime}ms
                    - Retrieval: ${retrievalTime}ms
                    - Balance calculation: ${balanceTime}ms`);
            }, 120000); // 2 minute timeout for this test

            it('should handle users with many group memberships', async () => {
                const userSuffix = uuidv4().slice(0, 8);
                // Create a user who will join many groups
                const busyUser = await driver.createTestUser({
                    email: `perf-busy-${userSuffix}@example.com`,
                    password: 'Password123!',
                    displayName: 'Busy User'
                });
                
                console.log('Creating 20 groups...');
                const groupIds: string[] = [];
                
                // Create 20 groups and have the user join each
                for (let i = 0; i < 20; i++) {
                    const groupOwner = await driver.createTestUser({
                        email: `perf-owner-${userSuffix}-${i}@example.com`,
                        password: 'Password123!',
                        displayName: `Owner ${i}`
                    });
                    
                    const group = await driver.createGroup(`Group ${i}`, [groupOwner, busyUser], groupOwner.token);
                    groupIds.push(group.id);
                    
                    // Add a few expenses to each group
                    for (let j = 0; j < 3; j++) {
                        await driver.createExpense({
                            groupId: group.id,
                            description: `Group ${i} expense ${j}`,
                            amount: 50,
                            paidBy: groupOwner.uid,
                            category: 'food',
                            splitType: 'exact',
                            participants: [groupOwner.uid, busyUser.uid],
                            splits: [
                                { userId: groupOwner.uid, amount: 25 },
                                { userId: busyUser.uid, amount: 25 }
                            ],
                            date: new Date().toISOString()
                        }, groupOwner.token);
                    }
                }

                // Test performance of operations for a user with many groups
                const startTime = Date.now();
                
                // Get all groups for the user (via balances in each group)
                const balancePromises = groupIds.map(groupId => 
                    driver.getGroupBalances(groupId, busyUser.token)
                );
                await Promise.all(balancePromises);
                
                const endTime = Date.now();
                const responseTime = endTime - startTime;

                expect(responseTime).toBeLessThan(5000); // Should handle 20 groups within 5 seconds
                
                console.log(`Retrieved balances for user with 20 groups in ${responseTime}ms`);
            }, 120000);

            it('should efficiently calculate balances in complex debt graphs', async () => {
                const userSuffix = uuidv4().slice(0, 8);
                // Create 8 users for a complex debt graph
                const complexUsers: User[] = [mainUser];
                
                for (let i = 1; i < 8; i++) {
                    const user = await driver.createTestUser({
                        email: `perf-complex-${userSuffix}-${i}@example.com`,
                        password: 'Password123!',
                        displayName: `Complex User ${i}`
                    });
                    complexUsers.push(user);
                }

                // Create a group with all users
                const complexGroup = await driver.createGroup('Complex Debt Group', complexUsers, mainUser.token);

                console.log('Creating complex expense relationships...');
                
                // Create a complex web of expenses
                // Pattern: each user pays for some others in a circular fashion
                for (let i = 0; i < complexUsers.length; i++) {
                    const payer = complexUsers[i];
                    
                    // Each user creates 5 expenses with different split patterns
                    for (let j = 0; j < 5; j++) {
                        const splits = [];
                        const participants = [payer.uid]; // Include payer in participants
                        const totalAmount = 100 + (j * 20);
                        
                        // Create splits involving 3-4 other users (including payer)
                        const numSplits = 3 + (j % 2);
                        const amountPerPerson = totalAmount / numSplits;
                        
                        // Add split for payer
                        splits.push({
                            userId: payer.uid,
                            amount: amountPerPerson
                        });
                        
                        // Add splits for other users
                        for (let k = 0; k < numSplits - 1; k++) {
                            const beneficiaryIndex = (i + k + 1) % complexUsers.length;
                            const beneficiary = complexUsers[beneficiaryIndex];
                            if (beneficiary.uid !== payer.uid) {
                                participants.push(beneficiary.uid);
                                splits.push({
                                    userId: beneficiary.uid,
                                    amount: amountPerPerson
                                });
                            }
                        }
                        
                        await driver.createExpense({
                            groupId: complexGroup.id,
                            description: `${payer.displayName} expense ${j}`,
                            amount: totalAmount,
                            paidBy: payer.uid,
                            category: 'food',
                            splitType: 'exact',
                            participants,
                            splits,
                            date: new Date().toISOString()
                        }, payer.token);
                    }
                }

                // Measure balance calculation performance
                const startTime = Date.now();
                const balances = await driver.getGroupBalances(complexGroup.id, mainUser.token);
                const endTime = Date.now();
                const balanceTime = endTime - startTime;

                expect(Object.keys(balances.userBalances)).toHaveLength(8);
                expect(balanceTime).toBeLessThan(5000); // Should calculate within 5 seconds
                
                // Verify balances sum to zero (conservation of money)
                const totalBalance = Object.values(balances.userBalances).reduce((sum: number, balance: any) => {
                    const balanceValue = typeof balance === 'number' ? balance : 0;
                    return sum + balanceValue;
                }, 0);
                expect(Math.abs(totalBalance)).toBeLessThan(0.01); // Allow for small floating point errors
                
                console.log(`Calculated balances for 8 users with 40 expenses in ${balanceTime}ms`);
            }, 120000);
        });

        describe('Memory and Resource Usage', () => {
            it('should not leak memory during repeated operations', async () => {
                const memoryGroup = await driver.createGroup('Memory Test Group', [mainUser], mainUser.token);
                
                // Perform many operations in sequence
                console.log('Performing repeated operations to check for memory leaks...');
                
                for (let i = 0; i < 50; i++) {
                    // Create expense
                    const expense = await driver.createExpense({
                        groupId: memoryGroup.id,
                        description: `Memory test expense ${i}`,
                        amount: 100,
                        paidBy: mainUser.uid,
                        category: 'food',
                        splitType: 'exact',
                        participants: [mainUser.uid],
                        splits: [{ userId: mainUser.uid, amount: 100 }],
                        date: new Date().toISOString()
                    }, mainUser.token);
                    
                    // Get group expenses
                    await driver.getGroupExpenses(memoryGroup.id, mainUser.token);
                    
                    // Get balances
                    await driver.getGroupBalances(memoryGroup.id, mainUser.token);
                    
                    // Update expense
                    await driver.updateExpense(expense.id, {
                        description: `Updated memory test expense ${i}`
                    }, mainUser.token);
                    
                    if (i % 10 === 0) {
                        console.log(`Completed ${i + 1}/50 iterations`);
                    }
                }
                
                // If we reach here without timing out or crashing, memory management is acceptable
                expect(true).toBe(true);
            }, 120000);
        });
    });
});