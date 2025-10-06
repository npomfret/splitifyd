import { describe, it, expect, beforeEach } from 'vitest';
import { SettlementService } from '../../../services/SettlementService';
import { ApplicationBuilder } from '../../../services/ApplicationBuilder';
import { StubFirestoreReader, StubFirestoreWriter, StubAuthService } from '../mocks/firestore-stubs';
import { HTTP_STATUS } from '../../../constants';
import type { CreateSettlementRequest } from '@splitifyd/shared';
import { CreateSettlementRequestBuilder } from '@splitifyd/test-support';
import { GroupMemberDocumentBuilder } from '../../support/GroupMemberDocumentBuilder';

describe('SettlementService - Unit Tests', () => {
    let settlementService: SettlementService;
    let stubReader: StubFirestoreReader;
    let stubWriter: StubFirestoreWriter;
    let stubAuth: StubAuthService;
    let applicationBuilder: ApplicationBuilder;

    // Helper to set user data in stub
    const setUserData = (userId: string, userData: any) => {
        stubReader.setDocument('users', userId, userData);
    };

    // Helper to set group data in stub
    const setGroupData = (groupId: string, groupData: any) => {
        stubReader.setDocument('groups', groupId, groupData);
    };

    beforeEach(() => {
        // Create stubs
        stubReader = new StubFirestoreReader();
        stubWriter = new StubFirestoreWriter();
        stubAuth = new StubAuthService();

        applicationBuilder = new ApplicationBuilder(stubReader, stubWriter, stubAuth);
        settlementService = applicationBuilder.buildSettlementService();
    });

    describe('Settlement Creation Validation', () => {
        it('should validate settlement amounts correctly', async () => {
            // Arrange
            const userId = 'creator-user';
            const groupId = 'test-group';
            const validSettlementData = new CreateSettlementRequestBuilder()
                .withGroupId(groupId)
                .withPayerId('payer-user')
                .withPayeeId('payee-user')
                .withAmount(100.5)
                .withCurrency('USD')
                .withNote('Test settlement')
                .build();

            // Mock required data
            setGroupData(groupId, { id: groupId, name: 'Test Group' });
            setUserData('payer-user', { email: 'payer@test.com', displayName: 'Payer User' });
            setUserData('payee-user', { email: 'payee@test.com', displayName: 'Payee User' });

            // Set up group memberships for both users
            const payerMembershipDoc = new GroupMemberDocumentBuilder().withUserId('payer-user').withGroupId(groupId).withRole('member').withStatus('active').build();
            const payeeMembershipDoc = new GroupMemberDocumentBuilder().withUserId('payee-user').withGroupId(groupId).withRole('member').withStatus('active').build();
            stubReader.setDocument('group-members', `${groupId}_payer-user`, payerMembershipDoc);
            stubReader.setDocument('group-members', `${groupId}_payee-user`, payeeMembershipDoc);

            // Mock writer to return expected ID
            stubWriter.generateDocumentId = () => 'new-settlement-id';

            // Act
            const result = await settlementService.createSettlement(validSettlementData, userId);

            // Assert
            expect(result.id).toBe('new-settlement-id');
            expect(result.amount).toBe(100.5);
            expect(result.currency).toBe('USD');
            expect(result.note).toBe('Test settlement');
        });

        it('should reject settlement with zero amount', async () => {
            // Arrange
            const userId = 'creator-user';
            const invalidSettlementData = new CreateSettlementRequestBuilder()
                .withAmount(0) // Invalid amount
                .build();

            // Act & Assert
            await expect(settlementService.createSettlement(invalidSettlementData, userId)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'INVALID_AMOUNT',
                    message: 'Amount must be greater than 0',
                }),
            );
        });

        it('should reject settlement with negative amount', async () => {
            // Arrange
            const userId = 'creator-user';
            const invalidSettlementData = new CreateSettlementRequestBuilder()
                .withAmount(-10) // Invalid negative amount
                .build();

            // Act & Assert
            await expect(settlementService.createSettlement(invalidSettlementData, userId)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'INVALID_AMOUNT',
                    message: 'Amount must be greater than 0',
                }),
            );
        });

        it('should reject settlement with excessive amount', async () => {
            // Arrange
            const userId = 'creator-user';
            const invalidSettlementData = new CreateSettlementRequestBuilder()
                .withAmount(1000000) // Exceeds maximum amount
                .build();

            // Act & Assert
            await expect(settlementService.createSettlement(invalidSettlementData, userId)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'INVALID_AMOUNT',
                    message: 'Amount cannot exceed 999999.99',
                }),
            );
        });

        it('should handle optional note field correctly', async () => {
            // Arrange
            const userId = 'creator-user';
            const groupId = 'test-group';
            const settlementDataWithoutNote = new CreateSettlementRequestBuilder()
                .withGroupId(groupId)
                .withPayerId('payer-user')
                .withPayeeId('payee-user')
                .withAmount(50.0)
                .withoutNote() // No note field
                .build();

            // Mock required data
            setGroupData(groupId, { id: groupId, name: 'Test Group' });
            setUserData('payer-user', { email: 'payer@test.com', displayName: 'Payer User' });
            setUserData('payee-user', { email: 'payee@test.com', displayName: 'Payee User' });

            // Set up group memberships for both users
            const payerMembershipDoc = new GroupMemberDocumentBuilder().withUserId('payer-user').withGroupId(groupId).withRole('member').withStatus('active').build();
            const payeeMembershipDoc = new GroupMemberDocumentBuilder().withUserId('payee-user').withGroupId(groupId).withRole('member').withStatus('active').build();
            stubReader.setDocument('group-members', `${groupId}_payer-user`, payerMembershipDoc);
            stubReader.setDocument('group-members', `${groupId}_payee-user`, payeeMembershipDoc);

            // Mock writer to return expected ID
            stubWriter.generateDocumentId = () => 'new-settlement-id';

            // Act
            const result = await settlementService.createSettlement(settlementDataWithoutNote, userId);

            // Assert
            expect(result.id).toBe('new-settlement-id');
            expect(result.amount).toBe(50.0);
            expect(result.note).toBeUndefined();
        });
    });

    describe('User Data Validation', () => {
        it('should validate user data with complete required fields', async () => {
            // This test focuses on the fetchUserData validation logic
            // We'll test indirectly through a method that uses it

            // Arrange
            const userId = 'creator-user';
            const groupId = 'test-group';
            const settlementData = new CreateSettlementRequestBuilder().withGroupId(groupId).withPayerId('valid-payer').withPayeeId('valid-payee').withAmount(100).build();

            // Mock valid user data
            setUserData('valid-payer', {
                email: 'payer@example.com',
                displayName: 'Valid Payer',
                otherField: 'should be preserved', // Extra fields should pass through
            });
            setUserData('valid-payee', {
                email: 'payee@example.com',
                displayName: 'Valid Payee',
            });

            // Mock other dependencies
            setGroupData(groupId, { id: groupId, name: 'Test Group' });

            // Set up group memberships for both users
            const payerMembershipDoc = new GroupMemberDocumentBuilder().withUserId('valid-payer').withGroupId(groupId).withRole('member').withStatus('active').build();
            const payeeMembershipDoc = new GroupMemberDocumentBuilder().withUserId('valid-payee').withGroupId(groupId).withRole('member').withStatus('active').build();
            stubReader.setDocument('group-members', `${groupId}_valid-payer`, payerMembershipDoc);
            stubReader.setDocument('group-members', `${groupId}_valid-payee`, payeeMembershipDoc);

            stubWriter.createSettlement = () => Promise.resolve({ id: 'new-settlement-id', success: true });

            // Act & Assert - Should not throw
            await expect(settlementService.createSettlement(settlementData, userId)).resolves.toBeDefined();
        });

        it('should handle user data validation during settlement creation', async () => {
            // Note: User data validation in createSettlement only validates group membership,
            // not user document structure. The fetchUserData validation happens in other methods
            // like updateSettlement where user details are needed for the response.

            // Arrange
            const userId = 'creator-user';
            const groupId = 'test-group';
            const settlementData = new CreateSettlementRequestBuilder().withGroupId(groupId).withPayerId('payer-user').withPayeeId('payee-user').withAmount(100).build();

            // Mock basic setup
            setGroupData(groupId, { id: groupId, name: 'Test Group' });

            // Set up group memberships for both users
            const payerMembershipDoc = new GroupMemberDocumentBuilder().withUserId('payer-user').withGroupId(groupId).withRole('member').withStatus('active').build();
            const payeeMembershipDoc = new GroupMemberDocumentBuilder().withUserId('payee-user').withGroupId(groupId).withRole('member').withStatus('active').build();
            stubReader.setDocument('group-members', `${groupId}_payer-user`, payerMembershipDoc);
            stubReader.setDocument('group-members', `${groupId}_payee-user`, payeeMembershipDoc);

            stubWriter.createSettlement = () => Promise.resolve({ id: 'new-settlement-id', success: true });

            // Act & Assert - Should succeed (user data validation happens elsewhere)
            await expect(settlementService.createSettlement(settlementData, userId)).resolves.toBeDefined();
        });
    });

    describe('Group Membership Validation', () => {
        it('should validate group membership for all users', async () => {
            // Arrange
            const userId = 'creator-user';
            const groupId = 'test-group';
            const settlementData = new CreateSettlementRequestBuilder().withGroupId(groupId).withPayerId('payer-user').withPayeeId('payee-user').withAmount(100).build();

            // Mock valid data
            setGroupData(groupId, { id: groupId, name: 'Test Group' });
            setUserData('payer-user', { email: 'payer@test.com', displayName: 'Payer User' });
            setUserData('payee-user', { email: 'payee@test.com', displayName: 'Payee User' });

            // Set up group memberships for both users
            const payerMembershipDoc = new GroupMemberDocumentBuilder().withUserId('payer-user').withGroupId(groupId).withRole('member').withStatus('active').build();
            const payeeMembershipDoc = new GroupMemberDocumentBuilder().withUserId('payee-user').withGroupId(groupId).withRole('member').withStatus('active').build();
            stubReader.setDocument('group-members', `${groupId}_payer-user`, payerMembershipDoc);
            stubReader.setDocument('group-members', `${groupId}_payee-user`, payeeMembershipDoc);

            stubWriter.createSettlement = () => Promise.resolve({ id: 'new-settlement-id', success: true });

            // Act & Assert - Should succeed
            await expect(settlementService.createSettlement(settlementData, userId)).resolves.toBeDefined();

            // Verify membership checks were called
        });

        it('should reject settlement when payer is not group member', async () => {
            // Arrange
            const userId = 'creator-user';
            const groupId = 'test-group';
            const settlementData = new CreateSettlementRequestBuilder().withGroupId(groupId).withPayerId('non-member-payer').withPayeeId('payee-user').withAmount(100).build();

            // Mock group and user data
            setGroupData(groupId, { id: groupId, name: 'Test Group' });
            stubReader.verifyGroupMembership = () => Promise.resolve(true);

            // Set up group memberships - payee is member, payer is not
            const payeeMembershipDoc = new GroupMemberDocumentBuilder().withUserId('payee-user').withGroupId(groupId).withRole('member').withStatus('active').build();
            stubReader.setDocument('group-members', `${groupId}_payee-user`, payeeMembershipDoc);

            // Act & Assert
            await expect(settlementService.createSettlement(settlementData, userId)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'USER_NOT_IN_GROUP',
                    message: 'User non-member-payer is not a member of this group',
                }),
            );
        });

        it('should reject settlement when payee is not group member', async () => {
            // Arrange
            const userId = 'creator-user';
            const groupId = 'test-group';
            const settlementData: CreateSettlementRequest = {
                groupId,
                payerId: 'payer-user',
                payeeId: 'non-member-payee',
                amount: 100,
                currency: 'USD',
                date: new Date().toISOString(),
            };

            // Mock group data
            setGroupData(groupId, { id: groupId, name: 'Test Group' });
            stubReader.verifyGroupMembership = () => Promise.resolve(true);

            // Set up group memberships - payer is member, payee is not
            const payerMembershipDoc = {
                userId: 'payer-user',
                groupId: groupId,
                memberRole: 'member',
                memberStatus: 'active',
                joinedAt: new Date().toISOString(),
            };
            stubReader.setDocument('group-members', `${groupId}_payer-user`, payerMembershipDoc);

            // Act & Assert
            await expect(settlementService.createSettlement(settlementData, userId)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'USER_NOT_IN_GROUP',
                    message: 'User non-member-payee is not a member of this group',
                }),
            );
        });

        it('should reject settlement when group does not exist', async () => {
            // Arrange
            const userId = 'creator-user';
            const groupId = 'non-existent-group';
            const settlementData = new CreateSettlementRequestBuilder().withGroupId(groupId).withPayerId('payer-user').withPayeeId('payee-user').withAmount(100).build();

            // Don't set group data (simulating non-existent group)
            stubReader.verifyGroupMembership = () => Promise.resolve(true);

            // Act & Assert
            await expect(settlementService.createSettlement(settlementData, userId)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.NOT_FOUND,
                    code: 'GROUP_NOT_FOUND',
                    message: 'Group not found',
                }),
            );
        });
    });

    describe('Data Handling Edge Cases', () => {
        it('should handle decimal precision correctly', async () => {
            // Arrange
            const userId = 'creator-user';
            const groupId = 'test-group';
            const settlementData = new CreateSettlementRequestBuilder()
                .withGroupId(groupId)
                .withPayerId('payer-user')
                .withPayeeId('payee-user')
                .withAmount(123.45) // Decimal amount
                .build();

            // Mock required data
            setGroupData(groupId, { id: groupId, name: 'Test Group' });
            setUserData('payer-user', { email: 'payer@test.com', displayName: 'Payer User' });
            setUserData('payee-user', { email: 'payee@test.com', displayName: 'Payee User' });

            // Set up group memberships for both users
            const payerMembershipDoc = new GroupMemberDocumentBuilder().withUserId('payer-user').withGroupId(groupId).withRole('member').withStatus('active').build();
            const payeeMembershipDoc = new GroupMemberDocumentBuilder().withUserId('payee-user').withGroupId(groupId).withRole('member').withStatus('active').build();
            stubReader.setDocument('group-members', `${groupId}_payer-user`, payerMembershipDoc);
            stubReader.setDocument('group-members', `${groupId}_payee-user`, payeeMembershipDoc);

            // Mock dependencies
            stubWriter.createSettlement = () => Promise.resolve({ id: 'new-settlement-id', success: true });

            // Act
            const result = await settlementService.createSettlement(settlementData, userId);

            // Assert
            expect(result.amount).toBe(123.45);
        });

        it('should handle maximum valid amount', async () => {
            // Arrange
            const userId = 'creator-user';
            const groupId = 'test-group';
            const settlementData = new CreateSettlementRequestBuilder()
                .withGroupId(groupId)
                .withPayerId('payer-user')
                .withPayeeId('payee-user')
                .withAmount(999999.99) // Maximum valid amount
                .build();

            // Mock required data
            setGroupData(groupId, { id: groupId, name: 'Test Group' });
            setUserData('payer-user', { email: 'payer@test.com', displayName: 'Payer User' });
            setUserData('payee-user', { email: 'payee@test.com', displayName: 'Payee User' });

            // Set up group memberships for both users
            const payerMembershipDoc = new GroupMemberDocumentBuilder().withUserId('payer-user').withGroupId(groupId).withRole('member').withStatus('active').build();
            const payeeMembershipDoc = new GroupMemberDocumentBuilder().withUserId('payee-user').withGroupId(groupId).withRole('member').withStatus('active').build();
            stubReader.setDocument('group-members', `${groupId}_payer-user`, payerMembershipDoc);
            stubReader.setDocument('group-members', `${groupId}_payee-user`, payeeMembershipDoc);

            // Mock dependencies
            stubWriter.createSettlement = () => Promise.resolve({ id: 'new-settlement-id', success: true });

            // Act & Assert - Should succeed
            await expect(settlementService.createSettlement(settlementData, userId)).resolves.toBeDefined();
        });

        it('should handle minimum valid amount', async () => {
            // Arrange
            const userId = 'creator-user';
            const groupId = 'test-group';
            const settlementData = new CreateSettlementRequestBuilder()
                .withGroupId(groupId)
                .withPayerId('payer-user')
                .withPayeeId('payee-user')
                .withAmount(0.01) // Minimum valid amount
                .build();

            // Mock required data
            setGroupData(groupId, { id: groupId, name: 'Test Group' });
            setUserData('payer-user', { email: 'payer@test.com', displayName: 'Payer User' });
            setUserData('payee-user', { email: 'payee@test.com', displayName: 'Payee User' });

            // Set up group memberships for both users
            const payerMembershipDoc = new GroupMemberDocumentBuilder().withUserId('payer-user').withGroupId(groupId).withRole('member').withStatus('active').build();
            const payeeMembershipDoc = new GroupMemberDocumentBuilder().withUserId('payee-user').withGroupId(groupId).withRole('member').withStatus('active').build();
            stubReader.setDocument('group-members', `${groupId}_payer-user`, payerMembershipDoc);
            stubReader.setDocument('group-members', `${groupId}_payee-user`, payeeMembershipDoc);

            // Mock dependencies
            stubWriter.createSettlement = () => Promise.resolve({ id: 'new-settlement-id', success: true });

            // Act & Assert - Should succeed
            await expect(settlementService.createSettlement(settlementData, userId)).resolves.toBeDefined();
        });
    });
});
