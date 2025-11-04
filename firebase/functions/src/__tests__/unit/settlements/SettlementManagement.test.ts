import { CreateExpenseRequestBuilder, CreateGroupRequestBuilder, CreateSettlementRequestBuilder, SettlementUpdateBuilder } from '@splitifyd/test-support';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AppDriver } from '../AppDriver';

/**
 * Settlement Management Unit Tests
 *
 * These tests verify settlement CRUD operations, access control, and soft delete behavior
 * using the in-memory SplitifydFirestoreTestDatabase for fast execution (100-300x faster than integration tests).
 *
 * Tests converted from balance-settlement-consolidated.test.ts integration tests.
 */
describe('Settlement Management - Unit Tests', () => {
    let appDriver: AppDriver;

    beforeEach(() => {
        appDriver = new AppDriver();
    });

    afterEach(() => {
        appDriver.dispose();
    });

    describe('Settlement Retrieval', () => {
        it('should retrieve a settlement by ID', async () => {
            // Arrange: Create users and group
            const creatorUserId = 'creator-user';
            const payerUserId = 'payer-user';
            const payeeUserId = 'payee-user';

            appDriver.seedUser(creatorUserId, { displayName: 'Creator' });
            appDriver.seedUser(payerUserId, { displayName: 'Payer' });
            appDriver.seedUser(payeeUserId, { displayName: 'Payee' });

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), creatorUserId);
            const { shareToken } = await appDriver.generateShareableLink(group.id, undefined, creatorUserId);
            await appDriver.joinGroupByLink(shareToken, undefined, payerUserId);
            await appDriver.joinGroupByLink(shareToken, undefined, payeeUserId);

            // Create settlement
            const settlementData = new CreateSettlementRequestBuilder()
                .withGroupId(group.id)
                .withPayerId(payerUserId)
                .withPayeeId(payeeUserId)
                .withAmount(100.0, 'USD')
                .withNote('Retrieve test')
                .build();

            const created = await appDriver.createSettlement(settlementData, creatorUserId);

            // Act: Retrieve settlement
            const retrieved = await appDriver.getSettlement(group.id, created.id, creatorUserId);

            // Assert
            expect(retrieved.id).toBe(created.id);
            expect(retrieved.amount).toBe('100');
            expect(retrieved.currency).toBe('USD');
            expect(retrieved.note).toBe('Retrieve test');
            expect(retrieved.payer).toBeDefined();
            expect(retrieved.payee).toBeDefined();
            expect(retrieved.payer.uid).toBe(payerUserId);
            expect(retrieved.payee.uid).toBe(payeeUserId);
        });

        it('should reject retrieval by non-group-member', async () => {
            // Arrange: Create users and group
            const creatorUserId = 'creator-user';
            const payerUserId = 'payer-user';
            const payeeUserId = 'payee-user';
            const outsiderUserId = 'outsider-user';

            appDriver.seedUser(creatorUserId, { displayName: 'Creator' });
            appDriver.seedUser(payerUserId, { displayName: 'Payer' });
            appDriver.seedUser(payeeUserId, { displayName: 'Payee' });
            appDriver.seedUser(outsiderUserId, { displayName: 'Outsider' });

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), creatorUserId);
            const { shareToken } = await appDriver.generateShareableLink(group.id, undefined, creatorUserId);
            await appDriver.joinGroupByLink(shareToken, undefined, payerUserId);
            await appDriver.joinGroupByLink(shareToken, undefined, payeeUserId);

            // Create settlement
            const settlementData = new CreateSettlementRequestBuilder()
                .withGroupId(group.id)
                .withPayerId(payerUserId)
                .withPayeeId(payeeUserId)
                .build();

            const created = await appDriver.createSettlement(settlementData, creatorUserId);

            // Act & Assert: Outsider cannot retrieve settlement
            await expect(
                appDriver.getSettlement(group.id, created.id, outsiderUserId),
            )
                .rejects
                .toThrow(/status 403.*NOT_GROUP_MEMBER/);
        });

        it('should handle non-existent settlement', async () => {
            // Arrange
            const userId = 'test-user';
            appDriver.seedUser(userId, { displayName: 'Test User' });

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), userId);

            // Act & Assert: Non-existent settlement throws error
            await expect(
                appDriver.getSettlement(group.id, 'non-existent-id', userId),
            )
                .rejects
                .toThrow(/status 404.*SETTLEMENT_NOT_FOUND/);
        });
    });

    describe('Settlement Updates', () => {
        it('should update settlement fields', async () => {
            // Arrange: Create users and group
            const creatorUserId = 'creator-user';
            const payerUserId = 'payer-user';
            const payeeUserId = 'payee-user';

            appDriver.seedUser(creatorUserId, { displayName: 'Creator' });
            appDriver.seedUser(payerUserId, { displayName: 'Payer' });
            appDriver.seedUser(payeeUserId, { displayName: 'Payee' });

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), creatorUserId);
            const { shareToken } = await appDriver.generateShareableLink(group.id, undefined, creatorUserId);
            await appDriver.joinGroupByLink(shareToken, undefined, payerUserId);
            await appDriver.joinGroupByLink(shareToken, undefined, payeeUserId);

            // Create settlement
            const settlementData = new CreateSettlementRequestBuilder()
                .withGroupId(group.id)
                .withPayerId(payerUserId)
                .withPayeeId(payeeUserId)
                .withAmount(100.0, 'USD')
                .withNote('Original note')
                .build();

            const created = await appDriver.createSettlement(settlementData, creatorUserId);

            // Act: Update settlement
            const updateData = new SettlementUpdateBuilder()
                .withAmount(150.0, 'USD')
                .withNote('Updated note')
                .build();

            const updated = await appDriver.updateSettlement(created.id, updateData, creatorUserId);

            // Assert
            expect(updated.id).toBe(created.id);
            expect(updated.amount).toBe('150');
            expect(updated.note).toBe('Updated note');
            expect(updated.currency).toBe('USD'); // Currency unchanged
        });

        it('should reject update by non-creator', async () => {
            // Arrange: Create users and group
            const creatorUserId = 'creator-user';
            const payerUserId = 'payer-user';
            const payeeUserId = 'payee-user';
            const otherMemberUserId = 'other-member';

            appDriver.seedUser(creatorUserId, { displayName: 'Creator' });
            appDriver.seedUser(payerUserId, { displayName: 'Payer' });
            appDriver.seedUser(payeeUserId, { displayName: 'Payee' });
            appDriver.seedUser(otherMemberUserId, { displayName: 'Other Member' });

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), creatorUserId);
            const { shareToken } = await appDriver.generateShareableLink(group.id, undefined, creatorUserId);
            await appDriver.joinGroupByLink(shareToken, undefined, payerUserId);
            await appDriver.joinGroupByLink(shareToken, undefined, payeeUserId);
            await appDriver.joinGroupByLink(shareToken, undefined, otherMemberUserId);

            // Create settlement
            const settlementData = new CreateSettlementRequestBuilder()
                .withGroupId(group.id)
                .withPayerId(payerUserId)
                .withPayeeId(payeeUserId)
                .build();

            const created = await appDriver.createSettlement(settlementData, creatorUserId);

            // Act & Assert: Non-creator cannot update
            const updateData = new SettlementUpdateBuilder()
                .withAmount(200.0, 'USD')
                .build();

            await expect(
                appDriver.updateSettlement(created.id, updateData, otherMemberUserId),
            )
                .rejects
                .toThrow(/Only the creator can update this settlement/);
        });

        it('should validate update data', async () => {
            // Arrange: Create users and group
            const creatorUserId = 'creator-user';
            const payerUserId = 'payer-user';
            const payeeUserId = 'payee-user';

            appDriver.seedUser(creatorUserId, { displayName: 'Creator' });
            appDriver.seedUser(payerUserId, { displayName: 'Payer' });
            appDriver.seedUser(payeeUserId, { displayName: 'Payee' });

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), creatorUserId);
            const { shareToken } = await appDriver.generateShareableLink(group.id, undefined, creatorUserId);
            await appDriver.joinGroupByLink(shareToken, undefined, payerUserId);
            await appDriver.joinGroupByLink(shareToken, undefined, payeeUserId);

            // Create settlement
            const settlementData = new CreateSettlementRequestBuilder()
                .withGroupId(group.id)
                .withPayerId(payerUserId)
                .withPayeeId(payeeUserId)
                .build();

            const created = await appDriver.createSettlement(settlementData, creatorUserId);

            // Act & Assert: Invalid amount (negative) should fail
            const invalidUpdateData = new SettlementUpdateBuilder()
                .withAmount(-100.0, 'USD')
                .build();

            await expect(
                appDriver.updateSettlement(created.id, invalidUpdateData, creatorUserId),
            )
                .rejects
                .toThrow(/Amount must be a valid decimal number/);
        });
    });

    describe('Settlement Deletion', () => {
        it('should delete a settlement', async () => {
            // Arrange: Create users and group
            const creatorUserId = 'creator-user';
            const payerUserId = 'payer-user';
            const payeeUserId = 'payee-user';

            appDriver.seedUser(creatorUserId, { displayName: 'Creator' });
            appDriver.seedUser(payerUserId, { displayName: 'Payer' });
            appDriver.seedUser(payeeUserId, { displayName: 'Payee' });

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), creatorUserId);
            const { shareToken } = await appDriver.generateShareableLink(group.id, undefined, creatorUserId);
            await appDriver.joinGroupByLink(shareToken, undefined, payerUserId);
            await appDriver.joinGroupByLink(shareToken, undefined, payeeUserId);

            // Create settlement
            const settlementData = new CreateSettlementRequestBuilder()
                .withGroupId(group.id)
                .withPayerId(payerUserId)
                .withPayeeId(payeeUserId)
                .build();

            const created = await appDriver.createSettlement(settlementData, creatorUserId);

            // Act: Delete settlement
            const result = await appDriver.deleteSettlement(creatorUserId, created.id);

            // Assert
            expect(result.message).toMatch(/deleted successfully/i);

            // Verify settlement is soft-deleted
            // Note: After soft delete, the settlement should not appear in normal getGroupFullDetails
            // but should be retrievable with includeDeletedSettlements flag
            const fullDetailsWithDeleted = await appDriver.getGroupFullDetails(group.id, {
                includeDeletedSettlements: true,
            }, creatorUserId);

            const deletedSettlement = fullDetailsWithDeleted.settlements.settlements.find(s => s.id === created.id);
            expect(deletedSettlement).toBeDefined();

            // Verify settlement is NOT in normal list (without includeDeletedSettlements)
            const fullDetailsNormal = await appDriver.getGroupFullDetails(group.id, {}, creatorUserId);
            const normalSettlement = fullDetailsNormal.settlements.settlements.find(s => s.id === created.id);
            expect(normalSettlement).toBeUndefined();
        });

        it('should reject deletion by non-creator', async () => {
            // Arrange: Create users and group
            const creatorUserId = 'creator-user';
            const payerUserId = 'payer-user';
            const payeeUserId = 'payee-user';
            const otherMemberUserId = 'other-member';

            appDriver.seedUser(creatorUserId, { displayName: 'Creator' });
            appDriver.seedUser(payerUserId, { displayName: 'Payer' });
            appDriver.seedUser(payeeUserId, { displayName: 'Payee' });
            appDriver.seedUser(otherMemberUserId, { displayName: 'Other Member' });

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), creatorUserId);
            const { shareToken } = await appDriver.generateShareableLink(group.id, undefined, creatorUserId);
            await appDriver.joinGroupByLink(shareToken, undefined, payerUserId);
            await appDriver.joinGroupByLink(shareToken, undefined, payeeUserId);
            await appDriver.joinGroupByLink(shareToken, undefined, otherMemberUserId);

            // Create settlement
            const settlementData = new CreateSettlementRequestBuilder()
                .withGroupId(group.id)
                .withPayerId(payerUserId)
                .withPayeeId(payeeUserId)
                .build();

            const created = await appDriver.createSettlement(settlementData, creatorUserId);

            // Act & Assert: Non-creator cannot delete
            await expect(
                appDriver.deleteSettlement(otherMemberUserId, created.id),
            )
                .rejects
                .toThrow(/Only the creator or group admin can delete this settlement/);
        });

        it('should handle deletion of non-existent settlement', async () => {
            // Arrange
            const userId = 'test-user';
            appDriver.seedUser(userId, { displayName: 'Test User' });

            await appDriver.createGroup(new CreateGroupRequestBuilder().build(), userId);

            // Act & Assert: Non-existent settlement deletion throws error
            await expect(
                appDriver.deleteSettlement(userId, 'non-existent-id'),
            )
                .rejects
                .toThrow(/Settlement not found/);
        });
    });

    describe('Settlement Access After Member Departure', () => {
        it('should view settlements after a member leaves the group', async () => {
            // Arrange: Create users and group
            const adminUserId = 'admin-user';
            const memberUserId = 'member-user';
            const leavingMemberUserId = 'leaving-member';

            appDriver.seedUser(adminUserId, { displayName: 'Admin' });
            appDriver.seedUser(memberUserId, { displayName: 'Member' });
            appDriver.seedUser(leavingMemberUserId, { displayName: 'Leaving Member' });

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), adminUserId);
            const { shareToken } = await appDriver.generateShareableLink(group.id, undefined, adminUserId);
            await appDriver.joinGroupByLink(shareToken, undefined, memberUserId);
            await appDriver.joinGroupByLink(shareToken, undefined, leavingMemberUserId);

            // Create an expense that leaves the departing member owing the admin
            const expenseRequest = new CreateExpenseRequestBuilder()
                .withGroupId(group.id)
                .withPaidBy(adminUserId)
                .withParticipants([adminUserId, leavingMemberUserId])
                .withSplitType('equal')
                .withAmount(60, 'USD')
                .withDescription('Pre-departure expense')
                .build();

            await appDriver.createExpense(expenseRequest, adminUserId);

            const balances = await appDriver.getGroupBalances(group.id, adminUserId);
            const [currencyBalances] = Object.values(balances.balancesByCurrency);
            expect(currencyBalances).toBeDefined();

            const leavingMemberBalance = currencyBalances![leavingMemberUserId];
            expect(leavingMemberBalance).toBeDefined();

            const leavingNetBalance = Number(leavingMemberBalance.netBalance);
            expect(leavingNetBalance).toBeLessThan(0);

            const settlementAmount = Math.abs(leavingNetBalance);

            // Create settlement to clear the balance before departure
            const settlementData = new CreateSettlementRequestBuilder()
                .withGroupId(group.id)
                .withPayerId(leavingMemberUserId)
                .withPayeeId(adminUserId)
                .withAmount(settlementAmount, 'USD')
                .withNote('Settlement before departure')
                .build();

            const settlement = await appDriver.createSettlement(settlementData, adminUserId);

            const postSettlementBalances = await appDriver.getGroupBalances(group.id, adminUserId);
            const [postCurrencyBalances] = Object.values(postSettlementBalances.balancesByCurrency);
            expect(postCurrencyBalances).toBeDefined();
            const leavingBalanceAfterSettlement = postCurrencyBalances![leavingMemberUserId];
            expect(leavingBalanceAfterSettlement).toBeDefined();
            expect(Number(leavingBalanceAfterSettlement!.netBalance)).toBeCloseTo(0);

            // Act: Member leaves group
            await appDriver.leaveGroup(group.id, leavingMemberUserId);

            // Assert: Remaining members can still view settlement
            const fullDetails = await appDriver.getGroupFullDetails(group.id, {}, adminUserId);
            const foundSettlement = fullDetails.settlements.settlements.find(s => s.id === settlement.id);

            expect(foundSettlement).toBeDefined();
            expect(foundSettlement?.id).toBe(settlement.id);
            expect(foundSettlement?.note).toBe('Settlement before departure');

            // Verify member who left cannot access the group or settlements
            await expect(
                appDriver.getGroupFullDetails(group.id, {}, leavingMemberUserId),
            )
                .rejects
                .toThrow(/status 404.*NOT_FOUND|status 403.*NOT_GROUP_MEMBER|Group not found/);
        });
    });

    describe('Settlement Soft Delete Operations', () => {
        it('should soft delete settlement and preserve metadata', async () => {
            // Arrange: Create users and group
            const creatorUserId = 'creator-user';
            const payerUserId = 'payer-user';
            const payeeUserId = 'payee-user';

            appDriver.seedUser(creatorUserId, { displayName: 'Creator' });
            appDriver.seedUser(payerUserId, { displayName: 'Payer' });
            appDriver.seedUser(payeeUserId, { displayName: 'Payee' });

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), creatorUserId);
            const { shareToken } = await appDriver.generateShareableLink(group.id, undefined, creatorUserId);
            await appDriver.joinGroupByLink(shareToken, undefined, payerUserId);
            await appDriver.joinGroupByLink(shareToken, undefined, payeeUserId);

            // Create settlement
            const settlementData = new CreateSettlementRequestBuilder()
                .withGroupId(group.id)
                .withPayerId(payerUserId)
                .withPayeeId(payeeUserId)
                .withAmount(100.0, 'USD')
                .withNote('Soft delete test')
                .build();

            const created = await appDriver.createSettlement(settlementData, creatorUserId);

            // Act: Soft delete settlement
            await appDriver.deleteSettlement(creatorUserId, created.id);

            // Assert: Deleted settlement is preserved with metadata
            const fullDetailsWithDeleted = await appDriver.getGroupFullDetails(group.id, {
                includeDeletedSettlements: true,
            }, creatorUserId);

            const deletedSettlement = fullDetailsWithDeleted.settlements.settlements.find(s => s.id === created.id);
            expect(deletedSettlement).toBeDefined();
            expect(deletedSettlement?.amount).toBe('100');
            expect(deletedSettlement?.currency).toBe('USD');
            expect(deletedSettlement?.note).toBe('Soft delete test');

            // Verify it doesn't appear in normal list
            const fullDetailsNormal = await appDriver.getGroupFullDetails(group.id, {}, creatorUserId);
            const normalSettlement = fullDetailsNormal.settlements.settlements.find(s => s.id === created.id);
            expect(normalSettlement).toBeUndefined();
        });

        it('should allow group admin to soft delete any settlement', async () => {
            // Arrange: Create users and group
            const adminUserId = 'admin-user';
            const creatorUserId = 'creator-user';
            const payerUserId = 'payer-user';
            const payeeUserId = 'payee-user';

            appDriver.seedUser(adminUserId, { displayName: 'Admin' });
            appDriver.seedUser(creatorUserId, { displayName: 'Creator' });
            appDriver.seedUser(payerUserId, { displayName: 'Payer' });
            appDriver.seedUser(payeeUserId, { displayName: 'Payee' });

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), adminUserId); // Admin is the group creator
            const { shareToken } = await appDriver.generateShareableLink(group.id, undefined, adminUserId);
            await appDriver.joinGroupByLink(shareToken, undefined, creatorUserId);
            await appDriver.joinGroupByLink(shareToken, undefined, payerUserId);
            await appDriver.joinGroupByLink(shareToken, undefined, payeeUserId);

            // Create settlement by non-admin creator
            const settlementData = new CreateSettlementRequestBuilder()
                .withGroupId(group.id)
                .withPayerId(payerUserId)
                .withPayeeId(payeeUserId)
                .build();

            const created = await appDriver.createSettlement(settlementData, creatorUserId);

            // Act: Admin deletes settlement created by another user
            const result = await appDriver.deleteSettlement(adminUserId, created.id);

            // Assert
            expect(result.message).toMatch(/deleted successfully/i);

            // Verify soft delete - settlement should be in includeDeletedSettlements but not in normal list
            const fullDetailsWithDeleted = await appDriver.getGroupFullDetails(group.id, {
                includeDeletedSettlements: true,
            }, adminUserId);

            const deletedSettlement = fullDetailsWithDeleted.settlements.settlements.find(s => s.id === created.id);
            expect(deletedSettlement).toBeDefined();

            // Verify it's not in normal list
            const fullDetailsNormal = await appDriver.getGroupFullDetails(group.id, {}, adminUserId);
            const normalSettlement = fullDetailsNormal.settlements.settlements.find(s => s.id === created.id);
            expect(normalSettlement).toBeUndefined();
        });

        it('should prevent non-creator non-admin from soft deleting settlement', async () => {
            // Arrange: Create users and group
            const adminUserId = 'admin-user';
            const creatorUserId = 'creator-user';
            const payerUserId = 'payer-user';
            const payeeUserId = 'payee-user';
            const otherMemberUserId = 'other-member';

            appDriver.seedUser(adminUserId, { displayName: 'Admin' });
            appDriver.seedUser(creatorUserId, { displayName: 'Creator' });
            appDriver.seedUser(payerUserId, { displayName: 'Payer' });
            appDriver.seedUser(payeeUserId, { displayName: 'Payee' });
            appDriver.seedUser(otherMemberUserId, { displayName: 'Other Member' });

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), adminUserId);
            const { shareToken } = await appDriver.generateShareableLink(group.id, undefined, adminUserId);
            await appDriver.joinGroupByLink(shareToken, undefined, creatorUserId);
            await appDriver.joinGroupByLink(shareToken, undefined, payerUserId);
            await appDriver.joinGroupByLink(shareToken, undefined, payeeUserId);
            await appDriver.joinGroupByLink(shareToken, undefined, otherMemberUserId);

            // Create settlement
            const settlementData = new CreateSettlementRequestBuilder()
                .withGroupId(group.id)
                .withPayerId(payerUserId)
                .withPayeeId(payeeUserId)
                .build();

            const created = await appDriver.createSettlement(settlementData, creatorUserId);

            // Act & Assert: Other member (not creator, not admin) cannot delete
            await expect(
                appDriver.deleteSettlement(otherMemberUserId, created.id),
            )
                .rejects
                .toThrow(/Only the creator or group admin can delete this settlement/);
        });

        it('should prevent double deletion of already deleted settlement', async () => {
            // Arrange: Create users and group
            const creatorUserId = 'creator-user';
            const payerUserId = 'payer-user';
            const payeeUserId = 'payee-user';

            appDriver.seedUser(creatorUserId, { displayName: 'Creator' });
            appDriver.seedUser(payerUserId, { displayName: 'Payer' });
            appDriver.seedUser(payeeUserId, { displayName: 'Payee' });

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), creatorUserId);
            const { shareToken } = await appDriver.generateShareableLink(group.id, undefined, creatorUserId);
            await appDriver.joinGroupByLink(shareToken, undefined, payerUserId);
            await appDriver.joinGroupByLink(shareToken, undefined, payeeUserId);

            // Create settlement
            const settlementData = new CreateSettlementRequestBuilder()
                .withGroupId(group.id)
                .withPayerId(payerUserId)
                .withPayeeId(payeeUserId)
                .build();

            const created = await appDriver.createSettlement(settlementData, creatorUserId);

            // First deletion
            await appDriver.deleteSettlement(creatorUserId, created.id);

            // Act & Assert: Second deletion should fail
            await expect(
                appDriver.deleteSettlement(creatorUserId, created.id),
            )
                .rejects
                .toThrow(/Settlement not found/);
        });

        it('should not allow updating a soft deleted settlement', async () => {
            // Arrange: Create users and group
            const creatorUserId = 'creator-user';
            const payerUserId = 'payer-user';
            const payeeUserId = 'payee-user';

            appDriver.seedUser(creatorUserId, { displayName: 'Creator' });
            appDriver.seedUser(payerUserId, { displayName: 'Payer' });
            appDriver.seedUser(payeeUserId, { displayName: 'Payee' });

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), creatorUserId);
            const { shareToken } = await appDriver.generateShareableLink(group.id, undefined, creatorUserId);
            await appDriver.joinGroupByLink(shareToken, undefined, payerUserId);
            await appDriver.joinGroupByLink(shareToken, undefined, payeeUserId);

            // Create settlement
            const settlementData = new CreateSettlementRequestBuilder()
                .withGroupId(group.id)
                .withPayerId(payerUserId)
                .withPayeeId(payeeUserId)
                .withAmount(100.0, 'USD')
                .build();

            const created = await appDriver.createSettlement(settlementData, creatorUserId);

            // Delete settlement
            await appDriver.deleteSettlement(creatorUserId, created.id);

            // Act & Assert: Update should fail on deleted settlement
            const updateData = new SettlementUpdateBuilder()
                .withAmount(200.0, 'USD')
                .build();

            await expect(
                appDriver.updateSettlement(created.id, updateData, creatorUserId),
            )
                .rejects
                .toThrow(/Settlement not found/);
        });
    });
});
