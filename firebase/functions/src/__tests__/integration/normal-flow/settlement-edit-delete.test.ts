/**
 * @jest-environment node
 */

// Integration tests for settlement editing and deletion functionality

import { ApiDriver, User } from '../../support/ApiDriver';
import { SettlementBuilder, SettlementUpdateBuilder } from '../../support/builders';
import { FirebaseIntegrationTestUserPool } from '../../support/FirebaseIntegrationTestUserPool';

describe('Settlement Edit and Delete Operations', () => {
    let userPool: FirebaseIntegrationTestUserPool;
    let driver: ApiDriver;
    let user1: User;
    let user2: User;
    let user3: User;
    let groupId: string;

    jest.setTimeout(10000);

    beforeAll(async () => {
        driver = new ApiDriver();
        
        // Create user pool with 3 users
        userPool = new FirebaseIntegrationTestUserPool(driver, 3);
        await userPool.initialize();
    });

    beforeEach(async () => {
        // Use users from pool
        const users = userPool.getUsers(3);
        user1 = users[0];
        user2 = users[1];
        user3 = users[2];

        // Create a group with all users as members
        const testGroup = await driver.createGroupWithMembers(
            'Test Group for Settlement Edit/Delete', 
            [user1, user2, user3], 
            user1.token
        );
        groupId = testGroup.id;
    });

    afterEach(async () => {
        // Clean up test data
    });

    describe('Settlement Updates', () => {
        it('should successfully update a settlement', async () => {
            // Create initial settlement
            const initialSettlement = new SettlementBuilder()
                .withGroupId(groupId)
                .withPayer(user1.uid)
                .withPayee(user2.uid)
                .withAmount(100.0)
                .withCurrency('USD')
                .withNote('Initial payment')
                .withDate(new Date().toISOString())
                .build();

            const createdSettlement = await driver.createSettlement(initialSettlement, user1.token);
            expect(createdSettlement.id).toBeDefined();

            // Update the settlement using builder
            const updateData = new SettlementUpdateBuilder()
                .withAmount(150.0)
                .withCurrency('USD')
                .withDate(new Date().toISOString())
                .withNote('Updated payment')
                .build();

            const updatedSettlement = await driver.updateSettlement(
                createdSettlement.id, 
                updateData, 
                user1.token
            );

            // Verify the update (payer/payee cannot be changed)
            expect(updatedSettlement.payer.uid).toBe(user1.uid); // Should remain unchanged
            expect(updatedSettlement.payee.uid).toBe(user2.uid); // Should remain unchanged
            expect(updatedSettlement.amount).toBe(150.0);
            expect(updatedSettlement.note).toBe('Updated payment');
        });

        it('should generate change notification when settlement is updated', async () => {
            // Create initial settlement
            const initialSettlement = new SettlementBuilder()
                .withGroupId(groupId)
                .withPayer(user1.uid)
                .withPayee(user2.uid)
                .withAmount(75.0)
                .withCurrency('USD')
                .build();

            const createdSettlement = await driver.createSettlement(initialSettlement, user1.token);

            // Wait for initial settlement creation change to be processed
            await driver.waitForSettlementCreationEvent(groupId, createdSettlement.id, [user1, user2]);

            // Update the settlement using builder
            const updateData = new SettlementUpdateBuilder()
                .withAmount(125.0)
                .withCurrency('USD')
                .withDate(new Date().toISOString())
                .build();

            await driver.updateSettlement(createdSettlement.id, updateData, user1.token);

            // Wait for the settlement update event
            await driver.waitForSettlementUpdatedEvent(groupId, createdSettlement.id, [user1, user2]);

            // Verify the change notification exists
            const changeNotification = await driver.mostRecentSettlementChangeEvent(groupId);
            expect(changeNotification).toBeTruthy();
            expect(changeNotification!.groupId).toBe(groupId);
            expect(changeNotification!.id).toBe(createdSettlement.id);
            expect(changeNotification!.type).toBe('settlement');
            expect(changeNotification!.action).toBe('updated');
            expect(changeNotification!.users).toContain(user1.uid);
            expect(changeNotification!.users).toContain(user2.uid);
        });

        it('should only allow the creator to update a settlement', async () => {
            // Create settlement as user1
            const initialSettlement = new SettlementBuilder()
                .withGroupId(groupId)
                .withPayer(user1.uid)
                .withPayee(user2.uid)
                .withAmount(50.0)
                .withCurrency('USD')
                .build();

            const createdSettlement = await driver.createSettlement(initialSettlement, user1.token);

            // Try to update as user2 (not the creator) - should fail
            const updateData = new SettlementUpdateBuilder()
                .withAmount(60.0)
                .withCurrency('USD')
                .withDate(new Date().toISOString())
                .withNote('Updated by different user')
                .build();

            await expect(
                driver.updateSettlement(
                    createdSettlement.id, 
                    updateData, 
                    user2.token  // Different user
                )
            ).rejects.toThrow(/403.*NOT_SETTLEMENT_CREATOR/);

            // But user1 (creator) can update
            const updatedSettlement = await driver.updateSettlement(
                createdSettlement.id, 
                updateData, 
                user1.token  // Creator
            );

            expect(updatedSettlement.amount).toBe(60.0);
            expect(updatedSettlement.note).toBe('Updated by different user');
        });

        it('should update balances when settlement amount is changed', async () => {
            // Create initial settlement
            const initialSettlement = new SettlementBuilder()
                .withGroupId(groupId)
                .withPayer(user1.uid)
                .withPayee(user2.uid)
                .withAmount(100.0)
                .withCurrency('USD')
                .build();

            const createdSettlement = await driver.createSettlement(initialSettlement, user1.token);

            // Get initial balances
            const initialBalances = await driver.getGroupBalances(groupId, user1.token);
            expect(initialBalances).toBeDefined();
            
            // Update settlement with different amount using builder
            const updateData = new SettlementUpdateBuilder()
                .withAmount(200.0)  // Double the amount
                .withCurrency('USD')
                .withDate(new Date().toISOString())
                .build();

            await driver.updateSettlement(createdSettlement.id, updateData, user1.token);

            // Get updated balances
            const updatedBalances = await driver.getGroupBalances(groupId, user1.token);
            expect(updatedBalances).toBeDefined();
            
            // Settlements do affect balance calculations - balances should have changed
            expect(updatedBalances).not.toEqual(initialBalances);
            
            // Verify the change - user1 paid user2, so user1 is owed more and user2 owes more
            const user1BalanceInitial = initialBalances.userBalances[user1.uid];
            const user1BalanceUpdated = updatedBalances.userBalances[user1.uid];
            
            expect(user1BalanceUpdated.netBalance).toBeGreaterThan(user1BalanceInitial.netBalance);
        });
    });

    describe('Settlement Deletion', () => {
        it('should successfully delete a settlement', async () => {
            // Create a settlement
            const settlement = new SettlementBuilder()
                .withGroupId(groupId)
                .withPayer(user1.uid)
                .withPayee(user2.uid)
                .withAmount(80.0)
                .withCurrency('USD')
                .build();

            const createdSettlement = await driver.createSettlement(settlement, user1.token);
            expect(createdSettlement.id).toBeDefined();

            // Delete the settlement
            await driver.deleteSettlement(createdSettlement.id, user1.token);

            // Verify settlement is deleted (should throw 404)
            await expect(
                driver.getSettlement(createdSettlement.id, user1.token)
            ).rejects.toThrow(/404/);
        });

        it('should generate change notification when settlement is deleted', async () => {
            // Create a settlement
            const settlement = new SettlementBuilder()
                .withGroupId(groupId)
                .withPayer(user2.uid)
                .withPayee(user3.uid)
                .withAmount(90.0)
                .withCurrency('USD')
                .build();

            const createdSettlement = await driver.createSettlement(settlement, user1.token);

            // Wait for initial settlement creation change to be processed
            await driver.waitForSettlementCreationEvent(groupId, createdSettlement.id, [user2, user3]);

            // Delete the settlement
            await driver.deleteSettlement(createdSettlement.id, user1.token);

            // Wait for the settlement deletion event
            await driver.waitForSettlementDeletedEvent(groupId, createdSettlement.id, [user2, user3]);

            // Verify the change notification exists
            const changeNotification = await driver.mostRecentSettlementChangeEvent(groupId);
            expect(changeNotification).toBeTruthy();
            expect(changeNotification!.groupId).toBe(groupId);
            expect(changeNotification!.id).toBe(createdSettlement.id);
            expect(changeNotification!.type).toBe('settlement');
            expect(changeNotification!.action).toBe('deleted');
        });

        it('should only allow the creator to delete a settlement', async () => {
            // Create settlement as user1
            const settlement = new SettlementBuilder()
                .withGroupId(groupId)
                .withPayer(user1.uid)
                .withPayee(user3.uid)
                .withAmount(120.0)
                .withCurrency('USD')
                .build();

            const createdSettlement = await driver.createSettlement(settlement, user1.token);

            // Try to delete as user3 (not the creator) - should fail
            await expect(
                driver.deleteSettlement(createdSettlement.id, user3.token)
            ).rejects.toThrow(/403.*NOT_SETTLEMENT_CREATOR/);

            // Verify settlement still exists
            const stillExists = await driver.getSettlement(createdSettlement.id, user1.token);
            expect(stillExists.id).toBe(createdSettlement.id);

            // Now delete as the creator (user1) - should succeed
            await driver.deleteSettlement(createdSettlement.id, user1.token);

            // Verify deletion
            await expect(
                driver.getSettlement(createdSettlement.id, user1.token)
            ).rejects.toThrow(/404/);
        });

        it('should update balances when settlement is deleted', async () => {
            // Create a settlement
            const settlement = new SettlementBuilder()
                .withGroupId(groupId)
                .withPayer(user1.uid)
                .withPayee(user2.uid)
                .withAmount(150.0)
                .withCurrency('USD')
                .build();

            const createdSettlement = await driver.createSettlement(settlement, user1.token);

            // Get balances after settlement creation
            const balancesWithSettlement = await driver.getGroupBalances(groupId, user1.token);
            expect(balancesWithSettlement).toBeDefined();

            // Delete the settlement
            await driver.deleteSettlement(createdSettlement.id, user1.token);

            // Get balances after deletion
            const balancesAfterDeletion = await driver.getGroupBalances(groupId, user1.token);
            expect(balancesAfterDeletion).toBeDefined();

            // Settlements do affect balances - after deletion, balances should change
            expect(balancesAfterDeletion).not.toEqual(balancesWithSettlement);
            
            // After deleting the settlement, the debt should be reduced or eliminated
            const user1BalanceWithSettlement = balancesWithSettlement.userBalances[user1.uid];
            const user1BalanceAfterDeletion = balancesAfterDeletion.userBalances[user1.uid];
            
            if (user1BalanceAfterDeletion) {
                expect(user1BalanceAfterDeletion.netBalance).toBeLessThan(user1BalanceWithSettlement.netBalance);
            } else {
                // If user1 has no balance after deletion, that means no debt remains
                expect(Object.keys(balancesAfterDeletion.userBalances)).not.toContain(user1.uid);
            }
        });
    });

    describe('Error Cases', () => {
        it('should return 404 when updating non-existent settlement', async () => {
            const fakeSettlementId = 'non-existent-settlement-id';
            const updateData = new SettlementUpdateBuilder()
                .withAmount(100.0)
                .withCurrency('USD')
                .withDate(new Date().toISOString())
                .build();

            await expect(
                driver.updateSettlement(fakeSettlementId, updateData, user1.token)
            ).rejects.toThrow(/404/);
        });

        it('should return 404 when deleting non-existent settlement', async () => {
            const fakeSettlementId = 'non-existent-settlement-id';

            await expect(
                driver.deleteSettlement(fakeSettlementId, user1.token)
            ).rejects.toThrow(/404/);
        });

        it('should return 403 when non-member tries to update settlement', async () => {
            // Create a new group without user3
            const exclusiveGroup = await driver.createGroupWithMembers(
                'Exclusive Group', 
                [user1, user2], 
                user1.token
            );

            // Create settlement in exclusive group
            const settlement = new SettlementBuilder()
                .withGroupId(exclusiveGroup.id)
                .withPayer(user1.uid)
                .withPayee(user2.uid)
                .withAmount(100.0)
                .withCurrency('USD')
                .build();

            const createdSettlement = await driver.createSettlement(settlement, user1.token);

            // Try to update as user3 (not a member)
            const updateData = new SettlementUpdateBuilder()
                .withAmount(200.0)
                .withCurrency('USD')
                .withDate(new Date().toISOString())
                .build();

            await expect(
                driver.updateSettlement(createdSettlement.id, updateData, user3.token)
            ).rejects.toThrow(/403|404/);  // May return 404 for security
        });

        it('should return 403 when non-member tries to delete settlement', async () => {
            // Create a new group without user3
            const exclusiveGroup = await driver.createGroupWithMembers(
                'Exclusive Group 2', 
                [user1, user2], 
                user1.token
            );

            // Create settlement in exclusive group
            const settlement = new SettlementBuilder()
                .withGroupId(exclusiveGroup.id)
                .withPayer(user1.uid)
                .withPayee(user2.uid)
                .withAmount(100.0)
                .withCurrency('USD')
                .build();

            const createdSettlement = await driver.createSettlement(settlement, user1.token);

            // Try to delete as user3 (not a member)
            await expect(
                driver.deleteSettlement(createdSettlement.id, user3.token)
            ).rejects.toThrow(/403|404/);  // May return 404 for security
        });

        it('should validate settlement data on update', async () => {
            // Create a settlement
            const settlement = new SettlementBuilder()
                .withGroupId(groupId)
                .withPayer(user1.uid)
                .withPayee(user2.uid)
                .withAmount(100.0)
                .withCurrency('USD')
                .build();

            const createdSettlement = await driver.createSettlement(settlement, user1.token);

            // Try to update with invalid amount using builder
            const invalidUpdateData = new SettlementUpdateBuilder()
                .withAmount(-50.0)  // Negative amount
                .withCurrency('USD')
                .withDate(new Date().toISOString())
                .build();

            await expect(
                driver.updateSettlement(createdSettlement.id, invalidUpdateData, user1.token)
            ).rejects.toThrow(/400|validation/i);
        });

        it('should validate update data properly', async () => {
            // Create a valid settlement
            const settlement = new SettlementBuilder()
                .withGroupId(groupId)
                .withPayer(user1.uid)
                .withPayee(user2.uid)
                .withAmount(100.0)
                .withCurrency('USD')
                .build();

            const createdSettlement = await driver.createSettlement(settlement, user1.token);

            // Try to update with invalid currency length using builder
            const invalidUpdateData = new SettlementUpdateBuilder()
                .withCurrency('INVALID')  // More than 3 characters
                .withAmount(100.0)
                .build();

            await expect(
                driver.updateSettlement(createdSettlement.id, invalidUpdateData, user1.token)
            ).rejects.toThrow(/400|validation/i);
        });
    });
});