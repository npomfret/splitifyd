import {ApiDriver, User} from '../support/ApiDriver';
import type {ExpenseData, Group} from "../../src/types/webapp-shared-types";

export class PerformanceTestWorkers {
    constructor(private driver: ApiDriver) {}

    async createConcurrentExpenses(params: {
        users: User[];
        group: Group;
        expensesPerUser: number;
        timeoutMs?: number;
    }): Promise<{
        totalTime: number;
        succeeded: number;
        failed: number;
        expenses: ExpenseData[];
    }> {
        const { users, group, expensesPerUser } = params;
        const startTime = Date.now();
        
        const expensePromises = users.flatMap((user, userIndex) => 
            Array.from({ length: expensesPerUser }, (_, expenseIndex) => 
                this.driver.createExpense({
                    groupId: group.id,
                    description: `Concurrent expense U${userIndex}E${expenseIndex}`,
                    amount: 50 + (userIndex * expensesPerUser + expenseIndex),
                    paidBy: user.uid,
                    category: 'food',
                    splitType: 'exact',
                    participants: [user.uid],
                    splits: [{
                        userId: user.uid,
                        amount: 50 + (userIndex * expensesPerUser + expenseIndex)
                    }],
                    date: new Date().toISOString()
                }, user.token)
            )
        );

        const results = await Promise.allSettled(expensePromises);
        const endTime = Date.now();
        const totalTime = endTime - startTime;

        const succeeded = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.filter(r => r.status === 'rejected').length;
        const expenses = results
            .filter((r): r is PromiseFulfilledResult<ExpenseData> => r.status === 'fulfilled')
            .map(r => r.value);

        return { totalTime, succeeded, failed, expenses };
    }

