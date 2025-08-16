/**
 * @jest-environment node
 */

import { ApiDriver } from '../../support/ApiDriver';
import { ExpenseBuilder, UserBuilder } from '../../support/builders';

describe('Performance - Balance Consistency Under Load', () => {
    let driver: ApiDriver;

    jest.setTimeout(60000);

    beforeAll(async () => {
        driver = new ApiDriver();
    });

    const testCases = [
        { expensesPerUserPair: 5, description: 'small dataset' },
        { expensesPerUserPair: 10, description: 'medium dataset' },
        { expensesPerUserPair: 15, description: 'large dataset' },
    ];

    testCases.forEach(({ expensesPerUserPair, description }) => {
        it(`should maintain data consistency with ${expensesPerUserPair * 2} concurrent balance updates (${description})`, async () => {
            const user1 = await driver.createUser(new UserBuilder().build());
            const user2 = await driver.createUser(new UserBuilder().build());
            
            const balanceGroup = await driver.createGroupWithMembers(`Balance Test Group (${expensesPerUserPair} expenses)`, [user1, user2], user1.token);

            // Create expenses concurrently in batches
            const batchSize = 5;
            for (let i = 0; i < expensesPerUserPair; i += batchSize) {
                const promises = [];
                for (let j = i; j < Math.min(i + batchSize, expensesPerUserPair); j++) {
                    // User1 pays for User2
                    promises.push(driver.createExpense(new ExpenseBuilder()
                        .withGroupId(balanceGroup.id)
                        .withDescription(`User1 pays ${j}`)
                        .withAmount(100)
                        .withPaidBy(user1.uid)
                        .withSplitType('exact')
                        .withParticipants([user1.uid, user2.uid])
                        .withSplits([
                            { userId: user1.uid, amount: 20 },
                            { userId: user2.uid, amount: 80 }
                        ])
                        .build(), user1.token));
                    
                    // User2 pays for User1
                    promises.push(driver.createExpense(new ExpenseBuilder()
                        .withGroupId(balanceGroup.id)
                        .withDescription(`User2 pays ${j}`)
                        .withAmount(100)
                        .withPaidBy(user2.uid)
                        .withSplitType('exact')
                        .withParticipants([user1.uid, user2.uid])
                        .withSplits([
                            { userId: user1.uid, amount: 80 },
                            { userId: user2.uid, amount: 20 }
                        ])
                        .build(), user2.token));
                }
                await Promise.all(promises);
            }

            // Wait for balance calculation trigger to complete
            const balances = await driver.waitForBalanceUpdate(balanceGroup.id, user1.token, 15000);
            
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