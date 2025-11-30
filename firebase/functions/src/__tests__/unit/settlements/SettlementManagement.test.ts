import { CreateExpenseRequestBuilder, CreateGroupRequestBuilder, CreateSettlementRequestBuilder, SettlementUpdateBuilder, UserRegistrationBuilder } from '@billsplit-wl/test-support';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AppDriver } from '../AppDriver';

/**
 * Settlement Management Unit Tests
 *
 * These tests verify settlement CRUD operations, access control, and soft delete behavior
 * using the in-memory TenantFirestoreTestDatabase for fast execution (100-300x faster than integration tests).
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
            // Arrange: Register users via API
            const creatorReg = new UserRegistrationBuilder()
                .withEmail('creator@example.com')
                .withDisplayName('Creator')
                .withPassword('password12345')
                .build();
            const creatorResult = await appDriver.registerUser(creatorReg);
            const creatorUserId = creatorResult.user.uid;

            const payerReg = new UserRegistrationBuilder()
                .withEmail('payer@example.com')
                .withDisplayName('Payer')
                .withPassword('password12345')
                .build();
            const payerResult = await appDriver.registerUser(payerReg);
            const payerUserId = payerResult.user.uid;

            const payeeReg = new UserRegistrationBuilder()
                .withEmail('payee@example.com')
                .withDisplayName('Payee')
                .withPassword('password12345')
                .build();
            const payeeResult = await appDriver.registerUser(payeeReg);
            const payeeUserId = payeeResult.user.uid;

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
            // Arrange: Register users via API
            const creatorReg = new UserRegistrationBuilder()
                .withEmail('creator2@example.com')
                .withDisplayName('Creator')
                .withPassword('password12345')
                .build();
            const creatorResult = await appDriver.registerUser(creatorReg);
            const creatorUserId = creatorResult.user.uid;

            const payerReg = new UserRegistrationBuilder()
                .withEmail('payer2@example.com')
                .withDisplayName('Payer')
                .withPassword('password12345')
                .build();
            const payerResult = await appDriver.registerUser(payerReg);
            const payerUserId = payerResult.user.uid;

            const payeeReg = new UserRegistrationBuilder()
                .withEmail('payee2@example.com')
                .withDisplayName('Payee')
                .withPassword('password12345')
                .build();
            const payeeResult = await appDriver.registerUser(payeeReg);
            const payeeUserId = payeeResult.user.uid;

            const outsiderReg = new UserRegistrationBuilder()
                .withEmail('outsider@example.com')
                .withDisplayName('Outsider')
                .withPassword('password12345')
                .build();
            const outsiderResult = await appDriver.registerUser(outsiderReg);
            const outsiderUserId = outsiderResult.user.uid;

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

            // Act & Assert: Outsider cannot retrieve settlement (NOT_FOUND for security)
            await expect(
                appDriver.getSettlement(group.id, created.id, outsiderUserId),
            )
                .rejects
                .toThrow('NOT_FOUND');
        });

        it('should handle non-existent settlement', async () => {
            // Arrange: Register user via API
            const userReg = new UserRegistrationBuilder()
                .withEmail('testuser@example.com')
                .withDisplayName('Test User')
                .withPassword('password12345')
                .build();
            const userResult = await appDriver.registerUser(userReg);
            const userId = userResult.user.uid;

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), userId);

            // Act & Assert: Non-existent settlement throws error
            await expect(
                appDriver.getSettlement(group.id, 'non-existent-id', userId),
            )
                .rejects
                .toThrow('NOT_FOUND');
        });
    });

    describe('Settlement Updates', () => {
        it('should update settlement fields', async () => {
            // Arrange: Register users via API
            const creatorReg = new UserRegistrationBuilder()
                .withEmail('update-creator@example.com')
                .withDisplayName('Creator')
                .withPassword('password12345')
                .build();
            const creatorResult = await appDriver.registerUser(creatorReg);
            const creatorUserId = creatorResult.user.uid;

            const payerReg = new UserRegistrationBuilder()
                .withEmail('update-payer@example.com')
                .withDisplayName('Payer')
                .withPassword('password12345')
                .build();
            const payerResult = await appDriver.registerUser(payerReg);
            const payerUserId = payerResult.user.uid;

            const payeeReg = new UserRegistrationBuilder()
                .withEmail('update-payee@example.com')
                .withDisplayName('Payee')
                .withPassword('password12345')
                .build();
            const payeeResult = await appDriver.registerUser(payeeReg);
            const payeeUserId = payeeResult.user.uid;

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

            const updatedSettlement = await appDriver.updateSettlement(created.id, updateData, creatorUserId);

            // Assert: Update returns NEW settlement with NEW ID (edit history via soft deletes)
            expect(updatedSettlement.id).not.toBe(created.id);
            expect(updatedSettlement.amount).toBe('150');
            expect(updatedSettlement.note).toBe('Updated note');
            expect(updatedSettlement.currency).toBe('USD'); // Currency unchanged

            // Verify by refetching using the NEW ID
            const refetched = await appDriver.getSettlement(group.id, updatedSettlement.id, creatorUserId);
            expect(refetched.id).toBe(updatedSettlement.id);
            expect(refetched.amount).toBe('150');
            expect(refetched.note).toBe('Updated note')
        });

        it('should reject update by non-creator', async () => {
            // Arrange: Register users via API
            const creatorReg = new UserRegistrationBuilder()
                .withEmail('reject-creator@example.com')
                .withDisplayName('Creator')
                .withPassword('password12345')
                .build();
            const creatorResult = await appDriver.registerUser(creatorReg);
            const creatorUserId = creatorResult.user.uid;

            const payerReg = new UserRegistrationBuilder()
                .withEmail('reject-payer@example.com')
                .withDisplayName('Payer')
                .withPassword('password12345')
                .build();
            const payerResult = await appDriver.registerUser(payerReg);
            const payerUserId = payerResult.user.uid;

            const payeeReg = new UserRegistrationBuilder()
                .withEmail('reject-payee@example.com')
                .withDisplayName('Payee')
                .withPassword('password12345')
                .build();
            const payeeResult = await appDriver.registerUser(payeeReg);
            const payeeUserId = payeeResult.user.uid;

            const otherMemberReg = new UserRegistrationBuilder()
                .withEmail('othermember@example.com')
                .withDisplayName('Other Member')
                .withPassword('password12345')
                .build();
            const otherMemberResult = await appDriver.registerUser(otherMemberReg);
            const otherMemberUserId = otherMemberResult.user.uid;

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
                .toThrow('FORBIDDEN');
        });

        it('should validate update data', async () => {
            // Arrange: Register users via API
            const creatorReg = new UserRegistrationBuilder()
                .withEmail('validate-creator@example.com')
                .withDisplayName('Creator')
                .withPassword('password12345')
                .build();
            const creatorResult = await appDriver.registerUser(creatorReg);
            const creatorUserId = creatorResult.user.uid;

            const payerReg = new UserRegistrationBuilder()
                .withEmail('validate-payer@example.com')
                .withDisplayName('Payer')
                .withPassword('password12345')
                .build();
            const payerResult = await appDriver.registerUser(payerReg);
            const payerUserId = payerResult.user.uid;

            const payeeReg = new UserRegistrationBuilder()
                .withEmail('validate-payee@example.com')
                .withDisplayName('Payee')
                .withPassword('password12345')
                .build();
            const payeeResult = await appDriver.registerUser(payeeReg);
            const payeeUserId = payeeResult.user.uid;

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
                .toThrow('VALIDATION_ERROR');
        });
    });

    describe('Settlement Deletion', () => {
        it('should delete a settlement', async () => {
            // Arrange: Register users via API
            const creatorReg = new UserRegistrationBuilder()
                .withEmail('delete-creator@example.com')
                .withDisplayName('Creator')
                .withPassword('password12345')
                .build();
            const creatorResult = await appDriver.registerUser(creatorReg);
            const creatorUserId = creatorResult.user.uid;

            const payerReg = new UserRegistrationBuilder()
                .withEmail('delete-payer@example.com')
                .withDisplayName('Payer')
                .withPassword('password12345')
                .build();
            const payerResult = await appDriver.registerUser(payerReg);
            const payerUserId = payerResult.user.uid;

            const payeeReg = new UserRegistrationBuilder()
                .withEmail('delete-payee@example.com')
                .withDisplayName('Payee')
                .withPassword('password12345')
                .build();
            const payeeResult = await appDriver.registerUser(payeeReg);
            const payeeUserId = payeeResult.user.uid;

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
            await appDriver.deleteSettlement(created.id, creatorUserId);

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
            // Arrange: Register users via API
            const creatorReg = new UserRegistrationBuilder()
                .withEmail('delreject-creator@example.com')
                .withDisplayName('Creator')
                .withPassword('password12345')
                .build();
            const creatorResult = await appDriver.registerUser(creatorReg);
            const creatorUserId = creatorResult.user.uid;

            const payerReg = new UserRegistrationBuilder()
                .withEmail('delreject-payer@example.com')
                .withDisplayName('Payer')
                .withPassword('password12345')
                .build();
            const payerResult = await appDriver.registerUser(payerReg);
            const payerUserId = payerResult.user.uid;

            const payeeReg = new UserRegistrationBuilder()
                .withEmail('delreject-payee@example.com')
                .withDisplayName('Payee')
                .withPassword('password12345')
                .build();
            const payeeResult = await appDriver.registerUser(payeeReg);
            const payeeUserId = payeeResult.user.uid;

            const otherMemberReg = new UserRegistrationBuilder()
                .withEmail('delreject-othermember@example.com')
                .withDisplayName('Other Member')
                .withPassword('password12345')
                .build();
            const otherMemberResult = await appDriver.registerUser(otherMemberReg);
            const otherMemberUserId = otherMemberResult.user.uid;

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
                appDriver.deleteSettlement(created.id, otherMemberUserId),
            )
                .rejects
                .toThrow('FORBIDDEN');
        });

        it('should handle deletion of non-existent settlement', async () => {
            // Arrange: Register user via API
            const userReg = new UserRegistrationBuilder()
                .withEmail('delnonexist@example.com')
                .withDisplayName('Test User')
                .withPassword('password12345')
                .build();
            const userResult = await appDriver.registerUser(userReg);
            const userId = userResult.user.uid;

            await appDriver.createGroup(new CreateGroupRequestBuilder().build(), userId);

            // Act & Assert: Non-existent settlement deletion throws error
            await expect(
                appDriver.deleteSettlement('non-existent-id', userId),
            )
                .rejects
                .toThrow('NOT_FOUND');
        });
    });

    describe('Settlement Access After Member Departure', () => {
        it('should view settlements after a member leaves the group', async () => {
            // Arrange: Register users via API
            const adminReg = new UserRegistrationBuilder()
                .withEmail('admin@example.com')
                .withDisplayName('Admin')
                .withPassword('password12345')
                .build();
            const adminResult = await appDriver.registerUser(adminReg);
            const adminUserId = adminResult.user.uid;

            const memberReg = new UserRegistrationBuilder()
                .withEmail('member@example.com')
                .withDisplayName('Member')
                .withPassword('password12345')
                .build();
            const memberResult = await appDriver.registerUser(memberReg);
            const memberUserId = memberResult.user.uid;

            const leavingMemberReg = new UserRegistrationBuilder()
                .withEmail('leaving@example.com')
                .withDisplayName('Leaving Member')
                .withPassword('password12345')
                .build();
            const leavingMemberResult = await appDriver.registerUser(leavingMemberReg);
            const leavingMemberUserId = leavingMemberResult.user.uid;

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
                .toThrow('NOT_FOUND');
        });
    });

    describe('Settlement Soft Delete Operations', () => {
        it('should soft delete settlement and preserve metadata', async () => {
            // Arrange: Register users via API
            const creatorReg = new UserRegistrationBuilder()
                .withEmail('softdel-creator@example.com')
                .withDisplayName('Creator')
                .withPassword('password12345')
                .build();
            const creatorResult = await appDriver.registerUser(creatorReg);
            const creatorUserId = creatorResult.user.uid;

            const payerReg = new UserRegistrationBuilder()
                .withEmail('softdel-payer@example.com')
                .withDisplayName('Payer')
                .withPassword('password12345')
                .build();
            const payerResult = await appDriver.registerUser(payerReg);
            const payerUserId = payerResult.user.uid;

            const payeeReg = new UserRegistrationBuilder()
                .withEmail('softdel-payee@example.com')
                .withDisplayName('Payee')
                .withPassword('password12345')
                .build();
            const payeeResult = await appDriver.registerUser(payeeReg);
            const payeeUserId = payeeResult.user.uid;

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
            await appDriver.deleteSettlement(created.id, creatorUserId);

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
            // Arrange: Register users via API
            const adminReg = new UserRegistrationBuilder()
                .withEmail('softdel-admin@example.com')
                .withDisplayName('Admin')
                .withPassword('password12345')
                .build();
            const adminResult = await appDriver.registerUser(adminReg);
            const adminUserId = adminResult.user.uid;

            const creatorReg = new UserRegistrationBuilder()
                .withEmail('softdel-creator2@example.com')
                .withDisplayName('Creator')
                .withPassword('password12345')
                .build();
            const creatorResult = await appDriver.registerUser(creatorReg);
            const creatorUserId = creatorResult.user.uid;

            const payerReg = new UserRegistrationBuilder()
                .withEmail('softdel-payer2@example.com')
                .withDisplayName('Payer')
                .withPassword('password12345')
                .build();
            const payerResult = await appDriver.registerUser(payerReg);
            const payerUserId = payerResult.user.uid;

            const payeeReg = new UserRegistrationBuilder()
                .withEmail('softdel-payee2@example.com')
                .withDisplayName('Payee')
                .withPassword('password12345')
                .build();
            const payeeResult = await appDriver.registerUser(payeeReg);
            const payeeUserId = payeeResult.user.uid;

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
            await appDriver.deleteSettlement(created.id, adminUserId);

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
            // Arrange: Register users via API
            const adminReg = new UserRegistrationBuilder()
                .withEmail('softdel-admin2@example.com')
                .withDisplayName('Admin')
                .withPassword('password12345')
                .build();
            const adminResult = await appDriver.registerUser(adminReg);
            const adminUserId = adminResult.user.uid;

            const creatorReg = new UserRegistrationBuilder()
                .withEmail('softdel-creator3@example.com')
                .withDisplayName('Creator')
                .withPassword('password12345')
                .build();
            const creatorResult = await appDriver.registerUser(creatorReg);
            const creatorUserId = creatorResult.user.uid;

            const payerReg = new UserRegistrationBuilder()
                .withEmail('softdel-payer3@example.com')
                .withDisplayName('Payer')
                .withPassword('password12345')
                .build();
            const payerResult = await appDriver.registerUser(payerReg);
            const payerUserId = payerResult.user.uid;

            const payeeReg = new UserRegistrationBuilder()
                .withEmail('softdel-payee3@example.com')
                .withDisplayName('Payee')
                .withPassword('password12345')
                .build();
            const payeeResult = await appDriver.registerUser(payeeReg);
            const payeeUserId = payeeResult.user.uid;

            const otherMemberReg = new UserRegistrationBuilder()
                .withEmail('softdel-othermember@example.com')
                .withDisplayName('Other Member')
                .withPassword('password12345')
                .build();
            const otherMemberResult = await appDriver.registerUser(otherMemberReg);
            const otherMemberUserId = otherMemberResult.user.uid;

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
                appDriver.deleteSettlement(created.id, otherMemberUserId),
            )
                .rejects
                .toThrow('FORBIDDEN');
        });

        it('should prevent double deletion of already deleted settlement', async () => {
            // Arrange: Register users via API
            const creatorReg = new UserRegistrationBuilder()
                .withEmail('doubledel-creator@example.com')
                .withDisplayName('Creator')
                .withPassword('password12345')
                .build();
            const creatorResult = await appDriver.registerUser(creatorReg);
            const creatorUserId = creatorResult.user.uid;

            const payerReg = new UserRegistrationBuilder()
                .withEmail('doubledel-payer@example.com')
                .withDisplayName('Payer')
                .withPassword('password12345')
                .build();
            const payerResult = await appDriver.registerUser(payerReg);
            const payerUserId = payerResult.user.uid;

            const payeeReg = new UserRegistrationBuilder()
                .withEmail('doubledel-payee@example.com')
                .withDisplayName('Payee')
                .withPassword('password12345')
                .build();
            const payeeResult = await appDriver.registerUser(payeeReg);
            const payeeUserId = payeeResult.user.uid;

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
            await appDriver.deleteSettlement(created.id, creatorUserId);

            // Act & Assert: Second deletion should fail
            await expect(
                appDriver.deleteSettlement(created.id, creatorUserId),
            )
                .rejects
                .toThrow('NOT_FOUND');
        });

        it('should not allow updating a soft deleted settlement', async () => {
            // Arrange: Register users via API
            const creatorReg = new UserRegistrationBuilder()
                .withEmail('noupdate-creator@example.com')
                .withDisplayName('Creator')
                .withPassword('password12345')
                .build();
            const creatorResult = await appDriver.registerUser(creatorReg);
            const creatorUserId = creatorResult.user.uid;

            const payerReg = new UserRegistrationBuilder()
                .withEmail('noupdate-payer@example.com')
                .withDisplayName('Payer')
                .withPassword('password12345')
                .build();
            const payerResult = await appDriver.registerUser(payerReg);
            const payerUserId = payerResult.user.uid;

            const payeeReg = new UserRegistrationBuilder()
                .withEmail('noupdate-payee@example.com')
                .withDisplayName('Payee')
                .withPassword('password12345')
                .build();
            const payeeResult = await appDriver.registerUser(payeeReg);
            const payeeUserId = payeeResult.user.uid;

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
            await appDriver.deleteSettlement(created.id, creatorUserId);

            // Act & Assert: Update should fail on deleted settlement
            const updateData = new SettlementUpdateBuilder()
                .withAmount(200.0, 'USD')
                .build();

            await expect(
                appDriver.updateSettlement(created.id, updateData, creatorUserId),
            )
                .rejects
                .toThrow('NOT_FOUND');
        });
    });
});