    async createBalanceTestExpenses(params: {
        user1: User;
        user2: User;
        group: Group;
        expensesPerUserPair: number;
    }): Promise<void> {
        const { user1, user2, group, expensesPerUserPair } = params;
        const expensePromises = [];
        
        // Half expenses where user1 pays for user2
        for (let i = 0; i < expensesPerUserPair; i++) {
            expensePromises.push(
                this.driver.createExpense({
                    groupId: group.id,
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
        
        // Half expenses where user2 pays for user1
        for (let i = 0; i < expensesPerUserPair; i++) {
            expensePromises.push(
                this.driver.createExpense({
                    groupId: group.id,
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

        // Execute in smaller batches to avoid overwhelming the API
        const batchSize = 2;
        for (let i = 0; i < expensePromises.length; i += batchSize) {
            const batch = expensePromises.slice(i, i + batchSize);
            await Promise.all(batch);
            // Add small delay between batches to avoid overwhelming the emulator
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }

    async createLargeGroupExpenses(params: {
        group: Group;
        user1: User;
        user2: User;
        totalExpenses: number;
        batchSize: number;
    }): Promise<{
        creationTime: number;
        retrievalTime: number;
        balanceTime: number;
    }> {
        const { group, user1, user2, totalExpenses, batchSize } = params;
        
        console.log(`Creating ${totalExpenses} expenses in batches of ${batchSize}...`);
        const startTime = Date.now();
        
        const totalBatches = Math.ceil(totalExpenses / batchSize);
        for (let batch = 0; batch < totalBatches; batch++) {
            const promises = [];
            const batchStart = batch * batchSize;
            const batchEnd = Math.min(batchStart + batchSize, totalExpenses);
            
            for (let i = batchStart; i < batchEnd; i++) {
                promises.push(
                    this.driver.createExpense({
                        groupId: group.id,
                        description: `Large dataset expense ${i}`,
                        amount: 10 + (i % 50),
                        paidBy: user1.uid,
                        category: ['food', 'transport', 'entertainment', 'shopping'][i % 4] as any,
                        splitType: 'exact',
                        participants: [user1.uid, user2.uid],
                        splits: [
                            { userId: user1.uid, amount: (10 + (i % 50)) * 0.6 },
                            { userId: user2.uid, amount: (10 + (i % 50)) * 0.4 }
                        ],
                        date: new Date().toISOString()
                    }, user1.token)
                );
            }
            await Promise.all(promises);
            console.log(`Batch ${batch + 1}/${totalBatches} completed`);
        }

        const creationTime = Date.now() - startTime;
        console.log(`Created ${totalExpenses} expenses in ${creationTime}ms`);

        // Test retrieval performance
        const retrievalStart = Date.now();
        await this.driver.getGroupExpenses(group.id, user1.token, 100);
        const retrievalTime = Date.now() - retrievalStart;

        // Test balance calculation performance
        const balanceStart = Date.now();
        await this.driver.getGroupBalances(group.id, user1.token);
        const balanceTime = Date.now() - balanceStart;

        return { creationTime, retrievalTime, balanceTime };
    }

    async createComplexDebtGraph(params: {
        users: User[];
        group: Group;
        expensesPerUser: number;
    }): Promise<{
        totalExpenses: number;
        balanceCalculationTime: number;
    }> {
        const { users, group, expensesPerUser } = params;
        
        console.log('Creating complex expense relationships...');
        let totalExpenses = 0;
        
        for (let i = 0; i < users.length; i++) {
            const payer = users[i];
            
            for (let j = 0; j < expensesPerUser; j++) {
                const splits = [];
                const participants = [payer.uid];
                const totalAmount = 100 + (j * 20);
                
                const numSplits = 3 + (j % 2);
                const amountPerPerson = totalAmount / numSplits;
                
                splits.push({
                    userId: payer.uid,
                    amount: amountPerPerson
                });
                
                for (let k = 0; k < numSplits - 1; k++) {
                    const beneficiaryIndex = (i + k + 1) % users.length;
                    const beneficiary = users[beneficiaryIndex];
                    if (beneficiary.uid !== payer.uid) {
                        participants.push(beneficiary.uid);
                        splits.push({
                            userId: beneficiary.uid,
                            amount: amountPerPerson
                        });
                    }
                }
                
                await this.driver.createExpense({
                    groupId: group.id,
                    description: `${payer.displayName} expense ${j}`,
                    amount: totalAmount,
                    paidBy: payer.uid,
                    category: 'food',
                    splitType: 'exact',
                    participants,
                    splits,
                    date: new Date().toISOString()
                }, payer.token);
                
                totalExpenses++;
            }
        }

        // Measure balance calculation performance
        const startTime = Date.now();
        await this.driver.getGroupBalances(group.id, users[0].token);
        const balanceCalculationTime = Date.now() - startTime;

        return { totalExpenses, balanceCalculationTime };
    }

    async performRepeatedOperations(params: {
        group: Group;
        user: User;
        iterations: number;
    }): Promise<void> {
        const { group, user, iterations } = params;
        
        console.log('Performing repeated operations to check for memory leaks...');
        
        for (let i = 0; i < iterations; i++) {
            // Create expense
            const expense = await this.driver.createExpense({
                groupId: group.id,
                description: `Memory test expense ${i}`,
                amount: 100,
                paidBy: user.uid,
                category: 'food',
                splitType: 'exact',
                participants: [user.uid],
                splits: [{ userId: user.uid, amount: 100 }],
                date: new Date().toISOString()
            }, user.token);
            
            // Get group expenses
            await this.driver.getGroupExpenses(group.id, user.token);
            
            // Get balances
            await this.driver.getGroupBalances(group.id, user.token);
            
            // Update expense
            await this.driver.updateExpense(expense.id, {
                description: `Updated memory test expense ${i}`
            }, user.token);
            
            if (i % 10 === 0) {
                console.log(`Completed ${i + 1}/${iterations} iterations`);
            }
        }
    }

    async handleGroupMemberships(params: {
        busyUser: User;
        groupCount: number;
        expensesPerGroup: number;
        userSuffix: string;
    }): Promise<{
        groupIds: string[];
        responseTime: number;
    }> {
        const { busyUser, groupCount, expensesPerGroup, userSuffix } = params;
        
        console.log(`Creating ${groupCount} groups...`);
        const groupIds: string[] = [];
        
        // Create groups and have the user join each
        for (let i = 0; i < groupCount; i++) {
            const groupOwner = await this.driver.createTestUser({
                email: `perf-owner-${userSuffix}-${i}@example.com`,
                password: 'Password123!',
                displayName: `Owner ${i}`
            });
            
            const group = await this.driver.createGroup(`Group ${i}`, [groupOwner, busyUser], groupOwner.token);
            groupIds.push(group.id);
            
            // Add a few expenses to each group
            for (let j = 0; j < expensesPerGroup; j++) {
                await this.driver.createExpense({
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
            this.driver.getGroupBalances(groupId, busyUser.token)
        );
        await Promise.all(balancePromises);
        
        const endTime = Date.now();
        const responseTime = endTime - startTime;

        return { groupIds, responseTime };
    }
}