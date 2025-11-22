import { StubStorage } from '@billsplit-wl/test-support';
import { toGroupId, toSettlementId, toUserId } from '@billsplit-wl/shared';
import { TenantFirestoreTestDatabase } from '@billsplit-wl/test-support';
import { ClientUserBuilder, CreateSettlementRequestBuilder, GroupMemberDocumentBuilder, SettlementDocumentBuilder } from '@billsplit-wl/test-support';
import { Timestamp } from '@google-cloud/firestore';
import { beforeEach, describe, expect, it } from 'vitest';
import { HTTP_STATUS } from '../../../constants';
import { ComponentBuilder } from '../../../services/ComponentBuilder';
import { SettlementService } from '../../../services/SettlementService';
import { StubAuthService } from '../mocks/StubAuthService';


describe('SettlementService - Unit Tests', () => {
    let settlementService: SettlementService;
    let db: TenantFirestoreTestDatabase;
    let stubAuth: StubAuthService;

    const creatorUser = toUserId('creator-user');
    const adminUser = toUserId('admin-user');
    const otherUser = toUserId('other-user');

    const seedUser = (userId: string, overrides: Record<string, any> = {}) => {
        const user = db.seedUser(userId, overrides);

        const { role: _, photoURL: __, ...userData } = new ClientUserBuilder()
            .withUid(userId)
            .withEmail(user.email)
            .withDisplayName(overrides.displayName ?? user.displayName)
            .build();
        stubAuth.setUser(userId, userData);

        return user;
    };

    beforeEach(() => {
        // Create stub database
        db = new TenantFirestoreTestDatabase();
        stubAuth = new StubAuthService();

        const applicationBuilder = new ComponentBuilder(stubAuth, db, new StubStorage({ defaultBucketName: 'test-bucket' }));
        settlementService = applicationBuilder.buildSettlementService();
    });

    describe('Settlement Creation Validation', () => {
        it('should validate settlement amounts correctly', async () => {
            // Arrange
            const userId = creatorUser;
            const groupId = toGroupId('test-group');
            const validSettlementData = new CreateSettlementRequestBuilder()
                .withGroupId(groupId)
                .withPayerId('payer-user')
                .withPayeeId('payee-user')
                .withAmount(100.5, 'USD')
                .withNote('Test settlement')
                .build();

            // Seed required data
            db.seedGroup(groupId, { name: 'Test Group' });
            db.initializeGroupBalance(groupId);
            seedUser(creatorUser, { email: 'creator@test.com', displayName: 'Creator User' });
            seedUser('payer-user', { email: 'payer@test.com', displayName: 'Payer User' });
            seedUser('payee-user', { email: 'payee@test.com', displayName: 'Payee User' });

            // Set up group memberships for all users (creator, payer, payee)
            const creatorMembershipDoc = new GroupMemberDocumentBuilder()
                .withUserId(creatorUser)
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
            db.seedGroupMember(groupId, creatorUser, creatorMembershipDoc);
            db.seedGroupMember(groupId, 'payer-user', payerMembershipDoc);
            db.seedGroupMember(groupId, 'payee-user', payeeMembershipDoc);

            // Act
            const result = await settlementService.createSettlement(validSettlementData, userId);

            // Assert
            expect(result.id).toBeDefined();
            expect(result.amount).toBe('100.5');
            expect(result.currency).toBe('USD');
            expect(result.note).toBe('Test settlement');
        });

        it('should handle optional note field correctly', async () => {
            // Arrange
            const userId = creatorUser;
            const groupId = toGroupId('test-group');
            const settlementDataWithoutNote = new CreateSettlementRequestBuilder()
                .withGroupId(groupId)
                .withPayerId('payer-user')
                .withPayeeId('payee-user')
                .withAmount(50.0, 'USD')
                .withoutNote()
                .build();

            // Seed required data
            db.seedGroup(groupId, { name: 'Test Group' });
            db.initializeGroupBalance(groupId);
            seedUser(creatorUser, { email: 'creator@test.com', displayName: 'Creator User' });
            seedUser('payer-user', { email: 'payer@test.com', displayName: 'Payer User' });
            seedUser('payee-user', { email: 'payee@test.com', displayName: 'Payee User' });

            // Set up group memberships
            const creatorMembershipDoc = new GroupMemberDocumentBuilder()
                .withUserId(creatorUser)
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
            db.seedGroupMember(groupId, creatorUser, creatorMembershipDoc);
            db.seedGroupMember(groupId, 'payer-user', payerMembershipDoc);
            db.seedGroupMember(groupId, 'payee-user', payeeMembershipDoc);

            // Act
            const result = await settlementService.createSettlement(settlementDataWithoutNote, userId);

            // Assert
            expect(result.id).toBeDefined();
            expect(result.amount).toBe('50');
            expect(result.note).toBeUndefined();
        });
    });

    describe('User Data Validation', () => {
        it('should validate user data with complete required fields', async () => {
            // Arrange
            const userId = creatorUser;
            const groupId = toGroupId('test-group');
            const settlementData = new CreateSettlementRequestBuilder()
                .withGroupId(groupId)
                .withPayerId('valid-payer')
                .withPayeeId('valid-payee')
                .build();

            // Seed valid user data
            seedUser(creatorUser, { email: 'creator@test.com', displayName: 'Creator User' });
            seedUser('valid-payer', {
                email: 'payer@example.com',
                displayName: 'Valid Payer',
                otherField: 'should be preserved',
            });
            seedUser('valid-payee', {
                email: 'payee@example.com',
                displayName: 'Valid Payee',
            });

            // Seed other dependencies
            db.seedGroup(groupId, { name: 'Test Group' });
            db.initializeGroupBalance(groupId);

            // Set up group memberships
            const creatorMembershipDoc = new GroupMemberDocumentBuilder()
                .withUserId(creatorUser)
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
            db.seedGroupMember(groupId, creatorUser, creatorMembershipDoc);
            db.seedGroupMember(groupId, 'valid-payer', payerMembershipDoc);
            db.seedGroupMember(groupId, 'valid-payee', payeeMembershipDoc);

            // Act & Assert - Should not throw
            await expect(settlementService.createSettlement(settlementData, userId)).resolves.toBeDefined();
        });

        it('should handle user data validation during settlement creation', async () => {
            // Arrange
            const userId = creatorUser;
            const groupId = toGroupId('test-group');
            const settlementData = new CreateSettlementRequestBuilder()
                .withGroupId(groupId)
                .withPayerId('payer-user')
                .withPayeeId('payee-user')
                .build();

            // Seed basic setup
            db.seedGroup(groupId, { name: 'Test Group' });
            db.initializeGroupBalance(groupId);
            seedUser(creatorUser, { email: 'creator@test.com', displayName: 'Creator User' });
            seedUser('payer-user', { email: 'payer@test.com', displayName: 'Payer User' });
            seedUser('payee-user', { email: 'payee@test.com', displayName: 'Payee User' });

            // Set up group memberships
            const creatorMembershipDoc = new GroupMemberDocumentBuilder()
                .withUserId(creatorUser)
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
            db.seedGroupMember(groupId, creatorUser, creatorMembershipDoc);
            db.seedGroupMember(groupId, 'payer-user', payerMembershipDoc);
            db.seedGroupMember(groupId, 'payee-user', payeeMembershipDoc);

            // Act & Assert - Should succeed
            await expect(settlementService.createSettlement(settlementData, userId)).resolves.toBeDefined();
        });
    });

    describe('Group Membership Validation', () => {
        it('should validate group membership for all users', async () => {
            // Arrange
            const userId = creatorUser;
            const groupId = toGroupId('test-group');
            const settlementData = new CreateSettlementRequestBuilder()
                .withGroupId(groupId)
                .withPayerId('payer-user')
                .withPayeeId('payee-user')
                .build();

            // Seed valid data
            db.seedGroup(groupId, { name: 'Test Group' });
            db.initializeGroupBalance(groupId);
            seedUser(creatorUser, { email: 'creator@test.com', displayName: 'Creator User' });
            seedUser('payer-user', { email: 'payer@test.com', displayName: 'Payer User' });
            seedUser('payee-user', { email: 'payee@test.com', displayName: 'Payee User' });

            // Set up group memberships for all users
            const creatorMembershipDoc = new GroupMemberDocumentBuilder()
                .withUserId(creatorUser)
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
            db.seedGroupMember(groupId, creatorUser, creatorMembershipDoc);
            db.seedGroupMember(groupId, 'payer-user', payerMembershipDoc);
            db.seedGroupMember(groupId, 'payee-user', payeeMembershipDoc);

            // Act & Assert - Should succeed
            await expect(settlementService.createSettlement(settlementData, userId)).resolves.toBeDefined();
        });

        it('should reject settlement when payer is not group member', async () => {
            // Arrange
            const userId = creatorUser;
            const groupId = toGroupId('test-group');
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
                .withUserId(creatorUser)
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
            db.seedGroupMember(groupId, creatorUser, creatorMembershipDoc);
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
            const userId = creatorUser;
            const groupId = toGroupId('test-group');
            const settlementData = new CreateSettlementRequestBuilder()
                .withGroupId(groupId)
                .withPayerId('payer-user')
                .withPayeeId('non-member-payee')
                .withAmount(100, 'USD')
                .withDate(new Date().toISOString())
                .build();

            // Seed group data
            db.seedGroup(groupId, { name: 'Test Group' });
            db.initializeGroupBalance(groupId);

            // Set up group memberships - creator and payer are members, payee is not
            const creatorMembershipDoc = new GroupMemberDocumentBuilder()
                .withUserId(creatorUser)
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
            db.seedGroupMember(groupId, creatorUser, creatorMembershipDoc);
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
            const userId = creatorUser;
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
            const userId = creatorUser;
            const groupId = toGroupId('test-group');
            const settlementData = new CreateSettlementRequestBuilder()
                .withGroupId(groupId)
                .withPayerId('payer-user')
                .withPayeeId('payee-user')
                .withAmount(123.45, 'USD')
                .build();

            // Seed required data
            db.seedGroup(groupId, { name: 'Test Group' });
            db.initializeGroupBalance(groupId);
            seedUser(creatorUser, { email: 'creator@test.com', displayName: 'Creator User' });
            seedUser('payer-user', { email: 'payer@test.com', displayName: 'Payer User' });
            seedUser('payee-user', { email: 'payee@test.com', displayName: 'Payee User' });

            // Set up group memberships
            const creatorMembershipDoc = new GroupMemberDocumentBuilder()
                .withUserId(creatorUser)
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
            db.seedGroupMember(groupId, creatorUser, creatorMembershipDoc);
            db.seedGroupMember(groupId, 'payer-user', payerMembershipDoc);
            db.seedGroupMember(groupId, 'payee-user', payeeMembershipDoc);

            // Act
            const result = await settlementService.createSettlement(settlementData, userId);

            // Assert
            expect(result.amount).toBe('123.45');
        });

        it('should handle maximum valid amount', async () => {
            // Arrange
            const userId = creatorUser;
            const groupId = toGroupId('test-group');
            const settlementData = new CreateSettlementRequestBuilder()
                .withGroupId(groupId)
                .withPayerId('payer-user')
                .withPayeeId('payee-user')
                .withAmount(999999.99, 'USD')
                .build();

            // Seed required data
            db.seedGroup(groupId, { name: 'Test Group' });
            db.initializeGroupBalance(groupId);
            seedUser(creatorUser, { email: 'creator@test.com', displayName: 'Creator User' });
            seedUser('payer-user', { email: 'payer@test.com', displayName: 'Payer User' });
            seedUser('payee-user', { email: 'payee@test.com', displayName: 'Payee User' });

            // Set up group memberships
            const creatorMembershipDoc = new GroupMemberDocumentBuilder()
                .withUserId(creatorUser)
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
            db.seedGroupMember(groupId, creatorUser, creatorMembershipDoc);
            db.seedGroupMember(groupId, 'payer-user', payerMembershipDoc);
            db.seedGroupMember(groupId, 'payee-user', payeeMembershipDoc);

            // Act & Assert - Should succeed
            await expect(settlementService.createSettlement(settlementData, userId)).resolves.toBeDefined();
        });

        it('should handle minimum valid amount', async () => {
            // Arrange
            const userId = creatorUser;
            const groupId = toGroupId('test-group');
            const settlementData = new CreateSettlementRequestBuilder()
                .withGroupId(groupId)
                .withPayerId('payer-user')
                .withPayeeId('payee-user')
                .withAmount(0.01, 'USD')
                .build();

            // Seed required data
            db.seedGroup(groupId, { name: 'Test Group' });
            db.initializeGroupBalance(groupId);
            seedUser(creatorUser, { email: 'creator@test.com', displayName: 'Creator User' });
            seedUser('payer-user', { email: 'payer@test.com', displayName: 'Payer User' });
            seedUser('payee-user', { email: 'payee@test.com', displayName: 'Payee User' });

            // Set up group memberships
            const creatorMembershipDoc = new GroupMemberDocumentBuilder()
                .withUserId(creatorUser)
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
            db.seedGroupMember(groupId, creatorUser, creatorMembershipDoc);
            db.seedGroupMember(groupId, 'payer-user', payerMembershipDoc);
            db.seedGroupMember(groupId, 'payee-user', payeeMembershipDoc);

            // Act & Assert - Should succeed
            await expect(settlementService.createSettlement(settlementData, userId)).resolves.toBeDefined();
        });
    });

    describe('Soft Delete Functionality', () => {
        it('should initialize new settlements with deletedAt and deletedBy as null', async () => {
            // Arrange
            const userId = creatorUser;
            const groupId = toGroupId('test-group');
            const settlementData = new CreateSettlementRequestBuilder()
                .withGroupId(groupId)
                .withPayerId('payer-user')
                .withPayeeId('payee-user')
                .build();

            // Seed required data
            db.seedGroup(groupId, { name: 'Test Group' });
            db.initializeGroupBalance(groupId);
            seedUser(creatorUser, { email: 'creator@test.com', displayName: 'Creator User' });
            seedUser('payer-user', { email: 'payer@test.com', displayName: 'Payer User' });
            seedUser('payee-user', { email: 'payee@test.com', displayName: 'Payee User' });

            // Set up group memberships
            const creatorMembershipDoc = new GroupMemberDocumentBuilder()
                .withUserId(creatorUser)
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
            db.seedGroupMember(groupId, creatorUser, creatorMembershipDoc);
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
            const settlementId = toSettlementId('test-settlement-id');
            const creatorId = creatorUser;
            const groupId = toGroupId('test-group');

            // Seed settlement
            const settlementData = new SettlementDocumentBuilder()
                .withId(settlementId)
                .withGroupId(groupId)
                .withPayerId('payer-user')
                .withPayeeId('payee-user')
                .withAmount(100, 'USD')
                .withNote('Test settlement')
                .withCreatedBy(creatorId)
                .withCreatedAt(Timestamp.now().toDate())
                .withUpdatedAt(Timestamp.now().toDate())
                .withDeletedAt(null)
                .withDeletedBy(null)
                .build();
            db.seedSettlement(settlementId, settlementData);

            // Set up group and membership
            db.seedGroup(groupId, { name: 'Test Group' });
            db.initializeGroupBalance(groupId);
            seedUser(creatorId, { email: `${creatorId}@test.com`, displayName: 'Creator User' });
            seedUser('payer-user', { email: 'payer@test.com', displayName: 'Payer User' });
            seedUser('payee-user', { email: 'payee@test.com', displayName: 'Payee User' });
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
            const settlementId = toSettlementId('deleted-settlement-id');
            const creatorId = creatorUser;
            const groupId = toGroupId('test-group');

            // Seed already-deleted settlement
            const deletedSettlementData = new SettlementDocumentBuilder()
                .withId(settlementId)
                .withGroupId(groupId)
                .withPayerId('payer-user')
                .withPayeeId('payee-user')
                .withAmount(100, 'USD')
                .withCreatedBy(creatorId)
                .withCreatedAt(Timestamp.now().toDate())
                .withUpdatedAt(Timestamp.now().toDate())
                .withDeletedAt(Timestamp.now().toDate())
                .withDeletedBy(creatorId)
                .build();
            db.seedSettlement(settlementId, deletedSettlementData);

            // Set up group and membership
            db.seedGroup(groupId, { name: 'Test Group' });
            seedUser(creatorId, { email: `${creatorId}@test.com`, displayName: 'Creator User' });
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
            const settlementId = toSettlementId('test-settlement-id');
            const creatorId = creatorUser;
            const groupId = toGroupId('test-group');

            const settlementData = new SettlementDocumentBuilder()
                .withId(settlementId)
                .withGroupId(groupId)
                .withPayerId('payer-user')
                .withPayeeId('payee-user')
                .withAmount(100, 'USD')
                .withCreatedBy(creatorId)
                .withCreatedAt(Timestamp.now().toDate())
                .withUpdatedAt(Timestamp.now().toDate())
                .withDeletedAt(null)
                .withDeletedBy(null)
                .build();
            db.seedSettlement(settlementId, settlementData);

            db.seedGroup(groupId, { name: 'Test Group' });
            db.initializeGroupBalance(groupId);
            seedUser(creatorId, { email: `${creatorId}@test.com`, displayName: 'Creator User' });
            seedUser('payer-user', { email: 'payer@test.com', displayName: 'Payer User' });
            seedUser('payee-user', { email: 'payee@test.com', displayName: 'Payee User' });
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
            const settlementId = toSettlementId('test-settlement-id');
            const creatorId = creatorUser;
            const adminId = adminUser;
            const groupId = toGroupId('test-group');

            const settlementData = new SettlementDocumentBuilder()
                .withId(settlementId)
                .withGroupId(groupId)
                .withPayerId('payer-user')
                .withPayeeId('payee-user')
                .withAmount(100, 'USD')
                .withCreatedBy(creatorId)
                .withCreatedAt(Timestamp.now().toDate())
                .withUpdatedAt(Timestamp.now().toDate())
                .withDeletedAt(null)
                .withDeletedBy(null)
                .build();
            db.seedSettlement(settlementId, settlementData);

            db.seedGroup(groupId, { name: 'Test Group' });
            db.initializeGroupBalance(groupId);
            seedUser(adminId, { email: `${adminId}@test.com`, displayName: 'Admin User' });
            seedUser(creatorId, { email: `${creatorId}@test.com`, displayName: 'Creator User' });
            seedUser('payer-user', { email: 'payer@test.com', displayName: 'Payer User' });
            seedUser('payee-user', { email: 'payee@test.com', displayName: 'Payee User' });
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
            const settlementId = toSettlementId('test-settlement-id');
            const creatorId = creatorUser;
            const otherId = otherUser;
            const groupId = toGroupId('test-group');

            const settlementData = new SettlementDocumentBuilder()
                .withId(settlementId)
                .withGroupId(groupId)
                .withPayerId('payer-user')
                .withPayeeId('payee-user')
                .withAmount(100, 'USD')
                .withCreatedBy(creatorId)
                .withCreatedAt(Timestamp.now().toDate())
                .withUpdatedAt(Timestamp.now().toDate())
                .withDeletedAt(null)
                .withDeletedBy(null)
                .build();
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
            const settlementId = toSettlementId('non-existent-settlement-id');

            // Don't seed settlement data (simulating non-existent settlement)

            // Act & Assert
            await expect(settlementService.softDeleteSettlement(settlementId, creatorUser)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.NOT_FOUND,
                    code: 'SETTLEMENT_NOT_FOUND',
                }),
            );
        });

        it('should prevent soft deleting settlement when user not in group', async () => {
            // Arrange
            const settlementId = toSettlementId('test-settlement-id');
            const creatorId = creatorUser;
            const nonMemberId = toUserId('non-member-user');
            const groupId = toGroupId('test-group');

            const settlementData = new SettlementDocumentBuilder()
                .withId(settlementId)
                .withGroupId(groupId)
                .withPayerId('payer-user')
                .withPayeeId('payee-user')
                .withAmount(100, 'USD')
                .withCreatedBy(creatorId)
                .withCreatedAt(Timestamp.now().toDate())
                .withUpdatedAt(Timestamp.now().toDate())
                .withDeletedAt(null)
                .withDeletedBy(null)
                .build();
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
