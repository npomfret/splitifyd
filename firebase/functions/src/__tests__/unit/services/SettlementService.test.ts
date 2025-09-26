import { describe, it, expect, beforeEach } from 'vitest';
import { SettlementService } from '../../../services/SettlementService';
import { ApplicationBuilder } from '../../../services/ApplicationBuilder';
import {
    StubFirestoreReader,
    StubFirestoreWriter,
    StubAuthService,
    StubDateHelpers,
    StubLogger,
    StubLoggerContext,
    StubMeasure
} from '../mocks/firestore-stubs';
import { HTTP_STATUS } from '../../../constants';
import { Timestamp } from 'firebase-admin/firestore';
import type { CreateSettlementRequest } from '@splitifyd/shared';


describe('SettlementService - Unit Tests', () => {
    let settlementService: SettlementService;
    let stubReader: StubFirestoreReader;
    let stubWriter: StubFirestoreWriter;
    let stubAuth: StubAuthService;
    let stubDateHelpers: StubDateHelpers;
    let stubLogger: StubLogger;
    let stubLoggerContext: StubLoggerContext;
    let stubMeasure: StubMeasure;
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
        stubDateHelpers = new StubDateHelpers();
        stubLogger = new StubLogger();
        stubLoggerContext = new StubLoggerContext();
        stubMeasure = new StubMeasure();

        // Create ApplicationBuilder for group member service
        applicationBuilder = new ApplicationBuilder(stubReader, stubWriter, stubAuth);
        const groupMemberService = applicationBuilder.buildGroupMemberService();

        // Create SettlementService with dependency injection
        settlementService = new SettlementService(
            stubReader,
            stubWriter,
            groupMemberService,
            // Inject stub dependencies
            stubDateHelpers,      // injectedDateHelpers
            stubLogger,           // injectedLogger
            StubLoggerContext,    // injectedLoggerContext
            StubMeasure           // injectedMeasure
        );
    });

    describe('Settlement Creation Validation', () => {
        it('should validate settlement amounts correctly', async () => {
            // Arrange
            const userId = 'creator-user';
            const groupId = 'test-group';
            const validSettlementData: CreateSettlementRequest = {
                groupId,
                payerId: 'payer-user',
                payeeId: 'payee-user',
                amount: 100.5,
                currency: 'USD',
                note: 'Test settlement',
                date: new Date().toISOString(),
            };

            // Mock required data
            setGroupData(groupId, { id: groupId, name: 'Test Group' });
            setUserData('payer-user', { email: 'payer@test.com', displayName: 'Payer User' });
            setUserData('payee-user', { email: 'payee@test.com', displayName: 'Payee User' });

            // Set up group memberships for both users
            const payerMembershipDoc = {
                userId: 'payer-user',
                groupId: groupId,
                memberRole: 'member',
                memberStatus: 'active',
                joinedAt: new Date().toISOString(),
            };
            const payeeMembershipDoc = {
                userId: 'payee-user',
                groupId: groupId,
                memberRole: 'member',
                memberStatus: 'active',
                joinedAt: new Date().toISOString(),
            };
            stubReader.setDocument('group-members', `${groupId}_payer-user`, payerMembershipDoc);
            stubReader.setDocument('group-members', `${groupId}_payee-user`, payeeMembershipDoc);

            // Mock writer to return successful result
            stubWriter.createSettlement = () => Promise.resolve({ id: 'new-settlement-id', success: true });

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
            const invalidSettlementData: CreateSettlementRequest = {
                groupId: 'test-group',
                payerId: 'payer-user',
                payeeId: 'payee-user',
                amount: 0, // Invalid amount
                currency: 'USD',
                date: new Date().toISOString(),
            };

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
            const invalidSettlementData: CreateSettlementRequest = {
                groupId: 'test-group',
                payerId: 'payer-user',
                payeeId: 'payee-user',
                amount: -10, // Invalid negative amount
                currency: 'USD',
                date: new Date().toISOString(),
            };

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
            const invalidSettlementData: CreateSettlementRequest = {
                groupId: 'test-group',
                payerId: 'payer-user',
                payeeId: 'payee-user',
                amount: 1000000, // Exceeds maximum amount
                currency: 'USD',
                date: new Date().toISOString(),
            };

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
            const settlementDataWithoutNote: CreateSettlementRequest = {
                groupId,
                payerId: 'payer-user',
                payeeId: 'payee-user',
                amount: 50.0,
                currency: 'USD',
                date: new Date().toISOString(),
                // No note field
            };

            // Mock required data
            setGroupData(groupId, { id: groupId, name: 'Test Group' });
            setUserData('payer-user', { email: 'payer@test.com', displayName: 'Payer User' });
            setUserData('payee-user', { email: 'payee@test.com', displayName: 'Payee User' });

            // Set up group memberships for both users
            const payerMembershipDoc = {
                userId: 'payer-user',
                groupId: groupId,
                memberRole: 'member',
                memberStatus: 'active',
                joinedAt: new Date().toISOString(),
            };
            const payeeMembershipDoc = {
                userId: 'payee-user',
                groupId: groupId,
                memberRole: 'member',
                memberStatus: 'active',
                joinedAt: new Date().toISOString(),
            };
            stubReader.setDocument('group-members', `${groupId}_payer-user`, payerMembershipDoc);
            stubReader.setDocument('group-members', `${groupId}_payee-user`, payeeMembershipDoc);

            // Mock dependencies
            stubWriter.createSettlement = () => Promise.resolve({ id: 'new-settlement-id', success: true });

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
            const settlementData: CreateSettlementRequest = {
                groupId,
                payerId: 'valid-payer',
                payeeId: 'valid-payee',
                amount: 100,
                currency: 'USD',
                date: new Date().toISOString(),
            };

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
            const payerMembershipDoc = {
                userId: 'valid-payer',
                groupId: groupId,
                memberRole: 'member',
                memberStatus: 'active',
                joinedAt: new Date().toISOString(),
            };
            const payeeMembershipDoc = {
                userId: 'valid-payee',
                groupId: groupId,
                memberRole: 'member',
                memberStatus: 'active',
                joinedAt: new Date().toISOString(),
            };
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
            const settlementData: CreateSettlementRequest = {
                groupId,
                payerId: 'payer-user',
                payeeId: 'payee-user',
                amount: 100,
                currency: 'USD',
                date: new Date().toISOString(),
            };

            // Mock basic setup
            setGroupData(groupId, { id: groupId, name: 'Test Group' });

            // Set up group memberships for both users
            const payerMembershipDoc = {
                userId: 'payer-user',
                groupId: groupId,
                memberRole: 'member',
                memberStatus: 'active',
                joinedAt: new Date().toISOString(),
            };
            const payeeMembershipDoc = {
                userId: 'payee-user',
                groupId: groupId,
                memberRole: 'member',
                memberStatus: 'active',
                joinedAt: new Date().toISOString(),
            };
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
            const settlementData: CreateSettlementRequest = {
                groupId,
                payerId: 'payer-user',
                payeeId: 'payee-user',
                amount: 100,
                currency: 'USD',
                date: new Date().toISOString(),
            };

            // Mock valid data
            setGroupData(groupId, { id: groupId, name: 'Test Group' });
            setUserData('payer-user', { email: 'payer@test.com', displayName: 'Payer User' });
            setUserData('payee-user', { email: 'payee@test.com', displayName: 'Payee User' });

            // Set up group memberships for both users
            const payerMembershipDoc = {
                userId: 'payer-user',
                groupId: groupId,
                memberRole: 'member',
                memberStatus: 'active',
                joinedAt: new Date().toISOString(),
            };
            const payeeMembershipDoc = {
                userId: 'payee-user',
                groupId: groupId,
                memberRole: 'member',
                memberStatus: 'active',
                joinedAt: new Date().toISOString(),
            };
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
            const settlementData: CreateSettlementRequest = {
                groupId,
                payerId: 'non-member-payer',
                payeeId: 'payee-user',
                amount: 100,
                currency: 'USD',
                date: new Date().toISOString(),
            };

            // Mock group and user data
            setGroupData(groupId, { id: groupId, name: 'Test Group' });
            stubReader.verifyGroupMembership = () => Promise.resolve(true);

            // Set up group memberships - payee is member, payer is not
            const payeeMembershipDoc = {
                userId: 'payee-user',
                groupId: groupId,
                memberRole: 'member',
                memberStatus: 'active',
                joinedAt: new Date().toISOString(),
            };
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
            const settlementData: CreateSettlementRequest = {
                groupId,
                payerId: 'payer-user',
                payeeId: 'payee-user',
                amount: 100,
                currency: 'USD',
                date: new Date().toISOString(),
            };

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
            const settlementData: CreateSettlementRequest = {
                groupId,
                payerId: 'payer-user',
                payeeId: 'payee-user',
                amount: 123.45, // Decimal amount
                currency: 'USD',
                date: new Date().toISOString(),
            };

            // Mock required data
            setGroupData(groupId, { id: groupId, name: 'Test Group' });
            setUserData('payer-user', { email: 'payer@test.com', displayName: 'Payer User' });
            setUserData('payee-user', { email: 'payee@test.com', displayName: 'Payee User' });

            // Set up group memberships for both users
            const payerMembershipDoc = {
                userId: 'payer-user',
                groupId: groupId,
                memberRole: 'member',
                memberStatus: 'active',
                joinedAt: new Date().toISOString(),
            };
            const payeeMembershipDoc = {
                userId: 'payee-user',
                groupId: groupId,
                memberRole: 'member',
                memberStatus: 'active',
                joinedAt: new Date().toISOString(),
            };
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
            const settlementData: CreateSettlementRequest = {
                groupId,
                payerId: 'payer-user',
                payeeId: 'payee-user',
                amount: 999999.99, // Maximum valid amount
                currency: 'USD',
                date: new Date().toISOString(),
            };

            // Mock required data
            setGroupData(groupId, { id: groupId, name: 'Test Group' });
            setUserData('payer-user', { email: 'payer@test.com', displayName: 'Payer User' });
            setUserData('payee-user', { email: 'payee@test.com', displayName: 'Payee User' });

            // Set up group memberships for both users
            const payerMembershipDoc = {
                userId: 'payer-user',
                groupId: groupId,
                memberRole: 'member',
                memberStatus: 'active',
                joinedAt: new Date().toISOString(),
            };
            const payeeMembershipDoc = {
                userId: 'payee-user',
                groupId: groupId,
                memberRole: 'member',
                memberStatus: 'active',
                joinedAt: new Date().toISOString(),
            };
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
            const settlementData: CreateSettlementRequest = {
                groupId,
                payerId: 'payer-user',
                payeeId: 'payee-user',
                amount: 0.01, // Minimum valid amount
                currency: 'USD',
                date: new Date().toISOString(),
            };

            // Mock required data
            setGroupData(groupId, { id: groupId, name: 'Test Group' });
            setUserData('payer-user', { email: 'payer@test.com', displayName: 'Payer User' });
            setUserData('payee-user', { email: 'payee@test.com', displayName: 'Payee User' });

            // Set up group memberships for both users
            const payerMembershipDoc = {
                userId: 'payer-user',
                groupId: groupId,
                memberRole: 'member',
                memberStatus: 'active',
                joinedAt: new Date().toISOString(),
            };
            const payeeMembershipDoc = {
                userId: 'payee-user',
                groupId: groupId,
                memberRole: 'member',
                memberStatus: 'active',
                joinedAt: new Date().toISOString(),
            };
            stubReader.setDocument('group-members', `${groupId}_payer-user`, payerMembershipDoc);
            stubReader.setDocument('group-members', `${groupId}_payee-user`, payeeMembershipDoc);

            // Mock dependencies
            stubWriter.createSettlement = () => Promise.resolve({ id: 'new-settlement-id', success: true });

            // Act & Assert - Should succeed
            await expect(settlementService.createSettlement(settlementData, userId)).resolves.toBeDefined();
        });
    });
});
