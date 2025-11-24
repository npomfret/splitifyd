import { toGroupId, toSettlementId } from '@billsplit-wl/shared';
import { CreateGroupRequestBuilder, CreateSettlementRequestBuilder, UserRegistrationBuilder } from '@billsplit-wl/test-support';
import { beforeEach, describe, expect, it } from 'vitest';
import { HTTP_STATUS } from '../../../constants';
import { AppDriver } from '../AppDriver';

describe('SettlementService - Unit Tests', () => {
    let appDriver: AppDriver;

    beforeEach(() => {
        // Create AppDriver which sets up all real services
        appDriver = new AppDriver();
    });

    describe('Settlement Creation Validation', () => {
        it('should validate settlement amounts correctly', async () => {
            // Arrange
            const creator = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const creatorId = creator.user.uid;

            const payer = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const payerId = payer.user.uid;

            const payee = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const payeeId = payee.user.uid;

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), creatorId);
            const groupId = toGroupId(group.id);

            // Add payer and payee to the group
            await appDriver.addMembersToGroup(groupId, creatorId, [payerId, payeeId]);

            const validSettlementData = new CreateSettlementRequestBuilder()
                .withGroupId(groupId)
                .withPayerId(payerId)
                .withPayeeId(payeeId)
                .withAmount(100.5, 'USD')
                .withNote('Test settlement')
                .build();

            // Act
            const result = await appDriver.createSettlement(validSettlementData, creatorId);

            // Assert
            expect(result.id).toBeDefined();
            expect(result.amount).toBe('100.5');
            expect(result.currency).toBe('USD');
            expect(result.note).toBe('Test settlement');
        });

        it('should handle optional note field correctly', async () => {
            // Arrange
            const creator = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const creatorId = creator.user.uid;

            const payer = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const payerId = payer.user.uid;

            const payee = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const payeeId = payee.user.uid;

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), creatorId);
            const groupId = toGroupId(group.id);

            // Add payer and payee to the group
            await appDriver.addMembersToGroup(groupId, creatorId, [payerId, payeeId]);

            const settlementDataWithoutNote = new CreateSettlementRequestBuilder()
                .withGroupId(groupId)
                .withPayerId(payerId)
                .withPayeeId(payeeId)
                .withAmount(50.0, 'USD')
                .withoutNote()
                .build();

            // Act
            const result = await appDriver.createSettlement(settlementDataWithoutNote, creatorId);

            // Assert
            expect(result.id).toBeDefined();
            expect(result.amount).toBe('50');
            expect(result.note).toBeUndefined();
        });
    });

    describe('User Data Validation', () => {
        it('should validate user data with complete required fields', async () => {
            // Arrange
            const creator = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const creatorId = creator.user.uid;

            const payer = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const payerId = payer.user.uid;

            const payee = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const payeeId = payee.user.uid;

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), creatorId);
            const groupId = toGroupId(group.id);

            // Add payer and payee to the group
            await appDriver.addMembersToGroup(groupId, creatorId, [payerId, payeeId]);

            const settlementData = new CreateSettlementRequestBuilder()
                .withGroupId(groupId)
                .withPayerId(payerId)
                .withPayeeId(payeeId)
                .build();

            // Act & Assert - Should not throw
            await expect(appDriver.createSettlement(settlementData, creatorId)).resolves.toBeDefined();
        });

        it('should handle user data validation during settlement creation', async () => {
            // Arrange
            const creator = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const creatorId = creator.user.uid;

            const payer = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const payerId = payer.user.uid;

            const payee = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const payeeId = payee.user.uid;

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), creatorId);
            const groupId = toGroupId(group.id);

            // Add payer and payee to the group
            await appDriver.addMembersToGroup(groupId, creatorId, [payerId, payeeId]);

            const settlementData = new CreateSettlementRequestBuilder()
                .withGroupId(groupId)
                .withPayerId(payerId)
                .withPayeeId(payeeId)
                .build();

            // Act & Assert - Should succeed
            await expect(appDriver.createSettlement(settlementData, creatorId)).resolves.toBeDefined();
        });
    });

    describe('Group Membership Validation', () => {
        it('should validate group membership for all users', async () => {
            // Arrange
            const creator = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const creatorId = creator.user.uid;

            const payer = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const payerId = payer.user.uid;

            const payee = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const payeeId = payee.user.uid;

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), creatorId);
            const groupId = toGroupId(group.id);

            // Add payer and payee to the group
            await appDriver.addMembersToGroup(groupId, creatorId, [payerId, payeeId]);

            const settlementData = new CreateSettlementRequestBuilder()
                .withGroupId(groupId)
                .withPayerId(payerId)
                .withPayeeId(payeeId)
                .build();

            // Act & Assert - Should succeed
            await expect(appDriver.createSettlement(settlementData, creatorId)).resolves.toBeDefined();
        });

        it('should reject settlement when payer is not group member', async () => {
            // Arrange
            const creator = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const creatorId = creator.user.uid;

            const payee = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const payeeId = payee.user.uid;

            const nonMemberPayer = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const nonMemberPayerId = nonMemberPayer.user.uid;

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), creatorId);
            const groupId = toGroupId(group.id);

            // Add only payee to the group (payer is not added)
            await appDriver.addMembersToGroup(groupId, creatorId, [payeeId]);

            const settlementData = new CreateSettlementRequestBuilder()
                .withGroupId(groupId)
                .withPayerId(nonMemberPayerId)
                .withPayeeId(payeeId)
                .build();

            // Act & Assert
            await expect(appDriver.createSettlement(settlementData, creatorId)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'MEMBER_NOT_IN_GROUP',
                }),
            );
        });

        it('should reject settlement when payee is not group member', async () => {
            // Arrange
            const creator = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const creatorId = creator.user.uid;

            const payer = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const payerId = payer.user.uid;

            const nonMemberPayee = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const nonMemberPayeeId = nonMemberPayee.user.uid;

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), creatorId);
            const groupId = toGroupId(group.id);

            // Add only payer to the group (payee is not added)
            await appDriver.addMembersToGroup(groupId, creatorId, [payerId]);

            const settlementData = new CreateSettlementRequestBuilder()
                .withGroupId(groupId)
                .withPayerId(payerId)
                .withPayeeId(nonMemberPayeeId)
                .withAmount(100, 'USD')
                .withDate(new Date().toISOString())
                .build();

            // Act & Assert
            await expect(appDriver.createSettlement(settlementData, creatorId)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'MEMBER_NOT_IN_GROUP',
                }),
            );
        });

        it('should reject settlement when group does not exist', async () => {
            // Arrange
            const creator = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const creatorId = creator.user.uid;

            const payer = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const payerId = payer.user.uid;

            const payee = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const payeeId = payee.user.uid;

            const nonExistentGroupId = 'non-existent-group';
            const settlementData = new CreateSettlementRequestBuilder()
                .withGroupId(nonExistentGroupId)
                .withPayerId(payerId)
                .withPayeeId(payeeId)
                .build();

            // Don't create group (simulating non-existent group)

            // Act & Assert
            await expect(appDriver.createSettlement(settlementData, creatorId)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.NOT_FOUND,
                    code: 'NOT_FOUND',
                    message: 'Group not found',
                }),
            );
        });
    });

    describe('Data Handling Edge Cases', () => {
        it('should handle decimal precision correctly', async () => {
            // Arrange
            const creator = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const creatorId = creator.user.uid;

            const payer = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const payerId = payer.user.uid;

            const payee = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const payeeId = payee.user.uid;

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), creatorId);
            const groupId = toGroupId(group.id);

            await appDriver.addMembersToGroup(groupId, creatorId, [payerId, payeeId]);

            const settlementData = new CreateSettlementRequestBuilder()
                .withGroupId(groupId)
                .withPayerId(payerId)
                .withPayeeId(payeeId)
                .withAmount(123.45, 'USD')
                .build();

            // Act
            const result = await appDriver.createSettlement(settlementData, creatorId);

            // Assert
            expect(result.amount).toBe('123.45');
        });

        it('should handle maximum valid amount', async () => {
            // Arrange
            const creator = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const creatorId = creator.user.uid;

            const payer = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const payerId = payer.user.uid;

            const payee = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const payeeId = payee.user.uid;

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), creatorId);
            const groupId = toGroupId(group.id);

            await appDriver.addMembersToGroup(groupId, creatorId, [payerId, payeeId]);

            const settlementData = new CreateSettlementRequestBuilder()
                .withGroupId(groupId)
                .withPayerId(payerId)
                .withPayeeId(payeeId)
                .withAmount(999999.99, 'USD')
                .build();

            // Act & Assert - Should succeed
            await expect(appDriver.createSettlement(settlementData, creatorId)).resolves.toBeDefined();
        });

        it('should handle minimum valid amount', async () => {
            // Arrange
            const creator = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const creatorId = creator.user.uid;

            const payer = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const payerId = payer.user.uid;

            const payee = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const payeeId = payee.user.uid;

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), creatorId);
            const groupId = toGroupId(group.id);

            await appDriver.addMembersToGroup(groupId, creatorId, [payerId, payeeId]);

            const settlementData = new CreateSettlementRequestBuilder()
                .withGroupId(groupId)
                .withPayerId(payerId)
                .withPayeeId(payeeId)
                .withAmount(0.01, 'USD')
                .build();

            // Act & Assert - Should succeed
            await expect(appDriver.createSettlement(settlementData, creatorId)).resolves.toBeDefined();
        });
    });

    describe('Soft Delete Functionality', () => {
        it('should initialize new settlements with deletedAt and deletedBy as null', async () => {
            // Arrange
            const creator = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const creatorId = creator.user.uid;

            const payer = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const payerId = payer.user.uid;

            const payee = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const payeeId = payee.user.uid;

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), creatorId);
            const groupId = toGroupId(group.id);

            await appDriver.addMembersToGroup(groupId, creatorId, [payerId, payeeId]);

            const settlementData = new CreateSettlementRequestBuilder()
                .withGroupId(groupId)
                .withPayerId(payerId)
                .withPayeeId(payeeId)
                .build();

            // Act
            const result = await appDriver.createSettlement(settlementData, creatorId);

            // Assert - Verify soft delete fields are initialized
            expect(result.deletedAt).toBeNull();
            expect(result.deletedBy).toBeNull();
        });

        it('should soft delete settlement with correct metadata', async () => {
            // Arrange
            const creator = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const creatorId = creator.user.uid;

            const payer = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const payerId = payer.user.uid;

            const payee = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const payeeId = payee.user.uid;

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), creatorId);
            const groupId = toGroupId(group.id);

            await appDriver.addMembersToGroup(groupId, creatorId, [payerId, payeeId]);

            // Create settlement via API
            const settlement = await appDriver.createSettlement(
                new CreateSettlementRequestBuilder()
                    .withGroupId(groupId)
                    .withPayerId(payerId)
                    .withPayeeId(payeeId)
                    .withAmount(100, 'USD')
                    .withNote('Test settlement')
                    .build(),
                creatorId,
            );
            const settlementId = toSettlementId(settlement.id);

            // Act & Assert - Should succeed without throwing
            await expect(appDriver.deleteSettlement(settlementId, creatorId)).resolves.toBeDefined();
        });

        it('should prevent soft deleting already deleted settlement', async () => {
            // Arrange
            const creator = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const creatorId = creator.user.uid;

            const payer = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const payerId = payer.user.uid;

            const payee = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const payeeId = payee.user.uid;

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), creatorId);
            const groupId = toGroupId(group.id);

            await appDriver.addMembersToGroup(groupId, creatorId, [payerId, payeeId]);

            // Create settlement and delete it
            const settlement = await appDriver.createSettlement(
                new CreateSettlementRequestBuilder()
                    .withGroupId(groupId)
                    .withPayerId(payerId)
                    .withPayeeId(payeeId)
                    .withAmount(100, 'USD')
                    .build(),
                creatorId,
            );
            const settlementId = toSettlementId(settlement.id);

            // Delete the settlement
            await appDriver.deleteSettlement(settlementId, creatorId);

            // Act & Assert - Trying to delete again should fail
            await expect(appDriver.deleteSettlement(settlementId, creatorId)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.NOT_FOUND,
                    code: 'SETTLEMENT_NOT_FOUND',
                }),
            );
        });

        it('should allow settlement creator to soft delete', async () => {
            // Arrange
            const creator = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const creatorId = creator.user.uid;

            const payer = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const payerId = payer.user.uid;

            const payee = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const payeeId = payee.user.uid;

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), creatorId);
            const groupId = toGroupId(group.id);

            await appDriver.addMembersToGroup(groupId, creatorId, [payerId, payeeId]);

            // Create settlement via API
            const settlement = await appDriver.createSettlement(
                new CreateSettlementRequestBuilder()
                    .withGroupId(groupId)
                    .withPayerId(payerId)
                    .withPayeeId(payeeId)
                    .withAmount(100, 'USD')
                    .build(),
                creatorId,
            );
            const settlementId = toSettlementId(settlement.id);

            // Act & Assert - Should succeed
            await expect(appDriver.deleteSettlement(settlementId, creatorId)).resolves.toBeDefined();
        });

        it('should allow group admin to soft delete settlement', async () => {
            // Arrange
            const admin = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const adminId = admin.user.uid;

            const creator = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const creatorId = creator.user.uid;

            const payer = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const payerId = payer.user.uid;

            const payee = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const payeeId = payee.user.uid;

            // Create group with admin as owner
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), adminId);
            const groupId = toGroupId(group.id);

            // Add other members
            await appDriver.addMembersToGroup(groupId, adminId, [creatorId, payerId, payeeId]);

            // Create settlement (by creator, not admin)
            const settlement = await appDriver.createSettlement(
                new CreateSettlementRequestBuilder()
                    .withGroupId(groupId)
                    .withPayerId(payerId)
                    .withPayeeId(payeeId)
                    .withAmount(100, 'USD')
                    .build(),
                creatorId,
            );
            const settlementId = toSettlementId(settlement.id);

            // Act & Assert - Admin should be able to delete settlement created by another member
            await expect(appDriver.deleteSettlement(settlementId, adminId)).resolves.toBeDefined();
        });

        it('should prevent non-creator non-admin from soft deleting settlement', async () => {
            // Arrange
            const creator = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const creatorId = creator.user.uid;

            const payer = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const payerId = payer.user.uid;

            const payee = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const payeeId = payee.user.uid;

            const otherMember = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const otherId = otherMember.user.uid;

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), creatorId);
            const groupId = toGroupId(group.id);

            // Add all members
            await appDriver.addMembersToGroup(groupId, creatorId, [payerId, payeeId, otherId]);

            // Create settlement (by creator)
            const settlement = await appDriver.createSettlement(
                new CreateSettlementRequestBuilder()
                    .withGroupId(groupId)
                    .withPayerId(payerId)
                    .withPayeeId(payeeId)
                    .withAmount(100, 'USD')
                    .build(),
                creatorId,
            );
            const settlementId = toSettlementId(settlement.id);

            // Act & Assert - Regular member (not creator, not admin) should not be able to delete
            await expect(appDriver.deleteSettlement(settlementId, otherId)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.FORBIDDEN,
                }),
            );
        });

        it('should prevent soft deleting non-existent settlement', async () => {
            // Arrange
            const user = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const userId = user.user.uid;

            const nonExistentSettlementId = toSettlementId('non-existent-settlement-id');

            // Don't create settlement (simulating non-existent settlement)

            // Act & Assert
            await expect(appDriver.deleteSettlement(nonExistentSettlementId, userId)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.NOT_FOUND,
                    code: 'SETTLEMENT_NOT_FOUND',
                }),
            );
        });

        it('should prevent soft deleting settlement when user not in group', async () => {
            // Arrange
            const creator = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const creatorId = creator.user.uid;

            const payer = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const payerId = payer.user.uid;

            const payee = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const payeeId = payee.user.uid;

            const nonMember = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const nonMemberId = nonMember.user.uid;

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), creatorId);
            const groupId = toGroupId(group.id);

            // Add payer and payee but NOT nonMember
            await appDriver.addMembersToGroup(groupId, creatorId, [payerId, payeeId]);

            // Create settlement
            const settlement = await appDriver.createSettlement(
                new CreateSettlementRequestBuilder()
                    .withGroupId(groupId)
                    .withPayerId(payerId)
                    .withPayeeId(payeeId)
                    .withAmount(100, 'USD')
                    .build(),
                creatorId,
            );
            const settlementId = toSettlementId(settlement.id);

            // Act & Assert - User not in group should not be able to delete
            await expect(appDriver.deleteSettlement(settlementId, nonMemberId)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.FORBIDDEN,
                }),
            );
        });
    });
});
