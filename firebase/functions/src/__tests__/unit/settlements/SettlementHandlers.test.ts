import { CreateSettlementRequestBuilder, createStubRequest, createStubResponse, SettlementDTOBuilder, SettlementUpdateBuilder, StubFirestoreDatabase } from '@splitifyd/test-support';
import { beforeEach, describe, expect, it } from 'vitest';
import { HTTP_STATUS } from '../../../constants';
import { ApplicationBuilder } from '../../../services/ApplicationBuilder';
import { FirestoreReader, FirestoreWriter } from '../../../services/firestore';
import { SettlementHandlers } from '../../../settlements/SettlementHandlers';
import { GroupMemberDocumentBuilder } from '../../support/GroupMemberDocumentBuilder';
import { StubAuthService } from '../mocks/StubAuthService';

describe('SettlementHandlers - Unit Tests', () => {
    let settlementHandlers: SettlementHandlers;
    let db: StubFirestoreDatabase;

    beforeEach(() => {
        db = new StubFirestoreDatabase();

        const applicationBuilder = new ApplicationBuilder(new FirestoreReader(db), new FirestoreWriter(db), new StubAuthService());

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

            const req = createStubRequest(userId, settlementRequest);
            const res = createStubResponse();

            await settlementHandlers.createSettlement(req, res);

            expect((res as any).getStatus()).toBe(HTTP_STATUS.CREATED);
            const json = (res as any).getJson();
            expect(json).toMatchObject(
                expect.objectContaining({
                    id: expect.any(String),
                    groupId,
                    payerId: 'payer-user',
                    payeeId: 'payee-user',
                    amount: '100.5',
                    currency: 'USD',
                    note: 'Test settlement',
                }),
            );
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

            const req = createStubRequest(userId, settlementRequest);
            const res = createStubResponse();

            await settlementHandlers.createSettlement(req, res);

            expect((res as any).getStatus()).toBe(HTTP_STATUS.CREATED);
            const json = (res as any).getJson();
            expect(json).toMatchObject(expect.objectContaining({
                amount: '50',
            }));
            // Verify note field is not present or is undefined
            expect(json.note).toBeUndefined();
        });

        it('should reject settlement with invalid amount (zero)', async () => {
            const invalidRequest = new CreateSettlementRequestBuilder()
                .withGroupId('test-group')
                .withPayerId('payer')
                .withPayeeId('payee')
                .withAmount(0)
                .withCurrency('USD')
                .build();

            const req = createStubRequest('test-user', invalidRequest);
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

            const req = createStubRequest('test-user', invalidRequest);
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

            const req = createStubRequest('test-user', invalidRequest);
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

            const req = createStubRequest('test-user', invalidRequest);
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

            const req = createStubRequest('test-user', invalidRequest);
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

            const req = createStubRequest('test-user', invalidRequest);
            const res = createStubResponse();

            await expect(settlementHandlers.createSettlement(req, res)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'VALIDATION_ERROR',
                }),
            );
        });

        it('should reject settlement with missing groupId', async () => {
            const invalidRequest = new CreateSettlementRequestBuilder()
                .withPayerId('payer')
                .withPayeeId('payee')
                .withAmount(100)
                .withCurrency('USD')
                .build();

            delete (invalidRequest as any).groupId;

            const req = createStubRequest('test-user', invalidRequest);
            const res = createStubResponse();

            await expect(settlementHandlers.createSettlement(req, res)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'VALIDATION_ERROR',
                }),
            );
        });

        it('should reject settlement with missing payerId', async () => {
            const invalidRequest = new CreateSettlementRequestBuilder()
                .withGroupId('test-group')
                .withPayeeId('payee')
                .withAmount(100)
                .withCurrency('USD')
                .build();

            delete (invalidRequest as any).payerId;

            const req = createStubRequest('test-user', invalidRequest);
            const res = createStubResponse();

            await expect(settlementHandlers.createSettlement(req, res)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'VALIDATION_ERROR',
                }),
            );
        });

        it('should reject settlement with missing payeeId', async () => {
            const invalidRequest = new CreateSettlementRequestBuilder()
                .withGroupId('test-group')
                .withPayerId('payer')
                .withAmount(100)
                .withCurrency('USD')
                .build();

            delete (invalidRequest as any).payeeId;

            const req = createStubRequest('test-user', invalidRequest);
            const res = createStubResponse();

            await expect(settlementHandlers.createSettlement(req, res)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'VALIDATION_ERROR',
                }),
            );
        });

        it('should reject settlement with missing amount', async () => {
            const invalidRequest = new CreateSettlementRequestBuilder()
                .withGroupId('test-group')
                .withPayerId('payer')
                .withPayeeId('payee')
                .withCurrency('USD')
                .build();

            delete (invalidRequest as any).amount;

            const req = createStubRequest('test-user', invalidRequest);
            const res = createStubResponse();

            await expect(settlementHandlers.createSettlement(req, res)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'VALIDATION_ERROR',
                }),
            );
        });

        it('should reject settlement with missing currency', async () => {
            const invalidRequest = new CreateSettlementRequestBuilder()
                .withGroupId('test-group')
                .withPayerId('payer')
                .withPayeeId('payee')
                .withAmount(100)
                .build();

            delete (invalidRequest as any).currency;

            const req = createStubRequest('test-user', invalidRequest);
            const res = createStubResponse();

            await expect(settlementHandlers.createSettlement(req, res)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'VALIDATION_ERROR',
                }),
            );
        });

        it('should reject settlement for non-existent group', async () => {
            const userId = 'test-user';
            db.seedUser(userId);

            const settlementRequest = new CreateSettlementRequestBuilder()
                .withGroupId('non-existent-group')
                .withPayerId('payer')
                .withPayeeId('payee')
                .withAmount(100)
                .withCurrency('USD')
                .build();

            const req = createStubRequest(userId, settlementRequest);
            const res = createStubResponse();

            await expect(settlementHandlers.createSettlement(req, res)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.NOT_FOUND,
                }),
            );
        });

        it('should reject settlement when creator is not a group member', async () => {
            const groupId = 'test-group';
            const userId = 'non-member-user';

            db.seedUser(userId);
            db.seedUser('payer-user');
            db.seedUser('payee-user');
            db.seedGroup(groupId, { createdBy: 'another-user' });
            db.initializeGroupBalance(groupId);

            const payerMembership = new GroupMemberDocumentBuilder()
                .withUserId('payer-user')
                .withGroupId(groupId)
                .buildDocument();
            const payeeMembership = new GroupMemberDocumentBuilder()
                .withUserId('payee-user')
                .withGroupId(groupId)
                .buildDocument();

            db.seedGroupMember(groupId, 'payer-user', payerMembership);
            db.seedGroupMember(groupId, 'payee-user', payeeMembership);

            const settlementRequest = new CreateSettlementRequestBuilder()
                .withGroupId(groupId)
                .withPayerId('payer-user')
                .withPayeeId('payee-user')
                .withAmount(100)
                .withCurrency('USD')
                .build();

            const req = createStubRequest(userId, settlementRequest);
            const res = createStubResponse();

            await expect(settlementHandlers.createSettlement(req, res)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.FORBIDDEN,
                }),
            );
        });

        it('should reject settlement when payer is not a group member', async () => {
            const groupId = 'test-group';
            const userId = 'test-user';

            db.seedUser(userId);
            db.seedUser('non-member-payer');
            db.seedUser('payee-user');
            db.seedGroup(groupId, { createdBy: userId });
            db.initializeGroupBalance(groupId);

            const creatorMembership = new GroupMemberDocumentBuilder()
                .withUserId(userId)
                .withGroupId(groupId)
                .buildDocument();
            const payeeMembership = new GroupMemberDocumentBuilder()
                .withUserId('payee-user')
                .withGroupId(groupId)
                .buildDocument();

            db.seedGroupMember(groupId, userId, creatorMembership);
            db.seedGroupMember(groupId, 'payee-user', payeeMembership);

            const settlementRequest = new CreateSettlementRequestBuilder()
                .withGroupId(groupId)
                .withPayerId('non-member-payer')
                .withPayeeId('payee-user')
                .withAmount(100)
                .withCurrency('USD')
                .build();

            const req = createStubRequest(userId, settlementRequest);
            const res = createStubResponse();

            await expect(settlementHandlers.createSettlement(req, res)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                }),
            );
        });

        it('should reject settlement when payee is not a group member', async () => {
            const groupId = 'test-group';
            const userId = 'test-user';

            db.seedUser(userId);
            db.seedUser('payer-user');
            db.seedUser('non-member-payee');
            db.seedGroup(groupId, { createdBy: userId });
            db.initializeGroupBalance(groupId);

            const creatorMembership = new GroupMemberDocumentBuilder()
                .withUserId(userId)
                .withGroupId(groupId)
                .buildDocument();
            const payerMembership = new GroupMemberDocumentBuilder()
                .withUserId('payer-user')
                .withGroupId(groupId)
                .buildDocument();

            db.seedGroupMember(groupId, userId, creatorMembership);
            db.seedGroupMember(groupId, 'payer-user', payerMembership);

            const settlementRequest = new CreateSettlementRequestBuilder()
                .withGroupId(groupId)
                .withPayerId('payer-user')
                .withPayeeId('non-member-payee')
                .withAmount(100)
                .withCurrency('USD')
                .build();

            const req = createStubRequest(userId, settlementRequest);
            const res = createStubResponse();

            await expect(settlementHandlers.createSettlement(req, res)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
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

            const settlement = new SettlementDTOBuilder()
                .withId(settlementId)
                .withGroupId(groupId)
                .withPayerId('payer-user')
                .withPayeeId('payee-user')
                .withCreatedBy(userId)
                .build();

            db.seedSettlement(settlementId, settlement);

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

            const updateRequest = new SettlementUpdateBuilder().withAmount(150.75).withCurrency('USD').build();

            const req = createStubRequest(userId, updateRequest, { settlementId });
            const res = createStubResponse();

            await settlementHandlers.updateSettlement(req, res);

            expect((res as any).getStatus()).toBe(HTTP_STATUS.OK);
            const json = (res as any).getJson();
            expect(json).toMatchObject(expect.objectContaining({
                id: settlementId,
                amount: '150.75',
            }));
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

            const settlement = new SettlementDTOBuilder()
                .withId(settlementId)
                .withGroupId(groupId)
                .withPayerId('payer-user')
                .withPayeeId('payee-user')
                .withNote('Old note')
                .withCreatedBy(userId)
                .build();

            db.seedSettlement(settlementId, settlement);

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

            const updateRequest = new SettlementUpdateBuilder().withNote('Updated note').build();

            const req = createStubRequest(userId, updateRequest, { settlementId });
            const res = createStubResponse();

            await settlementHandlers.updateSettlement(req, res);

            expect((res as any).getStatus()).toBe(HTTP_STATUS.OK);
            const json = (res as any).getJson();
            expect(json).toMatchObject(expect.objectContaining({
                id: settlementId,
                note: 'Updated note',
            }));
        });

        it('should reject update with invalid settlement ID', async () => {
            const updateRequest = { amount: '150' };
            const req = createStubRequest('test-user', updateRequest, { settlementId: '' });
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
            const req = createStubRequest('test-user', updateRequest, { settlementId: 'test-settlement' });
            const res = createStubResponse();

            await expect(settlementHandlers.updateSettlement(req, res)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'VALIDATION_ERROR',
                }),
            );
        });

        it('should reject update with invalid amount precision when currency provided', async () => {
            const updateRequest = {
                amount: '100.50',
                currency: 'JPY',
            };
            const req = createStubRequest('test-user', updateRequest, { settlementId: 'test-settlement' });
            const res = createStubResponse();

            await expect(settlementHandlers.updateSettlement(req, res)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'VALIDATION_ERROR',
                }),
            );
        });

        it('should reject update of non-existent settlement', async () => {
            const userId = 'test-user';
            db.seedUser(userId);

            const updateRequest = { amount: '150' };
            const req = createStubRequest(userId, updateRequest, { settlementId: 'non-existent-settlement' });
            const res = createStubResponse();

            await expect(settlementHandlers.updateSettlement(req, res)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.NOT_FOUND,
                }),
            );
        });

        it('should reject update when user is not a group member', async () => {
            const groupId = 'test-group';
            const creatorId = 'creator-user';
            const nonMemberId = 'non-member-user';
            const settlementId = 'test-settlement';

            db.seedUser(creatorId);
            db.seedUser(nonMemberId);
            db.seedUser('payer-user');
            db.seedUser('payee-user');
            db.seedGroup(groupId, { createdBy: creatorId });
            db.initializeGroupBalance(groupId);

            const settlement = new SettlementDTOBuilder()
                .withId(settlementId)
                .withGroupId(groupId)
                .withPayerId('payer-user')
                .withPayeeId('payee-user')
                .withCreatedBy(creatorId)
                .build();

            db.seedSettlement(settlementId, settlement);

            const creatorMembership = new GroupMemberDocumentBuilder()
                .withUserId(creatorId)
                .withGroupId(groupId)
                .buildDocument();
            const payerMembership = new GroupMemberDocumentBuilder()
                .withUserId('payer-user')
                .withGroupId(groupId)
                .buildDocument();
            const payeeMembership = new GroupMemberDocumentBuilder()
                .withUserId('payee-user')
                .withGroupId(groupId)
                .buildDocument();

            db.seedGroupMember(groupId, creatorId, creatorMembership);
            db.seedGroupMember(groupId, 'payer-user', payerMembership);
            db.seedGroupMember(groupId, 'payee-user', payeeMembership);

            const updateRequest = new SettlementUpdateBuilder().withAmount(150).build();
            const req = createStubRequest(nonMemberId, updateRequest, { settlementId });
            const res = createStubResponse();

            await expect(settlementHandlers.updateSettlement(req, res)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.FORBIDDEN,
                }),
            );
        });

        it('should reject update by non-creator even if admin', async () => {
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

            const settlement = new SettlementDTOBuilder()
                .withId(settlementId)
                .withGroupId(groupId)
                .withPayerId('payer-user')
                .withPayeeId('payee-user')
                .withCreatedBy(creatorId)
                .build();

            db.seedSettlement(settlementId, settlement);

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

            const updateRequest = new SettlementUpdateBuilder().withAmount(200.50).withCurrency('USD').build();
            const req = createStubRequest(adminId, updateRequest, { settlementId });
            const res = createStubResponse();

            await expect(settlementHandlers.updateSettlement(req, res)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.FORBIDDEN,
                }),
            );
        });

        it('should reject update with zero amount', async () => {
            const updateRequest = { amount: '0' };
            const req = createStubRequest('test-user', updateRequest, { settlementId: 'test-settlement' });
            const res = createStubResponse();

            await expect(settlementHandlers.updateSettlement(req, res)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'VALIDATION_ERROR',
                }),
            );
        });

        it('should reject update with negative amount', async () => {
            const updateRequest = { amount: '-50' };
            const req = createStubRequest('test-user', updateRequest, { settlementId: 'test-settlement' });
            const res = createStubResponse();

            await expect(settlementHandlers.updateSettlement(req, res)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'VALIDATION_ERROR',
                }),
            );
        });

        it('should reject update with excessively long note', async () => {
            const longNote = 'a'.repeat(501);
            const updateRequest = { note: longNote };
            const req = createStubRequest('test-user', updateRequest, { settlementId: 'test-settlement' });
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

            const settlement = new SettlementDTOBuilder()
                .withId(settlementId)
                .withGroupId(groupId)
                .withPayerId('payer-user')
                .withPayeeId('payee-user')
                .withAmount(100)
                .withCurrency('USD')
                .withDate(new Date().toISOString())
                .withCreatedBy(userId)
                .build();

            db.seedSettlement(settlementId, settlement);

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

            const req = createStubRequest(userId, {}, { settlementId });
            const res = createStubResponse();

            await settlementHandlers.deleteSettlement(req, res);

            expect((res as any).getStatus()).toBe(HTTP_STATUS.OK);
            const json = (res as any).getJson();
            expect(json).toMatchObject({
                message: 'Settlement deleted successfully',
            });
        });

        it('should reject delete with invalid settlement ID', async () => {
            const req = createStubRequest('test-user', {}, { settlementId: '' });
            const res = createStubResponse();

            await expect(settlementHandlers.deleteSettlement(req, res)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'INVALID_SETTLEMENT_ID',
                }),
            );
        });

        it('should reject delete of non-existent settlement', async () => {
            const req = createStubRequest('test-user', {}, { settlementId: 'non-existent-settlement' });
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

            const settlement = new SettlementDTOBuilder()
                .withId(settlementId)
                .withGroupId(groupId)
                .withPayerId('payer-user')
                .withPayeeId('payee-user')
                .withAmount(100)
                .withCurrency('USD')
                .withDate(new Date().toISOString())
                .withCreatedBy(creatorId)
                .build();

            db.seedSettlement(settlementId, settlement);

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

            const req = createStubRequest(adminId, {}, { settlementId });
            const res = createStubResponse();

            await settlementHandlers.deleteSettlement(req, res);

            expect((res as any).getStatus()).toBe(HTTP_STATUS.OK);
            const json = (res as any).getJson();
            expect(json).toMatchObject({
                message: 'Settlement deleted successfully',
            });
        });

        it('should reject delete when user is not a group member', async () => {
            const groupId = 'test-group';
            const creatorId = 'creator-user';
            const nonMemberId = 'non-member-user';
            const settlementId = 'test-settlement';

            db.seedUser(creatorId, { displayName: 'Creator User' });
            db.seedUser(nonMemberId, { displayName: 'Non-member User' });
            db.seedUser('payer-user', { displayName: 'Payer' });
            db.seedUser('payee-user', { displayName: 'Payee' });
            db.seedGroup(groupId, { name: 'Test Group', createdBy: creatorId });
            db.initializeGroupBalance(groupId);

            const settlement = new SettlementDTOBuilder()
                .withId(settlementId)
                .withGroupId(groupId)
                .withPayerId('payer-user')
                .withPayeeId('payee-user')
                .withAmount(100)
                .withCurrency('USD')
                .withDate(new Date().toISOString())
                .withCreatedBy(creatorId)
                .build();

            db.seedSettlement(settlementId, settlement);

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

            db.seedGroupMember(groupId, creatorId, creatorMembership);
            db.seedGroupMember(groupId, 'payer-user', payerMembership);
            db.seedGroupMember(groupId, 'payee-user', payeeMembership);

            const req = createStubRequest(nonMemberId, {}, { settlementId });
            const res = createStubResponse();

            await expect(settlementHandlers.deleteSettlement(req, res)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.FORBIDDEN,
                }),
            );
        });

        it('should reject delete by non-creator regular member', async () => {
            const groupId = 'test-group';
            const creatorId = 'creator-user';
            const otherMemberId = 'other-member-user';
            const settlementId = 'test-settlement';

            db.seedUser(creatorId, { displayName: 'Creator User' });
            db.seedUser(otherMemberId, { displayName: 'Other Member User' });
            db.seedUser('payer-user', { displayName: 'Payer' });
            db.seedUser('payee-user', { displayName: 'Payee' });
            db.seedGroup(groupId, { name: 'Test Group', createdBy: creatorId });
            db.initializeGroupBalance(groupId);

            const settlement = new SettlementDTOBuilder()
                .withId(settlementId)
                .withGroupId(groupId)
                .withCreatedBy(creatorId)
                .build();

            db.seedSettlement(settlementId, settlement);

            const creatorMembership = new GroupMemberDocumentBuilder()
                .withUserId(creatorId)
                .withGroupId(groupId)
                .withRole('member')
                .withStatus('active')
                .buildDocument();
            const otherMemberMembership = new GroupMemberDocumentBuilder()
                .withUserId(otherMemberId)
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

            db.seedGroupMember(groupId, creatorId, creatorMembership);
            db.seedGroupMember(groupId, otherMemberId, otherMemberMembership);
            db.seedGroupMember(groupId, 'payer-user', payerMembership);
            db.seedGroupMember(groupId, 'payee-user', payeeMembership);

            const req = createStubRequest(otherMemberId, {}, { settlementId });
            const res = createStubResponse();

            await expect(settlementHandlers.deleteSettlement(req, res)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.FORBIDDEN,
                }),
            );
        });

        it('should allow creator to delete their own settlement', async () => {
            const groupId = 'test-group';
            const creatorId = 'creator-user';
            const settlementId = 'test-settlement';

            db.seedUser(creatorId, { displayName: 'Creator User' });
            db.seedUser('payer-user', { displayName: 'Payer' });
            db.seedUser('payee-user', { displayName: 'Payee' });
            db.seedGroup(groupId, { name: 'Test Group', createdBy: creatorId });
            db.initializeGroupBalance(groupId);

            const settlement = new SettlementDTOBuilder()
                .withId(settlementId)
                .withGroupId(groupId)
                .withCreatedBy(creatorId)
                .build();

            db.seedSettlement(settlementId, settlement);

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

            db.seedGroupMember(groupId, creatorId, creatorMembership);
            db.seedGroupMember(groupId, 'payer-user', payerMembership);
            db.seedGroupMember(groupId, 'payee-user', payeeMembership);

            const req = createStubRequest(creatorId, {}, { settlementId });
            const res = createStubResponse();

            await settlementHandlers.deleteSettlement(req, res);

            expect((res as any).getStatus()).toBe(HTTP_STATUS.OK);
            const json = (res as any).getJson();
            expect(json).toMatchObject({
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
