import type { CreateSettlementRequest } from '@splitifyd/shared';
import { CreateSettlementRequestBuilder } from '@splitifyd/test-support';
import { beforeEach, describe, expect, it } from 'vitest';
import { HTTP_STATUS } from '../../../constants';
import { ApplicationBuilder } from '../../../services/ApplicationBuilder';
import { SettlementService } from '../../../services/SettlementService';
import { GroupMemberDocumentBuilder } from '../../support/GroupMemberDocumentBuilder';
import { StubAuthService, StubFirestoreReader, StubFirestoreWriter } from '../mocks/firestore-stubs';

describe('SettlementService - Unit Tests', () => {
    let settlementService: SettlementService;
    let stubReader: StubFirestoreReader;
    let stubWriter: StubFirestoreWriter;
    let stubAuth: StubAuthService;
    let applicationBuilder: ApplicationBuilder;

    // Helper to set user data in stub
    const setUserData = (userId: string, userData: Record<string, any> = {}) => {
        stubReader.setUser(userId, userData);
    };

    // Helper to set group data in stub
    const setGroupData = (groupId: string, groupData: any) => {
        stubReader.setDocument('groups', groupId, groupData);
    };

    // Helper to initialize balance document for a group
    const initializeGroupBalance = async (groupId: string) => {
        const initialBalance = {
            groupId,
            balancesByCurrency: {},
            simplifiedDebts: [],
            lastUpdatedAt: new Date().toISOString(),
            version: 0,
        };
        await stubWriter.setGroupBalance(groupId, initialBalance);
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
            await initializeGroupBalance(groupId); // Initialize balance for incremental updates
            setUserData('payer-user', { email: 'payer@test.com', displayName: 'Payer User' });
            setUserData('payee-user', { email: 'payee@test.com', displayName: 'Payee User' });

            // Set up group memberships for all users (creator, payer, payee)
            const creatorMembershipDoc = new GroupMemberDocumentBuilder()
                .withUserId('creator-user')
                .withGroupId(groupId)
                .withRole('member')
                .withStatus('active')
                .build();
            const payerMembershipDoc = new GroupMemberDocumentBuilder()
                .withUserId('payer-user')
                .withGroupId(groupId)
                .withRole('member')
                .withStatus('active')
                .build();
            const payeeMembershipDoc = new GroupMemberDocumentBuilder()
                .withUserId('payee-user')
                .withGroupId(groupId)
                .withRole('member')
                .withStatus('active')
                .build();
            stubReader.setDocument('group-members', `${groupId}_creator-user`, creatorMembershipDoc);
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

        // Note: Amount validation tests (zero, negative, excessive) were removed
        // because validation was moved to the API handler layer (Joi schemas)
        // per commit cec536b9. Service-level tests should not test handler-level validation.

        it('should handle optional note field correctly', async () => {
            // Arrange
            const userId = 'creator-user';
            const groupId = 'test-group';
            const settlementDataWithoutNote = new CreateSettlementRequestBuilder()
                .withGroupId(groupId)
                .withPayerId('payer-user')
                .withPayeeId('payee-user')
                .withAmount(50.0)
                .withCurrency('USD')
                .withoutNote() // No note field
                .build();

            // Mock required data
            setGroupData(groupId, { id: groupId, name: 'Test Group' });
            await initializeGroupBalance(groupId); // Initialize balance for incremental updates
            setUserData('payer-user', { email: 'payer@test.com', displayName: 'Payer User' });
            setUserData('payee-user', { email: 'payee@test.com', displayName: 'Payee User' });

            // Set up group memberships for all users (creator, payer, payee)
            const creatorMembershipDoc = new GroupMemberDocumentBuilder()
                .withUserId('creator-user')
                .withGroupId(groupId)
                .withRole('member')
                .withStatus('active')
                .build();
            const payerMembershipDoc = new GroupMemberDocumentBuilder()
                .withUserId('payer-user')
                .withGroupId(groupId)
                .withRole('member')
                .withStatus('active')
                .build();
            const payeeMembershipDoc = new GroupMemberDocumentBuilder()
                .withUserId('payee-user')
                .withGroupId(groupId)
                .withRole('member')
                .withStatus('active')
                .build();
            stubReader.setDocument('group-members', `${groupId}_creator-user`, creatorMembershipDoc);
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
            const settlementData = new CreateSettlementRequestBuilder()
                .withGroupId(groupId)
                .withPayerId('valid-payer')
                .withPayeeId('valid-payee')
                .build();

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
            await initializeGroupBalance(groupId); // Initialize balance for incremental updates

            // Set up group memberships for all users (creator, payer, payee)
            const creatorMembershipDoc = new GroupMemberDocumentBuilder()
                .withUserId('creator-user')
                .withGroupId(groupId)
                .withRole('member')
                .withStatus('active')
                .build();
            const payerMembershipDoc = new GroupMemberDocumentBuilder()
                .withUserId('valid-payer')
                .withGroupId(groupId)
                .withRole('member')
                .withStatus('active')
                .build();
            const payeeMembershipDoc = new GroupMemberDocumentBuilder()
                .withUserId('valid-payee')
                .withGroupId(groupId)
                .withRole('member')
                .withStatus('active')
                .build();
            stubReader.setDocument('group-members', `${groupId}_creator-user`, creatorMembershipDoc);
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
            const settlementData = new CreateSettlementRequestBuilder()
                .withGroupId(groupId)
                .withPayerId('payer-user')
                .withPayeeId('payee-user')
                .build();

            // Mock basic setup
            setGroupData(groupId, { id: groupId, name: 'Test Group' });
            await initializeGroupBalance(groupId); // Initialize balance for incremental updates

            // Set up group memberships for all users (creator, payer, payee)
            const creatorMembershipDoc = new GroupMemberDocumentBuilder()
                .withUserId('creator-user')
                .withGroupId(groupId)
                .withRole('member')
                .withStatus('active')
                .build();
            const payerMembershipDoc = new GroupMemberDocumentBuilder()
                .withUserId('payer-user')
                .withGroupId(groupId)
                .withRole('member')
                .withStatus('active')
                .build();
            const payeeMembershipDoc = new GroupMemberDocumentBuilder()
                .withUserId('payee-user')
                .withGroupId(groupId)
                .withRole('member')
                .withStatus('active')
                .build();
            stubReader.setDocument('group-members', `${groupId}_creator-user`, creatorMembershipDoc);
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
            const settlementData = new CreateSettlementRequestBuilder()
                .withGroupId(groupId)
                .withPayerId('payer-user')
                .withPayeeId('payee-user')
                .build();

            // Mock valid data
            setGroupData(groupId, { id: groupId, name: 'Test Group' });
            await initializeGroupBalance(groupId); // Initialize balance for incremental updates
            setUserData('payer-user', { email: 'payer@test.com', displayName: 'Payer User' });
            setUserData('payee-user', { email: 'payee@test.com', displayName: 'Payee User' });

            // Set up group memberships for all users (creator, payer, payee)
            const creatorMembershipDoc = new GroupMemberDocumentBuilder()
                .withUserId('creator-user')
                .withGroupId(groupId)
                .withRole('member')
                .withStatus('active')
                .build();
            const payerMembershipDoc = new GroupMemberDocumentBuilder()
                .withUserId('payer-user')
                .withGroupId(groupId)
                .withRole('member')
                .withStatus('active')
                .build();
            const payeeMembershipDoc = new GroupMemberDocumentBuilder()
                .withUserId('payee-user')
                .withGroupId(groupId)
                .withRole('member')
                .withStatus('active')
                .build();
            stubReader.setDocument('group-members', `${groupId}_creator-user`, creatorMembershipDoc);
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
            const settlementData = new CreateSettlementRequestBuilder()
                .withGroupId(groupId)
                .withPayerId('non-member-payer')
                .withPayeeId('payee-user')
                .build();

            // Mock group and user data
            setGroupData(groupId, { id: groupId, name: 'Test Group' });
            await initializeGroupBalance(groupId); // Initialize balance for incremental updates
            stubReader.verifyGroupMembership = () => Promise.resolve(true);

            // Set up group memberships - creator and payee are members, payer is not
            const creatorMembershipDoc = new GroupMemberDocumentBuilder()
                .withUserId('creator-user')
                .withGroupId(groupId)
                .withRole('member')
                .withStatus('active')
                .build();
            const payeeMembershipDoc = new GroupMemberDocumentBuilder()
                .withUserId('payee-user')
                .withGroupId(groupId)
                .withRole('member')
                .withStatus('active')
                .build();
            stubReader.setDocument('group-members', `${groupId}_creator-user`, creatorMembershipDoc);
            stubReader.setDocument('group-members', `${groupId}_payee-user`, payeeMembershipDoc);

            // Act & Assert
            await expect(settlementService.createSettlement(settlementData, userId)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'MEMBER_NOT_IN_GROUP',
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
            await initializeGroupBalance(groupId); // Initialize balance for incremental updates
            stubReader.verifyGroupMembership = () => Promise.resolve(true);

            // Set up group memberships - creator and payer are members, payee is not
            const creatorMembershipDoc = new GroupMemberDocumentBuilder()
                .withUserId('creator-user')
                .withGroupId(groupId)
                .withRole('member')
                .withStatus('active')
                .build();
            const payerMembershipDoc = new GroupMemberDocumentBuilder()
                .withUserId('payer-user')
                .withGroupId(groupId)
                .withRole('member')
                .withStatus('active')
                .build();
            stubReader.setDocument('group-members', `${groupId}_creator-user`, creatorMembershipDoc);
            stubReader.setDocument('group-members', `${groupId}_payer-user`, payerMembershipDoc);

            // Act & Assert
            await expect(settlementService.createSettlement(settlementData, userId)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'MEMBER_NOT_IN_GROUP',
                }),
            );
        });

        it('should reject settlement when group does not exist', async () => {
            // Arrange
            const userId = 'creator-user';
            const groupId = 'non-existent-group';
            const settlementData = new CreateSettlementRequestBuilder()
                .withGroupId(groupId)
                .withPayerId('payer-user')
                .withPayeeId('payee-user')
                .build();

            // Don't set group data (simulating non-existent group)
            stubReader.verifyGroupMembership = () => Promise.resolve(true);

            // Act & Assert
            await expect(settlementService.createSettlement(settlementData, userId)).rejects.toThrow(
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
            const userId = 'creator-user';
            const groupId = 'test-group';
            const settlementData = new CreateSettlementRequestBuilder()
                .withGroupId(groupId)
                .withPayerId('payer-user')
                .withPayeeId('payee-user')
                .withAmount(123.45) // Decimal amount
                .withCurrency('USD')
                .build();

            // Mock required data
            setGroupData(groupId, { id: groupId, name: 'Test Group' });
            await initializeGroupBalance(groupId); // Initialize balance for incremental updates
            setUserData('payer-user', { email: 'payer@test.com', displayName: 'Payer User' });
            setUserData('payee-user', { email: 'payee@test.com', displayName: 'Payee User' });

            // Set up group memberships for all users (creator, payer, payee)
            const creatorMembershipDoc = new GroupMemberDocumentBuilder()
                .withUserId('creator-user')
                .withGroupId(groupId)
                .withRole('member')
                .withStatus('active')
                .build();
            const payerMembershipDoc = new GroupMemberDocumentBuilder()
                .withUserId('payer-user')
                .withGroupId(groupId)
                .withRole('member')
                .withStatus('active')
                .build();
            const payeeMembershipDoc = new GroupMemberDocumentBuilder()
                .withUserId('payee-user')
                .withGroupId(groupId)
                .withRole('member')
                .withStatus('active')
                .build();
            stubReader.setDocument('group-members', `${groupId}_creator-user`, creatorMembershipDoc);
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
                .withCurrency('USD')
                .build();

            // Mock required data
            setGroupData(groupId, { id: groupId, name: 'Test Group' });
            await initializeGroupBalance(groupId); // Initialize balance for incremental updates
            setUserData('payer-user', { email: 'payer@test.com', displayName: 'Payer User' });
            setUserData('payee-user', { email: 'payee@test.com', displayName: 'Payee User' });

            // Set up group memberships for all users (creator, payer, payee)
            const creatorMembershipDoc = new GroupMemberDocumentBuilder()
                .withUserId('creator-user')
                .withGroupId(groupId)
                .withRole('member')
                .withStatus('active')
                .build();
            const payerMembershipDoc = new GroupMemberDocumentBuilder()
                .withUserId('payer-user')
                .withGroupId(groupId)
                .withRole('member')
                .withStatus('active')
                .build();
            const payeeMembershipDoc = new GroupMemberDocumentBuilder()
                .withUserId('payee-user')
                .withGroupId(groupId)
                .withRole('member')
                .withStatus('active')
                .build();
            stubReader.setDocument('group-members', `${groupId}_creator-user`, creatorMembershipDoc);
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
                .withCurrency('USD')
                .build();

            // Mock required data
            setGroupData(groupId, { id: groupId, name: 'Test Group' });
            await initializeGroupBalance(groupId); // Initialize balance for incremental updates
            setUserData('payer-user', { email: 'payer@test.com', displayName: 'Payer User' });
            setUserData('payee-user', { email: 'payee@test.com', displayName: 'Payee User' });

            // Set up group memberships for all users (creator, payer, payee)
            const creatorMembershipDoc = new GroupMemberDocumentBuilder()
                .withUserId('creator-user')
                .withGroupId(groupId)
                .withRole('member')
                .withStatus('active')
                .build();
            const payerMembershipDoc = new GroupMemberDocumentBuilder()
                .withUserId('payer-user')
                .withGroupId(groupId)
                .withRole('member')
                .withStatus('active')
                .build();
            const payeeMembershipDoc = new GroupMemberDocumentBuilder()
                .withUserId('payee-user')
                .withGroupId(groupId)
                .withRole('member')
                .withStatus('active')
                .build();
            stubReader.setDocument('group-members', `${groupId}_creator-user`, creatorMembershipDoc);
            stubReader.setDocument('group-members', `${groupId}_payer-user`, payerMembershipDoc);
            stubReader.setDocument('group-members', `${groupId}_payee-user`, payeeMembershipDoc);

            // Mock dependencies
            stubWriter.createSettlement = () => Promise.resolve({ id: 'new-settlement-id', success: true });

            // Act & Assert - Should succeed
            await expect(settlementService.createSettlement(settlementData, userId)).resolves.toBeDefined();
        });
    });

    describe('Soft Delete Functionality', () => {
        it('should initialize new settlements with deletedAt and deletedBy as null', async () => {
            // Arrange
            const userId = 'creator-user';
            const groupId = 'test-group';
            const settlementData = new CreateSettlementRequestBuilder()
                .withGroupId(groupId)
                .withPayerId('payer-user')
                .withPayeeId('payee-user')
                .build();

            // Mock required data
            setGroupData(groupId, { id: groupId, name: 'Test Group' });
            await initializeGroupBalance(groupId);
            setUserData('payer-user', { email: 'payer@test.com', displayName: 'Payer User' });
            setUserData('payee-user', { email: 'payee@test.com', displayName: 'Payee User' });

            // Set up group memberships for all users (creator, payer, payee)
            const creatorMembershipDoc = new GroupMemberDocumentBuilder()
                .withUserId('creator-user')
                .withGroupId(groupId)
                .withRole('member')
                .withStatus('active')
                .build();
            const payerMembershipDoc = new GroupMemberDocumentBuilder()
                .withUserId('payer-user')
                .withGroupId(groupId)
                .withRole('member')
                .withStatus('active')
                .build();
            const payeeMembershipDoc = new GroupMemberDocumentBuilder()
                .withUserId('payee-user')
                .withGroupId(groupId)
                .withRole('member')
                .withStatus('active')
                .build();
            stubReader.setDocument('group-members', `${groupId}_creator-user`, creatorMembershipDoc);
            stubReader.setDocument('group-members', `${groupId}_payer-user`, payerMembershipDoc);
            stubReader.setDocument('group-members', `${groupId}_payee-user`, payeeMembershipDoc);

            stubWriter.generateDocumentId = () => 'new-settlement-id';

            // Act
            const result = await settlementService.createSettlement(settlementData, userId);

            // Assert - Verify soft delete fields are initialized
            expect(result.deletedAt).toBeNull();
            expect(result.deletedBy).toBeNull();
        });

        it('should soft delete settlement with correct metadata', async () => {
            // Arrange
            const settlementId = 'test-settlement-id';
            const creatorId = 'creator-user';
            const groupId = 'test-group';

            // Create settlement in stub
            const settlementData = {
                id: settlementId,
                groupId,
                payerId: 'payer-user',
                payeeId: 'payee-user',
                amount: 100,
                currency: 'USD',
                date: new Date().toISOString(),
                note: 'Test settlement',
                createdBy: creatorId,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                deletedAt: null,
                deletedBy: null,
            };
            stubReader.setDocument('settlements', settlementId, settlementData);

            // Set up group and membership
            setGroupData(groupId, { id: groupId, name: 'Test Group' });
            await initializeGroupBalance(groupId);
            const creatorMembershipDoc = new GroupMemberDocumentBuilder()
                .withUserId(creatorId)
                .withGroupId(groupId)
                .withRole('member')
                .withStatus('active')
                .build();
            stubReader.setDocument('group-members', `${groupId}_${creatorId}`, creatorMembershipDoc);

            // Act & Assert - Should succeed without throwing
            // This verifies that:
            // 1. Settlement exists
            // 2. User has permission (creator or admin)
            // 3. Settlement is not already deleted
            // 4. Balance update succeeds
            await expect(settlementService.softDeleteSettlement(settlementId, creatorId)).resolves.toBeUndefined();
        });

        it('should prevent soft deleting already deleted settlement', async () => {
            // Arrange
            const settlementId = 'deleted-settlement-id';
            const creatorId = 'creator-user';
            const groupId = 'test-group';

            // Create already-deleted settlement
            const deletedSettlementData = {
                id: settlementId,
                groupId,
                payerId: 'payer-user',
                payeeId: 'payee-user',
                amount: 100,
                currency: 'USD',
                date: new Date().toISOString(),
                createdBy: creatorId,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                deletedAt: new Date().toISOString(), // Already deleted
                deletedBy: creatorId,
            };
            stubReader.setDocument('settlements', settlementId, deletedSettlementData);

            // Set up group and membership
            setGroupData(groupId, { id: groupId, name: 'Test Group' });
            const creatorMembershipDoc = new GroupMemberDocumentBuilder()
                .withUserId(creatorId)
                .withGroupId(groupId)
                .withRole('member')
                .withStatus('active')
                .build();
            stubReader.setDocument('group-members', `${groupId}_${creatorId}`, creatorMembershipDoc);

            // Act & Assert
            await expect(settlementService.softDeleteSettlement(settlementId, creatorId)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'ALREADY_DELETED',
                    message: 'Settlement is already deleted',
                }),
            );
        });

        it('should allow settlement creator to soft delete', async () => {
            // Arrange
            const settlementId = 'test-settlement-id';
            const creatorId = 'creator-user';
            const groupId = 'test-group';

            const settlementData = {
                id: settlementId,
                groupId,
                payerId: 'payer-user',
                payeeId: 'payee-user',
                amount: 100,
                currency: 'USD',
                date: new Date().toISOString(),
                createdBy: creatorId,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                deletedAt: null,
                deletedBy: null,
            };
            stubReader.setDocument('settlements', settlementId, settlementData);

            setGroupData(groupId, { id: groupId, name: 'Test Group' });
            await initializeGroupBalance(groupId);
            const creatorMembershipDoc = new GroupMemberDocumentBuilder()
                .withUserId(creatorId)
                .withGroupId(groupId)
                .withRole('member')
                .withStatus('active')
                .build();
            stubReader.setDocument('group-members', `${groupId}_${creatorId}`, creatorMembershipDoc);

            // Act & Assert - Should succeed
            await expect(settlementService.softDeleteSettlement(settlementId, creatorId)).resolves.not.toThrow();
        });

        it('should allow group admin to soft delete settlement', async () => {
            // Arrange
            const settlementId = 'test-settlement-id';
            const creatorId = 'creator-user';
            const adminId = 'admin-user';
            const groupId = 'test-group';

            const settlementData = {
                id: settlementId,
                groupId,
                payerId: 'payer-user',
                payeeId: 'payee-user',
                amount: 100,
                currency: 'USD',
                date: new Date().toISOString(),
                createdBy: creatorId, // Different from admin
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                deletedAt: null,
                deletedBy: null,
            };
            stubReader.setDocument('settlements', settlementId, settlementData);

            setGroupData(groupId, { id: groupId, name: 'Test Group' });
            await initializeGroupBalance(groupId);
            const adminMembershipDoc = new GroupMemberDocumentBuilder()
                .withUserId(adminId)
                .withGroupId(groupId)
                .withRole('admin') // Admin role
                .withStatus('active')
                .build();
            stubReader.setDocument('group-members', `${groupId}_${adminId}`, adminMembershipDoc);

            // Act & Assert - Should succeed for admin
            await expect(settlementService.softDeleteSettlement(settlementId, adminId)).resolves.not.toThrow();
        });

        it('should prevent non-creator non-admin from soft deleting settlement', async () => {
            // Arrange
            const settlementId = 'test-settlement-id';
            const creatorId = 'creator-user';
            const otherId = 'other-user';
            const groupId = 'test-group';

            const settlementData = {
                id: settlementId,
                groupId,
                payerId: 'payer-user',
                payeeId: 'payee-user',
                amount: 100,
                currency: 'USD',
                date: new Date().toISOString(),
                createdBy: creatorId,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                deletedAt: null,
                deletedBy: null,
            };
            stubReader.setDocument('settlements', settlementId, settlementData);

            setGroupData(groupId, { id: groupId, name: 'Test Group' });
            await initializeGroupBalance(groupId);
            const otherMembershipDoc = new GroupMemberDocumentBuilder()
                .withUserId(otherId)
                .withGroupId(groupId)
                .withRole('member') // Regular member, not creator or admin
                .withStatus('active')
                .build();
            stubReader.setDocument('group-members', `${groupId}_${otherId}`, otherMembershipDoc);

            // Act & Assert
            await expect(settlementService.softDeleteSettlement(settlementId, otherId)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.FORBIDDEN,
                }),
            );
        });

        it('should prevent soft deleting non-existent settlement', async () => {
            // Arrange
            const settlementId = 'non-existent-settlement-id';
            const userId = 'user-id';

            // Don't set settlement data (simulating non-existent settlement)

            // Act & Assert
            await expect(settlementService.softDeleteSettlement(settlementId, userId)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.NOT_FOUND,
                    code: 'SETTLEMENT_NOT_FOUND',
                }),
            );
        });

        it('should prevent soft deleting settlement when user not in group', async () => {
            // Arrange
            const settlementId = 'test-settlement-id';
            const creatorId = 'creator-user';
            const nonMemberId = 'non-member-user';
            const groupId = 'test-group';

            const settlementData = {
                id: settlementId,
                groupId,
                payerId: 'payer-user',
                payeeId: 'payee-user',
                amount: 100,
                currency: 'USD',
                date: new Date().toISOString(),
                createdBy: creatorId,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                deletedAt: null,
                deletedBy: null,
            };
            stubReader.setDocument('settlements', settlementId, settlementData);

            setGroupData(groupId, { id: groupId, name: 'Test Group' });

            // Don't add nonMemberId to group memberships

            // Act & Assert
            await expect(settlementService.softDeleteSettlement(settlementId, nonMemberId)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.FORBIDDEN,
                }),
            );
        });
    });
});
