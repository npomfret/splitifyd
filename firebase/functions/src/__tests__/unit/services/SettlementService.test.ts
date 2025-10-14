import {CreateSettlementRequestBuilder, StubFirestoreDatabase} from '@splitifyd/test-support';
import { beforeEach, describe, expect, it } from 'vitest';
import { HTTP_STATUS } from '../../../constants';
import { Timestamp } from '@google-cloud/firestore';
import { ApplicationBuilder } from '../../../services/ApplicationBuilder';
import { FirestoreReader } from '../../../services/firestore';
import { FirestoreWriter } from '../../../services/firestore';
import { SettlementService } from '../../../services/SettlementService';
import { GroupMemberDocumentBuilder } from '../../support/GroupMemberDocumentBuilder';
import { StubAuthService, } from '../mocks/StubAuthService';

describe('SettlementService - Unit Tests', () => {
    let settlementService: SettlementService;
    let db: StubFirestoreDatabase;
    let stubAuth: StubAuthService;
    let applicationBuilder: ApplicationBuilder;

    beforeEach(() => {
        // Create stub database
        db = new StubFirestoreDatabase();
        stubAuth = new StubAuthService();

        // Create reader and writer with stub database
        const firestoreReader = new FirestoreReader(db);
        const firestoreWriter = new FirestoreWriter(db);

        applicationBuilder = new ApplicationBuilder(firestoreReader, firestoreWriter, stubAuth);
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

            // Seed required data
            db.seedGroup(groupId, { name: 'Test Group' });
            db.initializeGroupBalance(groupId);
            db.seedUser('creator-user', { email: 'creator@test.com', displayName: 'Creator User' });
            db.seedUser('payer-user', { email: 'payer@test.com', displayName: 'Payer User' });
            db.seedUser('payee-user', { email: 'payee@test.com', displayName: 'Payee User' });

            // Set up group memberships for all users (creator, payer, payee)
            const creatorMembershipDoc = new GroupMemberDocumentBuilder()
                .withUserId('creator-user')
                .withGroupId(groupId)
                .withRole('member')
                .withStatus('active')
                .buildDocument();
            const payerMembershipDoc = new GroupMemberDocumentBuilder()
                .withUserId('payer-user')
                .withGroupId(groupId)
                .withRole('member')
                .withStatus('active')
                .buildDocument();
            const payeeMembershipDoc = new GroupMemberDocumentBuilder()
                .withUserId('payee-user')
                .withGroupId(groupId)
                .withRole('member')
                .withStatus('active')
                .buildDocument();
            db.seedGroupMember(groupId, 'creator-user', creatorMembershipDoc);
            db.seedGroupMember(groupId, 'payer-user', payerMembershipDoc);
            db.seedGroupMember(groupId, 'payee-user', payeeMembershipDoc);

            // Act
            const result = await settlementService.createSettlement(validSettlementData, userId);

            // Assert
            expect(result.id).toBeDefined();
            expect(result.amount).toBe(100.5);
            expect(result.currency).toBe('USD');
            expect(result.note).toBe('Test settlement');
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
                .withCurrency('USD')
                .withoutNote()
                .build();

            // Seed required data
            db.seedGroup(groupId, { name: 'Test Group' });
            db.initializeGroupBalance(groupId);
            db.seedUser('creator-user', { email: 'creator@test.com', displayName: 'Creator User' });
            db.seedUser('payer-user', { email: 'payer@test.com', displayName: 'Payer User' });
            db.seedUser('payee-user', { email: 'payee@test.com', displayName: 'Payee User' });

            // Set up group memberships
            const creatorMembershipDoc = new GroupMemberDocumentBuilder()
                .withUserId('creator-user')
                .withGroupId(groupId)
                .withRole('member')
                .withStatus('active')
                .buildDocument();
            const payerMembershipDoc = new GroupMemberDocumentBuilder()
                .withUserId('payer-user')
                .withGroupId(groupId)
                .withRole('member')
                .withStatus('active')
                .buildDocument();
            const payeeMembershipDoc = new GroupMemberDocumentBuilder()
                .withUserId('payee-user')
                .withGroupId(groupId)
                .withRole('member')
                .withStatus('active')
                .buildDocument();
            db.seedGroupMember(groupId, 'creator-user', creatorMembershipDoc);
            db.seedGroupMember(groupId, 'payer-user', payerMembershipDoc);
            db.seedGroupMember(groupId, 'payee-user', payeeMembershipDoc);

            // Act
            const result = await settlementService.createSettlement(settlementDataWithoutNote, userId);

            // Assert
            expect(result.id).toBeDefined();
            expect(result.amount).toBe(50.0);
            expect(result.note).toBeUndefined();
        });
    });

    describe('User Data Validation', () => {
        it('should validate user data with complete required fields', async () => {
            // Arrange
            const userId = 'creator-user';
            const groupId = 'test-group';
            const settlementData = new CreateSettlementRequestBuilder()
                .withGroupId(groupId)
                .withPayerId('valid-payer')
                .withPayeeId('valid-payee')
                .build();

            // Seed valid user data
            db.seedUser('creator-user', { email: 'creator@test.com', displayName: 'Creator User' });
            db.seedUser('valid-payer', {
                email: 'payer@example.com',
                displayName: 'Valid Payer',
                otherField: 'should be preserved',
            });
            db.seedUser('valid-payee', {
                email: 'payee@example.com',
                displayName: 'Valid Payee',
            });

            // Seed other dependencies
            db.seedGroup(groupId, { name: 'Test Group' });
            db.initializeGroupBalance(groupId);

            // Set up group memberships
            const creatorMembershipDoc = new GroupMemberDocumentBuilder()
                .withUserId('creator-user')
                .withGroupId(groupId)
                .withRole('member')
                .withStatus('active')
                .buildDocument();
            const payerMembershipDoc = new GroupMemberDocumentBuilder()
                .withUserId('valid-payer')
                .withGroupId(groupId)
                .withRole('member')
                .withStatus('active')
                .buildDocument();
            const payeeMembershipDoc = new GroupMemberDocumentBuilder()
                .withUserId('valid-payee')
                .withGroupId(groupId)
                .withRole('member')
                .withStatus('active')
                .buildDocument();
            db.seedGroupMember(groupId, 'creator-user', creatorMembershipDoc);
            db.seedGroupMember(groupId, 'valid-payer', payerMembershipDoc);
            db.seedGroupMember(groupId, 'valid-payee', payeeMembershipDoc);

            // Act & Assert - Should not throw
            await expect(settlementService.createSettlement(settlementData, userId)).resolves.toBeDefined();
        });

        it('should handle user data validation during settlement creation', async () => {
            // Arrange
            const userId = 'creator-user';
            const groupId = 'test-group';
            const settlementData = new CreateSettlementRequestBuilder()
                .withGroupId(groupId)
                .withPayerId('payer-user')
                .withPayeeId('payee-user')
                .build();

            // Seed basic setup
            db.seedGroup(groupId, { name: 'Test Group' });
            db.initializeGroupBalance(groupId);
            db.seedUser('creator-user', { email: 'creator@test.com', displayName: 'Creator User' });
            db.seedUser('payer-user', { email: 'payer@test.com', displayName: 'Payer User' });
            db.seedUser('payee-user', { email: 'payee@test.com', displayName: 'Payee User' });

            // Set up group memberships
            const creatorMembershipDoc = new GroupMemberDocumentBuilder()
                .withUserId('creator-user')
                .withGroupId(groupId)
                .withRole('member')
                .withStatus('active')
                .buildDocument();
            const payerMembershipDoc = new GroupMemberDocumentBuilder()
                .withUserId('payer-user')
                .withGroupId(groupId)
                .withRole('member')
                .withStatus('active')
                .buildDocument();
            const payeeMembershipDoc = new GroupMemberDocumentBuilder()
                .withUserId('payee-user')
                .withGroupId(groupId)
                .withRole('member')
                .withStatus('active')
                .buildDocument();
            db.seedGroupMember(groupId, 'creator-user', creatorMembershipDoc);
            db.seedGroupMember(groupId, 'payer-user', payerMembershipDoc);
            db.seedGroupMember(groupId, 'payee-user', payeeMembershipDoc);

            // Act & Assert - Should succeed
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

            // Seed valid data
            db.seedGroup(groupId, { name: 'Test Group' });
            db.initializeGroupBalance(groupId);
            db.seedUser('creator-user', { email: 'creator@test.com', displayName: 'Creator User' });
            db.seedUser('payer-user', { email: 'payer@test.com', displayName: 'Payer User' });
            db.seedUser('payee-user', { email: 'payee@test.com', displayName: 'Payee User' });

            // Set up group memberships for all users
            const creatorMembershipDoc = new GroupMemberDocumentBuilder()
                .withUserId('creator-user')
                .withGroupId(groupId)
                .withRole('member')
                .withStatus('active')
                .buildDocument();
            const payerMembershipDoc = new GroupMemberDocumentBuilder()
                .withUserId('payer-user')
                .withGroupId(groupId)
                .withRole('member')
                .withStatus('active')
                .buildDocument();
            const payeeMembershipDoc = new GroupMemberDocumentBuilder()
                .withUserId('payee-user')
                .withGroupId(groupId)
                .withRole('member')
                .withStatus('active')
                .buildDocument();
            db.seedGroupMember(groupId, 'creator-user', creatorMembershipDoc);
            db.seedGroupMember(groupId, 'payer-user', payerMembershipDoc);
            db.seedGroupMember(groupId, 'payee-user', payeeMembershipDoc);

            // Act & Assert - Should succeed
            await expect(settlementService.createSettlement(settlementData, userId)).resolves.toBeDefined();
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

            // Seed group data
            db.seedGroup(groupId, { name: 'Test Group' });
            db.initializeGroupBalance(groupId);

            // Set up group memberships - creator and payee are members, payer is not
            const creatorMembershipDoc = new GroupMemberDocumentBuilder()
                .withUserId('creator-user')
                .withGroupId(groupId)
                .withRole('member')
                .withStatus('active')
                .buildDocument();
            const payeeMembershipDoc = new GroupMemberDocumentBuilder()
                .withUserId('payee-user')
                .withGroupId(groupId)
                .withRole('member')
                .withStatus('active')
                .buildDocument();
            db.seedGroupMember(groupId, 'creator-user', creatorMembershipDoc);
            db.seedGroupMember(groupId, 'payee-user', payeeMembershipDoc);

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
            const settlementData = new CreateSettlementRequestBuilder()
                .withGroupId(groupId)
                .withPayerId('payer-user')
                .withPayeeId('non-member-payee')
                .withAmount(100)
                .withCurrency('USD')
                .withDate(new Date().toISOString())
                .build();

            // Seed group data
            db.seedGroup(groupId, { name: 'Test Group' });
            db.initializeGroupBalance(groupId);

            // Set up group memberships - creator and payer are members, payee is not
            const creatorMembershipDoc = new GroupMemberDocumentBuilder()
                .withUserId('creator-user')
                .withGroupId(groupId)
                .withRole('member')
                .withStatus('active')
                .buildDocument();
            const payerMembershipDoc = new GroupMemberDocumentBuilder()
                .withUserId('payer-user')
                .withGroupId(groupId)
                .withRole('member')
                .withStatus('active')
                .buildDocument();
            db.seedGroupMember(groupId, 'creator-user', creatorMembershipDoc);
            db.seedGroupMember(groupId, 'payer-user', payerMembershipDoc);

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

            // Don't seed group data (simulating non-existent group)

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
                .withAmount(123.45)
                .withCurrency('USD')
                .build();

            // Seed required data
            db.seedGroup(groupId, { name: 'Test Group' });
            db.initializeGroupBalance(groupId);
            db.seedUser('creator-user', { email: 'creator@test.com', displayName: 'Creator User' });
            db.seedUser('payer-user', { email: 'payer@test.com', displayName: 'Payer User' });
            db.seedUser('payee-user', { email: 'payee@test.com', displayName: 'Payee User' });

            // Set up group memberships
            const creatorMembershipDoc = new GroupMemberDocumentBuilder()
                .withUserId('creator-user')
                .withGroupId(groupId)
                .withRole('member')
                .withStatus('active')
                .buildDocument();
            const payerMembershipDoc = new GroupMemberDocumentBuilder()
                .withUserId('payer-user')
                .withGroupId(groupId)
                .withRole('member')
                .withStatus('active')
                .buildDocument();
            const payeeMembershipDoc = new GroupMemberDocumentBuilder()
                .withUserId('payee-user')
                .withGroupId(groupId)
                .withRole('member')
                .withStatus('active')
                .buildDocument();
            db.seedGroupMember(groupId, 'creator-user', creatorMembershipDoc);
            db.seedGroupMember(groupId, 'payer-user', payerMembershipDoc);
            db.seedGroupMember(groupId, 'payee-user', payeeMembershipDoc);

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
                .withAmount(999999.99)
                .withCurrency('USD')
                .build();

            // Seed required data
            db.seedGroup(groupId, { name: 'Test Group' });
            db.initializeGroupBalance(groupId);
            db.seedUser('creator-user', { email: 'creator@test.com', displayName: 'Creator User' });
            db.seedUser('payer-user', { email: 'payer@test.com', displayName: 'Payer User' });
            db.seedUser('payee-user', { email: 'payee@test.com', displayName: 'Payee User' });

            // Set up group memberships
            const creatorMembershipDoc = new GroupMemberDocumentBuilder()
                .withUserId('creator-user')
                .withGroupId(groupId)
                .withRole('member')
                .withStatus('active')
                .buildDocument();
            const payerMembershipDoc = new GroupMemberDocumentBuilder()
                .withUserId('payer-user')
                .withGroupId(groupId)
                .withRole('member')
                .withStatus('active')
                .buildDocument();
            const payeeMembershipDoc = new GroupMemberDocumentBuilder()
                .withUserId('payee-user')
                .withGroupId(groupId)
                .withRole('member')
                .withStatus('active')
                .buildDocument();
            db.seedGroupMember(groupId, 'creator-user', creatorMembershipDoc);
            db.seedGroupMember(groupId, 'payer-user', payerMembershipDoc);
            db.seedGroupMember(groupId, 'payee-user', payeeMembershipDoc);

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
                .withAmount(0.01)
                .withCurrency('USD')
                .build();

            // Seed required data
            db.seedGroup(groupId, { name: 'Test Group' });
            db.initializeGroupBalance(groupId);
            db.seedUser('creator-user', { email: 'creator@test.com', displayName: 'Creator User' });
            db.seedUser('payer-user', { email: 'payer@test.com', displayName: 'Payer User' });
            db.seedUser('payee-user', { email: 'payee@test.com', displayName: 'Payee User' });

            // Set up group memberships
            const creatorMembershipDoc = new GroupMemberDocumentBuilder()
                .withUserId('creator-user')
                .withGroupId(groupId)
                .withRole('member')
                .withStatus('active')
                .buildDocument();
            const payerMembershipDoc = new GroupMemberDocumentBuilder()
                .withUserId('payer-user')
                .withGroupId(groupId)
                .withRole('member')
                .withStatus('active')
                .buildDocument();
            const payeeMembershipDoc = new GroupMemberDocumentBuilder()
                .withUserId('payee-user')
                .withGroupId(groupId)
                .withRole('member')
                .withStatus('active')
                .buildDocument();
            db.seedGroupMember(groupId, 'creator-user', creatorMembershipDoc);
            db.seedGroupMember(groupId, 'payer-user', payerMembershipDoc);
            db.seedGroupMember(groupId, 'payee-user', payeeMembershipDoc);

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

            // Seed required data
            db.seedGroup(groupId, { name: 'Test Group' });
            db.initializeGroupBalance(groupId);
            db.seedUser('creator-user', { email: 'creator@test.com', displayName: 'Creator User' });
            db.seedUser('payer-user', { email: 'payer@test.com', displayName: 'Payer User' });
            db.seedUser('payee-user', { email: 'payee@test.com', displayName: 'Payee User' });

            // Set up group memberships
            const creatorMembershipDoc = new GroupMemberDocumentBuilder()
                .withUserId('creator-user')
                .withGroupId(groupId)
                .withRole('member')
                .withStatus('active')
                .buildDocument();
            const payerMembershipDoc = new GroupMemberDocumentBuilder()
                .withUserId('payer-user')
                .withGroupId(groupId)
                .withRole('member')
                .withStatus('active')
                .buildDocument();
            const payeeMembershipDoc = new GroupMemberDocumentBuilder()
                .withUserId('payee-user')
                .withGroupId(groupId)
                .withRole('member')
                .withStatus('active')
                .buildDocument();
            db.seedGroupMember(groupId, 'creator-user', creatorMembershipDoc);
            db.seedGroupMember(groupId, 'payer-user', payerMembershipDoc);
            db.seedGroupMember(groupId, 'payee-user', payeeMembershipDoc);

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

            // Seed settlement
            const settlementData = {
                id: settlementId,
                groupId,
                payerId: 'payer-user',
                payeeId: 'payee-user',
                amount: 100,
                currency: 'USD',
                date: Timestamp.now(),
                note: 'Test settlement',
                createdBy: creatorId,
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
                deletedAt: null,
                deletedBy: null,
            };
            db.seedSettlement(settlementId, settlementData);

            // Set up group and membership
            db.seedGroup(groupId, { name: 'Test Group' });
            db.initializeGroupBalance(groupId);
            db.seedUser(creatorId, { email: `${creatorId}@test.com`, displayName: 'Creator User' });
            db.seedUser('payer-user', { email: 'payer@test.com', displayName: 'Payer User' });
            db.seedUser('payee-user', { email: 'payee@test.com', displayName: 'Payee User' });
            const creatorMembershipDoc = new GroupMemberDocumentBuilder()
                .withUserId(creatorId)
                .withGroupId(groupId)
                .withRole('member')
                .withStatus('active')
                .buildDocument();
            const payerMembershipDoc = new GroupMemberDocumentBuilder()
                .withUserId('payer-user')
                .withGroupId(groupId)
                .withRole('member')
                .withStatus('active')
                .buildDocument();
            const payeeMembershipDoc = new GroupMemberDocumentBuilder()
                .withUserId('payee-user')
                .withGroupId(groupId)
                .withRole('member')
                .withStatus('active')
                .buildDocument();
            db.seedGroupMember(groupId, creatorId, creatorMembershipDoc);
            db.seedGroupMember(groupId, 'payer-user', payerMembershipDoc);
            db.seedGroupMember(groupId, 'payee-user', payeeMembershipDoc);

            // Act & Assert - Should succeed without throwing
            await expect(settlementService.softDeleteSettlement(settlementId, creatorId)).resolves.toBeUndefined();
        });

        it('should prevent soft deleting already deleted settlement', async () => {
            // Arrange
            const settlementId = 'deleted-settlement-id';
            const creatorId = 'creator-user';
            const groupId = 'test-group';

            // Seed already-deleted settlement
            const deletedSettlementData = {
                id: settlementId,
                groupId,
                payerId: 'payer-user',
                payeeId: 'payee-user',
                amount: 100,
                currency: 'USD',
                date: Timestamp.now(),
                createdBy: creatorId,
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
                deletedAt: Timestamp.now(), // Already deleted
                deletedBy: creatorId,
            };
            db.seedSettlement(settlementId, deletedSettlementData);

            // Set up group and membership
            db.seedGroup(groupId, { name: 'Test Group' });
            db.seedUser(creatorId, { email: `${creatorId}@test.com`, displayName: 'Creator User' });
            const creatorMembershipDoc = new GroupMemberDocumentBuilder()
                .withUserId(creatorId)
                .withGroupId(groupId)
                .withRole('member')
                .withStatus('active')
                .buildDocument();
            db.seedGroupMember(groupId, creatorId, creatorMembershipDoc);

            // Act & Assert
            // Soft-deleted settlements are filtered out by FirestoreReader, so we get NOT_FOUND
            await expect(settlementService.softDeleteSettlement(settlementId, creatorId)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.NOT_FOUND,
                    code: 'SETTLEMENT_NOT_FOUND',
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
                date: Timestamp.now(),
                createdBy: creatorId,
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
                deletedAt: null,
                deletedBy: null,
            };
            db.seedSettlement(settlementId, settlementData);

            db.seedGroup(groupId, { name: 'Test Group' });
            db.initializeGroupBalance(groupId);
            db.seedUser(creatorId, { email: `${creatorId}@test.com`, displayName: 'Creator User' });
            db.seedUser('payer-user', { email: 'payer@test.com', displayName: 'Payer User' });
            db.seedUser('payee-user', { email: 'payee@test.com', displayName: 'Payee User' });
            const creatorMembershipDoc = new GroupMemberDocumentBuilder()
                .withUserId(creatorId)
                .withGroupId(groupId)
                .withRole('member')
                .withStatus('active')
                .buildDocument();
            const payerMembershipDoc = new GroupMemberDocumentBuilder()
                .withUserId('payer-user')
                .withGroupId(groupId)
                .withRole('member')
                .withStatus('active')
                .buildDocument();
            const payeeMembershipDoc = new GroupMemberDocumentBuilder()
                .withUserId('payee-user')
                .withGroupId(groupId)
                .withRole('member')
                .withStatus('active')
                .buildDocument();
            db.seedGroupMember(groupId, creatorId, creatorMembershipDoc);
            db.seedGroupMember(groupId, 'payer-user', payerMembershipDoc);
            db.seedGroupMember(groupId, 'payee-user', payeeMembershipDoc);

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
                date: Timestamp.now(),
                createdBy: creatorId, // Different from admin
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
                deletedAt: null,
                deletedBy: null,
            };
            db.seedSettlement(settlementId, settlementData);

            db.seedGroup(groupId, { name: 'Test Group' });
            db.initializeGroupBalance(groupId);
            db.seedUser(adminId, { email: `${adminId}@test.com`, displayName: 'Admin User' });
            db.seedUser(creatorId, { email: `${creatorId}@test.com`, displayName: 'Creator User' });
            db.seedUser('payer-user', { email: 'payer@test.com', displayName: 'Payer User' });
            db.seedUser('payee-user', { email: 'payee@test.com', displayName: 'Payee User' });
            const adminMembershipDoc = new GroupMemberDocumentBuilder()
                .withUserId(adminId)
                .withGroupId(groupId)
                .withRole('admin') // Admin role
                .withStatus('active')
                .buildDocument();
            const creatorMembershipDoc = new GroupMemberDocumentBuilder()
                .withUserId(creatorId)
                .withGroupId(groupId)
                .withRole('member')
                .withStatus('active')
                .buildDocument();
            const payerMembershipDoc = new GroupMemberDocumentBuilder()
                .withUserId('payer-user')
                .withGroupId(groupId)
                .withRole('member')
                .withStatus('active')
                .buildDocument();
            const payeeMembershipDoc = new GroupMemberDocumentBuilder()
                .withUserId('payee-user')
                .withGroupId(groupId)
                .withRole('member')
                .withStatus('active')
                .buildDocument();
            db.seedGroupMember(groupId, adminId, adminMembershipDoc);
            db.seedGroupMember(groupId, creatorId, creatorMembershipDoc);
            db.seedGroupMember(groupId, 'payer-user', payerMembershipDoc);
            db.seedGroupMember(groupId, 'payee-user', payeeMembershipDoc);

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
                date: Timestamp.now(),
                createdBy: creatorId,
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
                deletedAt: null,
                deletedBy: null,
            };
            db.seedSettlement(settlementId, settlementData);

            db.seedGroup(groupId, { name: 'Test Group' });
            db.initializeGroupBalance(groupId);
            const otherMembershipDoc = new GroupMemberDocumentBuilder()
                .withUserId(otherId)
                .withGroupId(groupId)
                .withRole('member') // Regular member, not creator or admin
                .withStatus('active')
                .buildDocument();
            db.seedGroupMember(groupId, otherId, otherMembershipDoc);

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

            // Don't seed settlement data (simulating non-existent settlement)

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
                date: Timestamp.now(),
                createdBy: creatorId,
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
                deletedAt: null,
                deletedBy: null,
            };
            db.seedSettlement(settlementId, settlementData);

            db.seedGroup(groupId, { name: 'Test Group' });

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
