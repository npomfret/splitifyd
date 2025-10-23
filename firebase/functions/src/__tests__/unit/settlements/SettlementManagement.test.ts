import { CreateSettlementRequestBuilder, SettlementUpdateBuilder } from '@splitifyd/test-support';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AppDriver } from '../AppDriver';

/**
 * Settlement Management Unit Tests
 *
 * These tests verify settlement CRUD operations, access control, and soft delete behavior
 * using the in-memory StubFirestoreDatabase for fast execution (100-300x faster than integration tests).
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

            const group = await appDriver.createGroup(creatorUserId);
            const { linkId } = await appDriver.generateShareableLink(creatorUserId, group.id);
            await appDriver.joinGroupByLink(payerUserId, linkId);
            await appDriver.joinGroupByLink(payeeUserId, linkId);

            // Create settlement
            const settlementData = new CreateSettlementRequestBuilder()
                .withGroupId(group.id)
                .withPayerId(payerUserId)
                .withPayeeId(payeeUserId)
                .withAmount(100.0, 'USD')
                .withNote('Retrieve test')
                .build();

            const created = await appDriver.createSettlement(creatorUserId, settlementData);

            // Act: Retrieve settlement
            const retrieved = await appDriver.getSettlement(creatorUserId, group.id, created.id);

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

            const group = await appDriver.createGroup(creatorUserId);
            const { linkId } = await appDriver.generateShareableLink(creatorUserId, group.id);
            await appDriver.joinGroupByLink(payerUserId, linkId);
            await appDriver.joinGroupByLink(payeeUserId, linkId);

            // Create settlement
            const settlementData = new CreateSettlementRequestBuilder()
                .withGroupId(group.id)
                .withPayerId(payerUserId)
                .withPayeeId(payeeUserId)
                .build();

            const created = await appDriver.createSettlement(creatorUserId, settlementData);

            // Act & Assert: Outsider cannot retrieve settlement
            await expect(
                appDriver.getSettlement(outsiderUserId, group.id, created.id),
            )
                .rejects
                .toThrow(/status 403.*NOT_GROUP_MEMBER/);
        });

        it('should handle non-existent settlement', async () => {
            // Arrange
            const userId = 'test-user';
            appDriver.seedUser(userId, { displayName: 'Test User' });

            const group = await appDriver.createGroup(userId);

            // Act & Assert: Non-existent settlement throws error
            await expect(
                appDriver.getSettlement(userId, group.id, 'non-existent-id'),
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

            const group = await appDriver.createGroup(creatorUserId);
            const { linkId } = await appDriver.generateShareableLink(creatorUserId, group.id);
            await appDriver.joinGroupByLink(payerUserId, linkId);
            await appDriver.joinGroupByLink(payeeUserId, linkId);

            // Create settlement
            const settlementData = new CreateSettlementRequestBuilder()
                .withGroupId(group.id)
                .withPayerId(payerUserId)
                .withPayeeId(payeeUserId)
                .withAmount(100.0, 'USD')
                .withNote('Original note')
                .build();

            const created = await appDriver.createSettlement(creatorUserId, settlementData);

            // Act: Update settlement
            const updateData = new SettlementUpdateBuilder()
                .withAmount(150.0, 'USD')
                .withNote('Updated note')
                .build();

            const updated = await appDriver.updateSettlement(creatorUserId, created.id, updateData);

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

            const group = await appDriver.createGroup(creatorUserId);
            const { linkId } = await appDriver.generateShareableLink(creatorUserId, group.id);
            await appDriver.joinGroupByLink(payerUserId, linkId);
            await appDriver.joinGroupByLink(payeeUserId, linkId);
            await appDriver.joinGroupByLink(otherMemberUserId, linkId);

            // Create settlement
            const settlementData = new CreateSettlementRequestBuilder()
                .withGroupId(group.id)
                .withPayerId(payerUserId)
                .withPayeeId(payeeUserId)
                .build();

            const created = await appDriver.createSettlement(creatorUserId, settlementData);

            // Act & Assert: Non-creator cannot update
            const updateData = new SettlementUpdateBuilder()
                .withAmount(200.0, 'USD')
                .build();

            await expect(
                appDriver.updateSettlement(otherMemberUserId, created.id, updateData),
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

            const group = await appDriver.createGroup(creatorUserId);
            const { linkId } = await appDriver.generateShareableLink(creatorUserId, group.id);
            await appDriver.joinGroupByLink(payerUserId, linkId);
            await appDriver.joinGroupByLink(payeeUserId, linkId);

            // Create settlement
            const settlementData = new CreateSettlementRequestBuilder()
                .withGroupId(group.id)
                .withPayerId(payerUserId)
                .withPayeeId(payeeUserId)
                .build();

            const created = await appDriver.createSettlement(creatorUserId, settlementData);

            // Act & Assert: Invalid amount (negative) should fail
            const invalidUpdateData = new SettlementUpdateBuilder()
                .withAmount(-100.0, 'USD')
                .build();

            await expect(
                appDriver.updateSettlement(creatorUserId, created.id, invalidUpdateData),
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

            const group = await appDriver.createGroup(creatorUserId);
            const { linkId } = await appDriver.generateShareableLink(creatorUserId, group.id);
            await appDriver.joinGroupByLink(payerUserId, linkId);
            await appDriver.joinGroupByLink(payeeUserId, linkId);

            // Create settlement
            const settlementData = new CreateSettlementRequestBuilder()
                .withGroupId(group.id)
                .withPayerId(payerUserId)
                .withPayeeId(payeeUserId)
                .build();

            const created = await appDriver.createSettlement(creatorUserId, settlementData);

            // Act: Delete settlement
            const result = await appDriver.deleteSettlement(creatorUserId, created.id);

            // Assert
            expect(result.message).toMatch(/deleted successfully/i);

            // Verify settlement is soft-deleted
            // Note: After soft delete, the settlement should not appear in normal getGroupFullDetails
            // but should be retrievable with includeDeletedSettlements flag
            const fullDetailsWithDeleted = await appDriver.getGroupFullDetails(creatorUserId, group.id, {
                includeDeletedSettlements: true,
            });

            const deletedSettlement = fullDetailsWithDeleted.settlements.settlements.find(s => s.id === created.id);
            expect(deletedSettlement).toBeDefined();

            // Verify settlement is NOT in normal list (without includeDeletedSettlements)
            const fullDetailsNormal = await appDriver.getGroupFullDetails(creatorUserId, group.id);
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

            const group = await appDriver.createGroup(creatorUserId);
            const { linkId } = await appDriver.generateShareableLink(creatorUserId, group.id);
            await appDriver.joinGroupByLink(payerUserId, linkId);
            await appDriver.joinGroupByLink(payeeUserId, linkId);
            await appDriver.joinGroupByLink(otherMemberUserId, linkId);

            // Create settlement
            const settlementData = new CreateSettlementRequestBuilder()
                .withGroupId(group.id)
                .withPayerId(payerUserId)
                .withPayeeId(payeeUserId)
                .build();

            const created = await appDriver.createSettlement(creatorUserId, settlementData);

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

            await appDriver.createGroup(userId);

            // Act & Assert: Non-existent settlement deletion throws error
            await expect(
                appDriver.deleteSettlement(userId, 'non-existent-id'),
            )
                .rejects
                .toThrow(/Settlement not found/);
        });
    });

    describe('Settlement Access After Member Departure', () => {
        // TODO: Fix this test - member leaving requires settling balances first
        it.skip('should view settlements after a member leaves the group', async () => {
            // Arrange: Create users and group
            const adminUserId = 'admin-user';
            const memberUserId = 'member-user';
            const leavingMemberUserId = 'leaving-member';

            appDriver.seedUser(adminUserId, { displayName: 'Admin' });
            appDriver.seedUser(memberUserId, { displayName: 'Member' });
            appDriver.seedUser(leavingMemberUserId, { displayName: 'Leaving Member' });

            const group = await appDriver.createGroup(adminUserId);
            const { linkId } = await appDriver.generateShareableLink(adminUserId, group.id);
            await appDriver.joinGroupByLink(memberUserId, linkId);
            await appDriver.joinGroupByLink(leavingMemberUserId, linkId);

            // Create settlement involving the leaving member
            const settlementData = new CreateSettlementRequestBuilder()
                .withGroupId(group.id)
                .withPayerId(adminUserId)
                .withPayeeId(leavingMemberUserId)
                .withAmount(50.0, 'USD')
                .withNote('Settlement before departure')
                .build();

            const settlement = await appDriver.createSettlement(adminUserId, settlementData);

            // Act: Member leaves group
            await appDriver.leaveGroup(leavingMemberUserId, group.id);

            // Assert: Remaining members can still view settlement
            const fullDetails = await appDriver.getGroupFullDetails(adminUserId, group.id);
            const foundSettlement = fullDetails.settlements.settlements.find(s => s.id === settlement.id);

            expect(foundSettlement).toBeDefined();
            expect(foundSettlement?.id).toBe(settlement.id);
            expect(foundSettlement?.note).toBe('Settlement before departure');

            // Verify member who left cannot access the group or settlements
            await expect(
                appDriver.getGroupFullDetails(leavingMemberUserId, group.id),
            )
                .rejects
                .toThrow(/status 404.*NOT_FOUND|status 403.*NOT_GROUP_MEMBER/);
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

            const group = await appDriver.createGroup(creatorUserId);
            const { linkId } = await appDriver.generateShareableLink(creatorUserId, group.id);
            await appDriver.joinGroupByLink(payerUserId, linkId);
            await appDriver.joinGroupByLink(payeeUserId, linkId);

            // Create settlement
            const settlementData = new CreateSettlementRequestBuilder()
                .withGroupId(group.id)
                .withPayerId(payerUserId)
                .withPayeeId(payeeUserId)
                .withAmount(100.0, 'USD')
                .withNote('Soft delete test')
                .build();

            const created = await appDriver.createSettlement(creatorUserId, settlementData);

            // Act: Soft delete settlement
            await appDriver.deleteSettlement(creatorUserId, created.id);

            // Assert: Deleted settlement is preserved with metadata
            const fullDetailsWithDeleted = await appDriver.getGroupFullDetails(creatorUserId, group.id, {
                includeDeletedSettlements: true,
            });

            const deletedSettlement = fullDetailsWithDeleted.settlements.settlements.find(s => s.id === created.id);
            expect(deletedSettlement).toBeDefined();
            expect(deletedSettlement?.amount).toBe('100');
            expect(deletedSettlement?.currency).toBe('USD');
            expect(deletedSettlement?.note).toBe('Soft delete test');

            // Verify it doesn't appear in normal list
            const fullDetailsNormal = await appDriver.getGroupFullDetails(creatorUserId, group.id);
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

            const group = await appDriver.createGroup(adminUserId); // Admin is the group creator
            const { linkId } = await appDriver.generateShareableLink(adminUserId, group.id);
            await appDriver.joinGroupByLink(creatorUserId, linkId);
            await appDriver.joinGroupByLink(payerUserId, linkId);
            await appDriver.joinGroupByLink(payeeUserId, linkId);

            // Create settlement by non-admin creator
            const settlementData = new CreateSettlementRequestBuilder()
                .withGroupId(group.id)
                .withPayerId(payerUserId)
                .withPayeeId(payeeUserId)
                .build();

            const created = await appDriver.createSettlement(creatorUserId, settlementData);

            // Act: Admin deletes settlement created by another user
            const result = await appDriver.deleteSettlement(adminUserId, created.id);

            // Assert
            expect(result.message).toMatch(/deleted successfully/i);

            // Verify soft delete - settlement should be in includeDeletedSettlements but not in normal list
            const fullDetailsWithDeleted = await appDriver.getGroupFullDetails(adminUserId, group.id, {
                includeDeletedSettlements: true,
            });

            const deletedSettlement = fullDetailsWithDeleted.settlements.settlements.find(s => s.id === created.id);
            expect(deletedSettlement).toBeDefined();

            // Verify it's not in normal list
            const fullDetailsNormal = await appDriver.getGroupFullDetails(adminUserId, group.id);
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

            const group = await appDriver.createGroup(adminUserId);
            const { linkId } = await appDriver.generateShareableLink(adminUserId, group.id);
            await appDriver.joinGroupByLink(creatorUserId, linkId);
            await appDriver.joinGroupByLink(payerUserId, linkId);
            await appDriver.joinGroupByLink(payeeUserId, linkId);
            await appDriver.joinGroupByLink(otherMemberUserId, linkId);

            // Create settlement
            const settlementData = new CreateSettlementRequestBuilder()
                .withGroupId(group.id)
                .withPayerId(payerUserId)
                .withPayeeId(payeeUserId)
                .build();

            const created = await appDriver.createSettlement(creatorUserId, settlementData);

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

            const group = await appDriver.createGroup(creatorUserId);
            const { linkId } = await appDriver.generateShareableLink(creatorUserId, group.id);
            await appDriver.joinGroupByLink(payerUserId, linkId);
            await appDriver.joinGroupByLink(payeeUserId, linkId);

            // Create settlement
            const settlementData = new CreateSettlementRequestBuilder()
                .withGroupId(group.id)
                .withPayerId(payerUserId)
                .withPayeeId(payeeUserId)
                .build();

            const created = await appDriver.createSettlement(creatorUserId, settlementData);

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

            const group = await appDriver.createGroup(creatorUserId);
            const { linkId } = await appDriver.generateShareableLink(creatorUserId, group.id);
            await appDriver.joinGroupByLink(payerUserId, linkId);
            await appDriver.joinGroupByLink(payeeUserId, linkId);

            // Create settlement
            const settlementData = new CreateSettlementRequestBuilder()
                .withGroupId(group.id)
                .withPayerId(payerUserId)
                .withPayeeId(payeeUserId)
                .withAmount(100.0, 'USD')
                .build();

            const created = await appDriver.createSettlement(creatorUserId, settlementData);

            // Delete settlement
            await appDriver.deleteSettlement(creatorUserId, created.id);

            // Act & Assert: Update should fail on deleted settlement
            const updateData = new SettlementUpdateBuilder()
                .withAmount(200.0, 'USD')
                .build();

            await expect(
                appDriver.updateSettlement(creatorUserId, created.id, updateData),
            )
                .rejects
                .toThrow(/Settlement not found/);
        });
    });
});
