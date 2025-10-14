// @ts-nocheck - Type incompatibility between test stubs and production types due to duplicate @types/express
import type { UpdateSettlementRequest } from '@splitifyd/shared';
import { CreateSettlementRequestBuilder, createStubRequest, createStubResponse, StubFirestoreDatabase } from '@splitifyd/test-support';
import { beforeEach, describe, expect, it } from 'vitest';
import type { AuthenticatedRequest } from '../../../auth/middleware';
import { HTTP_STATUS } from '../../../constants';
import { ApplicationBuilder } from '../../../services/ApplicationBuilder';
import { FirestoreReader } from '../../../services/firestore/FirestoreReader';
import { FirestoreWriter } from '../../../services/firestore/FirestoreWriter';
import { SettlementHandlers } from '../../../settlements/SettlementHandlers';
import { GroupMemberDocumentBuilder } from '../../support/GroupMemberDocumentBuilder';
import { StubAuthService } from '../mocks/firestore-stubs';

describe('SettlementHandlers - Unit Tests', () => {
    let settlementHandlers: SettlementHandlers;
    let db: StubFirestoreDatabase;
    let stubAuth: StubAuthService;

    beforeEach(() => {
        db = new StubFirestoreDatabase();
        stubAuth = new StubAuthService();

        const firestoreReader = new FirestoreReader(db);
        const firestoreWriter = new FirestoreWriter(db);
        const applicationBuilder = new ApplicationBuilder(firestoreReader, firestoreWriter, stubAuth);

        settlementHandlers = new SettlementHandlers(applicationBuilder.buildSettlementService());
    });

    describe('createSettlement', () => {
        it('should create a settlement successfully with valid data', async () => {
            const groupId = 'test-group';
            const userId = 'test-user';

            db.seedUser(userId, { displayName: 'Test User' });
            db.seedUser('payer-user', { displayName: 'Payer' });
            db.seedUser('payee-user', { displayName: 'Payee' });
            db.seedGroup(groupId, { name: 'Test Group', createdBy: userId });
            db.initializeGroupBalance(groupId);

            const creatorMembership = new GroupMemberDocumentBuilder()
                .withUserId(userId)
                .withGroupId(groupId)
                .withRole('member')
                .withStatus('active')
                .buildDocument();
            const payerMembership = new GroupMemberDocumentBuilder()
                .withUserId('payer-user')
                .withGroupId(groupId)
                .withRole('member')
                .withStatus('active')
                .buildDocument();
            const payeeMembership = new GroupMemberDocumentBuilder()
                .withUserId('payee-user')
                .withGroupId(groupId)
                .withRole('member')
                .withStatus('active')
                .buildDocument();

            db.seedGroupMember(groupId, userId, creatorMembership);
            db.seedGroupMember(groupId, 'payer-user', payerMembership);
            db.seedGroupMember(groupId, 'payee-user', payeeMembership);

            const settlementRequest = new CreateSettlementRequestBuilder()
                .withGroupId(groupId)
                .withPayerId('payer-user')
                .withPayeeId('payee-user')
                .withAmount(100.50)
                .withCurrency('USD')
                .withNote('Test settlement')
                .build();

            const req = createStubRequest(userId, settlementRequest) as AuthenticatedRequest;
            const res = createStubResponse();

            await settlementHandlers.createSettlement(req, res);

            expect((res as any).getStatus()).toBe(HTTP_STATUS.CREATED);
            const json = (res as any).getJson();
            expect(json).toMatchObject({
                success: true,
                data: expect.objectContaining({
                    id: expect.any(String),
                    groupId,
                    payerId: 'payer-user',
                    payeeId: 'payee-user',
                    amount: 100.50,
                    currency: 'USD',
                    note: 'Test settlement',
                }),
            });
        });

        it('should create a settlement without optional note', async () => {
            const groupId = 'test-group';
            const userId = 'test-user';

            db.seedUser(userId, { displayName: 'Test User' });
            db.seedUser('payer-user', { displayName: 'Payer' });
            db.seedUser('payee-user', { displayName: 'Payee' });
            db.seedGroup(groupId, { name: 'Test Group', createdBy: userId });
            db.initializeGroupBalance(groupId);

            const creatorMembership = new GroupMemberDocumentBuilder()
                .withUserId(userId)
                .withGroupId(groupId)
                .withRole('member')
                .withStatus('active')
                .buildDocument();
            const payerMembership = new GroupMemberDocumentBuilder()
                .withUserId('payer-user')
                .withGroupId(groupId)
                .withRole('member')
                .withStatus('active')
                .buildDocument();
            const payeeMembership = new GroupMemberDocumentBuilder()
                .withUserId('payee-user')
                .withGroupId(groupId)
                .withRole('member')
                .withStatus('active')
                .buildDocument();

            db.seedGroupMember(groupId, userId, creatorMembership);
            db.seedGroupMember(groupId, 'payer-user', payerMembership);
            db.seedGroupMember(groupId, 'payee-user', payeeMembership);

            const settlementRequest = new CreateSettlementRequestBuilder()
                .withGroupId(groupId)
                .withPayerId('payer-user')
                .withPayeeId('payee-user')
                .withAmount(50.00)
                .withCurrency('USD')
                .withoutNote()
                .build();

            const req = createStubRequest(userId, settlementRequest) as AuthenticatedRequest;
            const res = createStubResponse();

            await settlementHandlers.createSettlement(req, res);

            expect((res as any).getStatus()).toBe(HTTP_STATUS.CREATED);
            const json = (res as any).getJson();
            expect(json).toMatchObject({
                success: true,
                data: expect.objectContaining({
                    amount: 50.00,
                }),
            });
            // Verify note field is not present or is undefined
            expect(json.data.note).toBeUndefined();
        });

        it('should reject settlement with invalid amount (zero)', async () => {
            const invalidRequest = new CreateSettlementRequestBuilder()
                .withGroupId('test-group')
                .withPayerId('payer')
                .withPayeeId('payee')
                .withAmount(0)
                .withCurrency('USD')
                .build();

            const req = createStubRequest('test-user', invalidRequest) as AuthenticatedRequest;
            const res = createStubResponse();

            await expect(settlementHandlers.createSettlement(req, res)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'VALIDATION_ERROR',
                }),
            );
        });

        it('should reject settlement with negative amount', async () => {
            const invalidRequest = new CreateSettlementRequestBuilder()
                .withGroupId('test-group')
                .withPayerId('payer')
                .withPayeeId('payee')
                .withAmount(-50)
                .withCurrency('USD')
                .build();

            const req = createStubRequest('test-user', invalidRequest) as AuthenticatedRequest;
            const res = createStubResponse();

            await expect(settlementHandlers.createSettlement(req, res)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'VALIDATION_ERROR',
                }),
            );
        });

        it('should reject settlement with same payer and payee', async () => {
            const invalidRequest = new CreateSettlementRequestBuilder()
                .withGroupId('test-group')
                .withPayerId('same-user')
                .withPayeeId('same-user')
                .withAmount(100)
                .withCurrency('USD')
                .build();

            const req = createStubRequest('test-user', invalidRequest) as AuthenticatedRequest;
            const res = createStubResponse();

            await expect(settlementHandlers.createSettlement(req, res)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'VALIDATION_ERROR',
                }),
            );
        });

        it('should reject settlement with invalid currency code', async () => {
            const invalidRequest = new CreateSettlementRequestBuilder()
                .withGroupId('test-group')
                .withPayerId('payer')
                .withPayeeId('payee')
                .withAmount(100)
                .build();

            (invalidRequest as any).currency = 'US';

            const req = createStubRequest('test-user', invalidRequest) as AuthenticatedRequest;
            const res = createStubResponse();

            await expect(settlementHandlers.createSettlement(req, res)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'VALIDATION_ERROR',
                }),
            );
        });

        it('should reject settlement with excessive amount precision for JPY', async () => {
            const invalidRequest = new CreateSettlementRequestBuilder()
                .withGroupId('test-group')
                .withPayerId('payer')
                .withPayeeId('payee')
                .withAmount(100.50)
                .withCurrency('JPY')
                .build();

            const req = createStubRequest('test-user', invalidRequest) as AuthenticatedRequest;
            const res = createStubResponse();

            await expect(settlementHandlers.createSettlement(req, res)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'VALIDATION_ERROR',
                }),
            );
        });

        it('should reject settlement with excessively long note', async () => {
            const longNote = 'a'.repeat(501);
            const invalidRequest = new CreateSettlementRequestBuilder()
                .withGroupId('test-group')
                .withPayerId('payer')
                .withPayeeId('payee')
                .withAmount(100)
                .withCurrency('USD')
                .withNote(longNote)
                .build();

            const req = createStubRequest('test-user', invalidRequest) as AuthenticatedRequest;
            const res = createStubResponse();

            await expect(settlementHandlers.createSettlement(req, res)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'VALIDATION_ERROR',
                }),
            );
        });
    });

    describe('updateSettlement', () => {
        it('should update settlement amount successfully', async () => {
            const groupId = 'test-group';
            const userId = 'test-user';
            const settlementId = 'test-settlement';

            db.seedUser(userId, { displayName: 'Test User' });
            db.seedUser('payer-user', { displayName: 'Payer' });
            db.seedUser('payee-user', { displayName: 'Payee' });
            db.seedGroup(groupId, { name: 'Test Group', createdBy: userId });
            db.initializeGroupBalance(groupId);

            db.seedSettlement(settlementId, {
                id: settlementId,
                groupId,
                payerId: 'payer-user',
                payeeId: 'payee-user',
                amount: 100,
                currency: 'USD',
                date: new Date().toISOString(),
                createdBy: userId,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                deletedAt: null,
                deletedBy: null,
            });

            const creatorMembership = new GroupMemberDocumentBuilder()
                .withUserId(userId)
                .withGroupId(groupId)
                .withRole('member')
                .withStatus('active')
                .buildDocument();
            const payerMembership = new GroupMemberDocumentBuilder()
                .withUserId('payer-user')
                .withGroupId(groupId)
                .withRole('member')
                .withStatus('active')
                .buildDocument();
            const payeeMembership = new GroupMemberDocumentBuilder()
                .withUserId('payee-user')
                .withGroupId(groupId)
                .withRole('member')
                .withStatus('active')
                .buildDocument();

            db.seedGroupMember(groupId, userId, creatorMembership);
            db.seedGroupMember(groupId, 'payer-user', payerMembership);
            db.seedGroupMember(groupId, 'payee-user', payeeMembership);

            const updateRequest: UpdateSettlementRequest = {
                amount: 150.75,
                currency: 'USD',
            };

            const req = createStubRequest(userId, updateRequest, { settlementId }) as AuthenticatedRequest;
            const res = createStubResponse();

            await settlementHandlers.updateSettlement(req, res);

            expect((res as any).getStatus()).toBe(HTTP_STATUS.OK);
            const json = (res as any).getJson();
            expect(json).toMatchObject({
                success: true,
                data: expect.objectContaining({
                    id: settlementId,
                    amount: 150.75,
                }),
            });
        });

        it('should update settlement note successfully', async () => {
            const groupId = 'test-group';
            const userId = 'test-user';
            const settlementId = 'test-settlement';

            db.seedUser(userId, { displayName: 'Test User' });
            db.seedUser('payer-user', { displayName: 'Payer' });
            db.seedUser('payee-user', { displayName: 'Payee' });
            db.seedGroup(groupId, { name: 'Test Group', createdBy: userId });
            db.initializeGroupBalance(groupId);

            db.seedSettlement(settlementId, {
                id: settlementId,
                groupId,
                payerId: 'payer-user',
                payeeId: 'payee-user',
                amount: 100,
                currency: 'USD',
                date: new Date().toISOString(),
                note: 'Old note',
                createdBy: userId,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                deletedAt: null,
                deletedBy: null,
            });

            const creatorMembership = new GroupMemberDocumentBuilder()
                .withUserId(userId)
                .withGroupId(groupId)
                .withRole('member')
                .withStatus('active')
                .buildDocument();
            const payerMembership = new GroupMemberDocumentBuilder()
                .withUserId('payer-user')
                .withGroupId(groupId)
                .withRole('member')
                .withStatus('active')
                .buildDocument();
            const payeeMembership = new GroupMemberDocumentBuilder()
                .withUserId('payee-user')
                .withGroupId(groupId)
                .withRole('member')
                .withStatus('active')
                .buildDocument();

            db.seedGroupMember(groupId, userId, creatorMembership);
            db.seedGroupMember(groupId, 'payer-user', payerMembership);
            db.seedGroupMember(groupId, 'payee-user', payeeMembership);

            const updateRequest: UpdateSettlementRequest = {
                note: 'Updated note',
            };

            const req = createStubRequest(userId, updateRequest, { settlementId }) as AuthenticatedRequest;
            const res = createStubResponse();

            await settlementHandlers.updateSettlement(req, res);

            expect((res as any).getStatus()).toBe(HTTP_STATUS.OK);
            const json = (res as any).getJson();
            expect(json).toMatchObject({
                success: true,
                data: expect.objectContaining({
                    id: settlementId,
                    note: 'Updated note',
                }),
            });
        });

        it('should reject update with invalid settlement ID', async () => {
            const updateRequest: UpdateSettlementRequest = { amount: 150 };
            const req = createStubRequest('test-user', updateRequest, { settlementId: '' }) as AuthenticatedRequest;
            const res = createStubResponse();

            await expect(settlementHandlers.updateSettlement(req, res)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'INVALID_SETTLEMENT_ID',
                }),
            );
        });

        it('should reject update with no fields provided', async () => {
            const updateRequest = {};
            const req = createStubRequest('test-user', updateRequest, { settlementId: 'test-settlement' }) as AuthenticatedRequest;
            const res = createStubResponse();

            await expect(settlementHandlers.updateSettlement(req, res)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'VALIDATION_ERROR',
                }),
            );
        });

        it('should reject update with invalid amount precision when currency provided', async () => {
            const updateRequest: UpdateSettlementRequest = {
                amount: 100.50,
                currency: 'JPY',
            };
            const req = createStubRequest('test-user', updateRequest, { settlementId: 'test-settlement' }) as AuthenticatedRequest;
            const res = createStubResponse();

            await expect(settlementHandlers.updateSettlement(req, res)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'VALIDATION_ERROR',
                }),
            );
        });
    });

    describe('deleteSettlement', () => {
        it('should soft delete settlement successfully', async () => {
            const groupId = 'test-group';
            const userId = 'test-user';
            const settlementId = 'test-settlement';

            db.seedUser(userId, { displayName: 'Test User' });
            db.seedUser('payer-user', { displayName: 'Payer' });
            db.seedUser('payee-user', { displayName: 'Payee' });
            db.seedGroup(groupId, { name: 'Test Group', createdBy: userId });
            db.initializeGroupBalance(groupId);

            db.seedSettlement(settlementId, {
                id: settlementId,
                groupId,
                payerId: 'payer-user',
                payeeId: 'payee-user',
                amount: 100,
                currency: 'USD',
                date: new Date().toISOString(),
                createdBy: userId,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                deletedAt: null,
                deletedBy: null,
            });

            const creatorMembership = new GroupMemberDocumentBuilder()
                .withUserId(userId)
                .withGroupId(groupId)
                .withRole('member')
                .withStatus('active')
                .buildDocument();
            const payerMembership = new GroupMemberDocumentBuilder()
                .withUserId('payer-user')
                .withGroupId(groupId)
                .withRole('member')
                .withStatus('active')
                .buildDocument();
            const payeeMembership = new GroupMemberDocumentBuilder()
                .withUserId('payee-user')
                .withGroupId(groupId)
                .withRole('member')
                .withStatus('active')
                .buildDocument();

            db.seedGroupMember(groupId, userId, creatorMembership);
            db.seedGroupMember(groupId, 'payer-user', payerMembership);
            db.seedGroupMember(groupId, 'payee-user', payeeMembership);

            const req = createStubRequest(userId, {}, { settlementId }) as AuthenticatedRequest;
            const res = createStubResponse();

            await settlementHandlers.deleteSettlement(req, res);

            expect((res as any).getStatus()).toBe(HTTP_STATUS.OK);
            const json = (res as any).getJson();
            expect(json).toMatchObject({
                success: true,
                message: 'Settlement deleted successfully',
            });
        });

        it('should reject delete with invalid settlement ID', async () => {
            const req = createStubRequest('test-user', {}, { settlementId: '' }) as AuthenticatedRequest;
            const res = createStubResponse();

            await expect(settlementHandlers.deleteSettlement(req, res)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'INVALID_SETTLEMENT_ID',
                }),
            );
        });

        it('should reject delete of non-existent settlement', async () => {
            const req = createStubRequest('test-user', {}, { settlementId: 'non-existent-settlement' }) as AuthenticatedRequest;
            const res = createStubResponse();

            await expect(settlementHandlers.deleteSettlement(req, res)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.NOT_FOUND,
                }),
            );
        });

        it('should allow group admin to delete settlement created by another user', async () => {
            const groupId = 'test-group';
            const adminId = 'admin-user';
            const creatorId = 'creator-user';
            const settlementId = 'test-settlement';

            db.seedUser(adminId, { displayName: 'Admin User' });
            db.seedUser(creatorId, { displayName: 'Creator User' });
            db.seedUser('payer-user', { displayName: 'Payer' });
            db.seedUser('payee-user', { displayName: 'Payee' });
            db.seedGroup(groupId, { name: 'Test Group', createdBy: adminId });
            db.initializeGroupBalance(groupId);

            db.seedSettlement(settlementId, {
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
            });

            const adminMembership = new GroupMemberDocumentBuilder()
                .withUserId(adminId)
                .withGroupId(groupId)
                .withRole('admin')
                .withStatus('active')
                .buildDocument();
            const creatorMembership = new GroupMemberDocumentBuilder()
                .withUserId(creatorId)
                .withGroupId(groupId)
                .withRole('member')
                .withStatus('active')
                .buildDocument();
            const payerMembership = new GroupMemberDocumentBuilder()
                .withUserId('payer-user')
                .withGroupId(groupId)
                .withRole('member')
                .withStatus('active')
                .buildDocument();
            const payeeMembership = new GroupMemberDocumentBuilder()
                .withUserId('payee-user')
                .withGroupId(groupId)
                .withRole('member')
                .withStatus('active')
                .buildDocument();

            db.seedGroupMember(groupId, adminId, adminMembership);
            db.seedGroupMember(groupId, creatorId, creatorMembership);
            db.seedGroupMember(groupId, 'payer-user', payerMembership);
            db.seedGroupMember(groupId, 'payee-user', payeeMembership);

            const req = createStubRequest(adminId, {}, { settlementId }) as AuthenticatedRequest;
            const res = createStubResponse();

            await settlementHandlers.deleteSettlement(req, res);

            expect((res as any).getStatus()).toBe(HTTP_STATUS.OK);
            const json = (res as any).getJson();
            expect(json).toMatchObject({
                success: true,
                message: 'Settlement deleted successfully',
            });
        });
    });

    describe('Static Factory Method', () => {
        it('should create SettlementHandlers instance with default ApplicationBuilder', () => {
            const handlers = SettlementHandlers.createSettlementHandlers();
            expect(handlers).toBeInstanceOf(SettlementHandlers);
            expect(handlers.createSettlement).toBeDefined();
            expect(handlers.updateSettlement).toBeDefined();
            expect(handlers.deleteSettlement).toBeDefined();
        });
    });
});
