import { CreateSettlementRequestBuilder, SettlementUpdateBuilder } from '@splitifyd/test-support';
import { beforeEach, describe, expect, it } from 'vitest';
import { HTTP_STATUS } from '../../../constants';
import { SettlementHandlers } from '../../../settlements/SettlementHandlers';
import { AppDriver } from '../AppDriver';

describe('SettlementHandlers - Unit Tests', () => {
    let appDriver: AppDriver;

    beforeEach(() => {
        appDriver = new AppDriver();
    });

    describe('createSettlement', () => {
        it('should create a settlement successfully with valid data', async () => {
            const userId = 'test-user';
            const payerId = 'payer-user';
            const payeeId = 'payee-user';

            appDriver.seedUser(userId, { displayName: 'Test User' });
            appDriver.seedUser(payerId, { displayName: 'Payer' });
            appDriver.seedUser(payeeId, { displayName: 'Payee' });

            const group = await appDriver.createGroup(userId);
            const { linkId } = await appDriver.generateShareableLink(userId, group.id);
            await appDriver.joinGroupByLink(payerId, linkId);
            await appDriver.joinGroupByLink(payeeId, linkId);

            const settlementRequest = new CreateSettlementRequestBuilder()
                .withGroupId(group.id)
                .withPayerId(payerId)
                .withPayeeId(payeeId)
                .withAmount(100.50, 'USD')
                .withNote('Test settlement')
                .build();

            const result = await appDriver.createSettlement(userId, settlementRequest);

            expect(result).toMatchObject({
                id: expect.any(String),
                groupId: group.id,
                payerId,
                payeeId,
                amount: '100.5',
                currency: 'USD',
                note: 'Test settlement',
            });
        });

        it('sanitizes settlement notes before persisting', async () => {
            const userId = 'test-user';
            const payerId = 'payer-user';
            const payeeId = 'payee-user';

            appDriver.seedUser(userId, { displayName: 'Test User' });
            appDriver.seedUser(payerId, { displayName: 'Payer' });
            appDriver.seedUser(payeeId, { displayName: 'Payee' });

            const group = await appDriver.createGroup(userId);
            const { linkId } = await appDriver.generateShareableLink(userId, group.id);
            await appDriver.joinGroupByLink(payerId, linkId);
            await appDriver.joinGroupByLink(payeeId, linkId);

            const settlementRequest = new CreateSettlementRequestBuilder()
                .withGroupId(group.id)
                .withPayerId(payerId)
                .withPayeeId(payeeId)
                .withAmount(75, 'USD')
                .withNote('Paid<script>alert(1)</script>')
                .build();

            const result = await appDriver.createSettlement(userId, settlementRequest);

            expect(result.note).toBe('Paid');
        });

        it('should create a settlement without optional note', async () => {
            const userId = 'test-user';
            const payerId = 'payer-user';
            const payeeId = 'payee-user';

            appDriver.seedUser(userId, { displayName: 'Test User' });
            appDriver.seedUser(payerId, { displayName: 'Payer' });
            appDriver.seedUser(payeeId, { displayName: 'Payee' });

            const group = await appDriver.createGroup(userId);
            const { linkId } = await appDriver.generateShareableLink(userId, group.id);
            await appDriver.joinGroupByLink(payerId, linkId);
            await appDriver.joinGroupByLink(payeeId, linkId);

            const settlementRequest = new CreateSettlementRequestBuilder()
                .withGroupId(group.id)
                .withPayerId(payerId)
                .withPayeeId(payeeId)
                .withAmount(50.00, 'USD')
                .withoutNote()
                .build();

            const result = await appDriver.createSettlement(userId, settlementRequest);

            expect(result).toMatchObject({
                amount: '50',
            });
            expect(result.note).toBeUndefined();
        });

        it('should reject settlement with invalid amount (zero)', async () => {
            const invalidRequest = new CreateSettlementRequestBuilder()
                .withGroupId('test-group')
                .withPayerId('payer')
                .withPayeeId('payee')
                .withAmount(0, 'USD')
                .build();

            await expect(appDriver.createSettlement('test-user', invalidRequest)).rejects.toThrow(
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
                .withAmount(-50, 'USD')
                .build();

            await expect(appDriver.createSettlement('test-user', invalidRequest)).rejects.toThrow(
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
                .withAmount(100, 'USD')
                .build();

            await expect(appDriver.createSettlement('test-user', invalidRequest)).rejects.toThrow(
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
                .build();

            (invalidRequest as any).currency = 'US';

            await expect(appDriver.createSettlement('test-user', invalidRequest)).rejects.toThrow(
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
                .withAmount(100.50, 'JPY')
                .build();

            await expect(appDriver.createSettlement('test-user', invalidRequest)).rejects.toThrow(
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
                .withAmount(100, 'USD')
                .withNote(longNote)
                .build();

            await expect(appDriver.createSettlement('test-user', invalidRequest)).rejects.toThrow(
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
                .withAmount(100, 'USD')
                .build();

            delete (invalidRequest as any).groupId;

            await expect(appDriver.createSettlement('test-user', invalidRequest)).rejects.toThrow(
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
                .withAmount(100, 'USD')
                .build();

            delete (invalidRequest as any).payerId;

            await expect(appDriver.createSettlement('test-user', invalidRequest)).rejects.toThrow(
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
                .withAmount(100, 'USD')
                .build();

            delete (invalidRequest as any).payeeId;

            await expect(appDriver.createSettlement('test-user', invalidRequest)).rejects.toThrow(
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
                .build();

            delete (invalidRequest as any).amount;

            await expect(appDriver.createSettlement('test-user', invalidRequest)).rejects.toThrow(
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
                .build();

            delete (invalidRequest as any).currency;

            await expect(appDriver.createSettlement('test-user', invalidRequest)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'VALIDATION_ERROR',
                }),
            );
        });

        it('should reject settlement for non-existent group', async () => {
            const userId = 'test-user';
            appDriver.seedUser(userId);

            const settlementRequest = new CreateSettlementRequestBuilder()
                .withGroupId('non-existent-group')
                .withPayerId('payer')
                .withPayeeId('payee')
                .withAmount(100, 'USD')
                .build();

            await expect(appDriver.createSettlement(userId, settlementRequest)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.NOT_FOUND,
                }),
            );
        });

        it('should reject settlement when creator is not a group member', async () => {
            const creatorId = 'creator-user';
            const nonMemberId = 'non-member-user';
            const payerId = 'payer-user';
            const payeeId = 'payee-user';

            appDriver.seedUser(creatorId);
            appDriver.seedUser(nonMemberId);
            appDriver.seedUser(payerId);
            appDriver.seedUser(payeeId);

            const group = await appDriver.createGroup(creatorId);
            const { linkId } = await appDriver.generateShareableLink(creatorId, group.id);
            await appDriver.joinGroupByLink(payerId, linkId);
            await appDriver.joinGroupByLink(payeeId, linkId);

            const settlementRequest = new CreateSettlementRequestBuilder()
                .withGroupId(group.id)
                .withPayerId(payerId)
                .withPayeeId(payeeId)
                .withAmount(100, 'USD')
                .build();

            await expect(appDriver.createSettlement(nonMemberId, settlementRequest)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.FORBIDDEN,
                }),
            );
        });

        it('should reject settlement when payer is not a group member', async () => {
            const userId = 'test-user';
            const payeeId = 'payee-user';

            appDriver.seedUser(userId);
            appDriver.seedUser('non-member-payer');
            appDriver.seedUser(payeeId);

            const group = await appDriver.createGroup(userId);
            const { linkId } = await appDriver.generateShareableLink(userId, group.id);
            await appDriver.joinGroupByLink(payeeId, linkId);

            const settlementRequest = new CreateSettlementRequestBuilder()
                .withGroupId(group.id)
                .withPayerId('non-member-payer')
                .withPayeeId(payeeId)
                .withAmount(100, 'USD')
                .build();

            await expect(appDriver.createSettlement(userId, settlementRequest)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                }),
            );
        });

        it('should reject settlement when payee is not a group member', async () => {
            const userId = 'test-user';
            const payerId = 'payer-user';

            appDriver.seedUser(userId);
            appDriver.seedUser(payerId);
            appDriver.seedUser('non-member-payee');

            const group = await appDriver.createGroup(userId);
            const { linkId } = await appDriver.generateShareableLink(userId, group.id);
            await appDriver.joinGroupByLink(payerId, linkId);

            const settlementRequest = new CreateSettlementRequestBuilder()
                .withGroupId(group.id)
                .withPayerId(payerId)
                .withPayeeId('non-member-payee')
                .withAmount(100, 'USD')
                .build();

            await expect(appDriver.createSettlement(userId, settlementRequest)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                }),
            );
        });
    });

    describe('updateSettlement', () => {
        it('should update settlement amount successfully', async () => {
            const userId = 'test-user';
            const payerId = 'payer-user';
            const payeeId = 'payee-user';

            appDriver.seedUser(userId, { displayName: 'Test User' });
            appDriver.seedUser(payerId, { displayName: 'Payer' });
            appDriver.seedUser(payeeId, { displayName: 'Payee' });

            const group = await appDriver.createGroup(userId);
            const { linkId } = await appDriver.generateShareableLink(userId, group.id);
            await appDriver.joinGroupByLink(payerId, linkId);
            await appDriver.joinGroupByLink(payeeId, linkId);

            const settlementRequest = new CreateSettlementRequestBuilder()
                .withGroupId(group.id)
                .withPayerId(payerId)
                .withPayeeId(payeeId)
                .withAmount(100, 'USD')
                .build();

            const created = await appDriver.createSettlement(userId, settlementRequest);

            const updateRequest = new SettlementUpdateBuilder()
                .withAmount(150.75, 'USD')
                .build();

            const result = await appDriver.updateSettlement(userId, created.id, updateRequest);

            expect(result).toMatchObject({
                id: created.id,
                amount: '150.75',
            });
        });

        it('should update settlement note successfully', async () => {
            const userId = 'test-user';
            const payerId = 'payer-user';
            const payeeId = 'payee-user';

            appDriver.seedUser(userId, { displayName: 'Test User' });
            appDriver.seedUser(payerId, { displayName: 'Payer' });
            appDriver.seedUser(payeeId, { displayName: 'Payee' });

            const group = await appDriver.createGroup(userId);
            const { linkId } = await appDriver.generateShareableLink(userId, group.id);
            await appDriver.joinGroupByLink(payerId, linkId);
            await appDriver.joinGroupByLink(payeeId, linkId);

            const settlementRequest = new CreateSettlementRequestBuilder()
                .withGroupId(group.id)
                .withPayerId(payerId)
                .withPayeeId(payeeId)
                .withAmount(100, 'USD')
                .withNote('Old note')
                .build();

            const created = await appDriver.createSettlement(userId, settlementRequest);

            const updateRequest = new SettlementUpdateBuilder()
                .withNote('Updated note')
                .build();

            const result = await appDriver.updateSettlement(userId, created.id, updateRequest);

            expect(result).toMatchObject({
                id: created.id,
                note: 'Updated note',
            });
        });

        it('sanitizes settlement note updates before persisting', async () => {
            const userId = 'test-user';
            const payerId = 'payer-user';
            const payeeId = 'payee-user';

            appDriver.seedUser(userId, { displayName: 'Test User' });
            appDriver.seedUser(payerId, { displayName: 'Payer' });
            appDriver.seedUser(payeeId, { displayName: 'Payee' });

            const group = await appDriver.createGroup(userId);
            const { linkId } = await appDriver.generateShareableLink(userId, group.id);
            await appDriver.joinGroupByLink(payerId, linkId);
            await appDriver.joinGroupByLink(payeeId, linkId);

            const settlementRequest = new CreateSettlementRequestBuilder()
                .withGroupId(group.id)
                .withPayerId(payerId)
                .withPayeeId(payeeId)
                .withAmount(100, 'USD')
                .withNote('Initial note')
                .build();

            const created = await appDriver.createSettlement(userId, settlementRequest);

            const updateRequest = new SettlementUpdateBuilder()
                .withNote('Updated<script>alert(1)</script>')
                .build();

            const result = await appDriver.updateSettlement(userId, created.id, updateRequest);

            expect(result.note).toBe('Updated');
        });

        it('should reject update with invalid settlement ID', async () => {
            const updateRequest = { amount: '150' };

            await expect(appDriver.updateSettlement('test-user', '', updateRequest)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'INVALID_SETTLEMENT_ID',
                }),
            );
        });

        it('should reject update with no fields provided', async () => {
            const updateRequest = {};

            await expect(appDriver.updateSettlement('test-user', 'test-settlement', updateRequest)).rejects.toThrow(
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

            await expect(appDriver.updateSettlement('test-user', 'test-settlement', updateRequest)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'VALIDATION_ERROR',
                }),
            );
        });

        it('should reject update of non-existent settlement', async () => {
            const userId = 'test-user';
            appDriver.seedUser(userId);

            const updateRequest = { amount: '150' };

            await expect(appDriver.updateSettlement(userId, 'non-existent-settlement', updateRequest)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.NOT_FOUND,
                }),
            );
        });

        it('should reject update when user is not a group member', async () => {
            const creatorId = 'creator-user';
            const nonMemberId = 'non-member-user';
            const payerId = 'payer-user';
            const payeeId = 'payee-user';

            appDriver.seedUser(creatorId);
            appDriver.seedUser(nonMemberId);
            appDriver.seedUser(payerId);
            appDriver.seedUser(payeeId);

            const group = await appDriver.createGroup(creatorId);
            const { linkId } = await appDriver.generateShareableLink(creatorId, group.id);
            await appDriver.joinGroupByLink(payerId, linkId);
            await appDriver.joinGroupByLink(payeeId, linkId);

            const settlementRequest = new CreateSettlementRequestBuilder()
                .withGroupId(group.id)
                .withPayerId(payerId)
                .withPayeeId(payeeId)
                .withAmount(100, 'USD')
                .build();

            const created = await appDriver.createSettlement(creatorId, settlementRequest);

            const updateRequest = new SettlementUpdateBuilder()
                .withAmount(150, 'USD')
                .build();

            await expect(appDriver.updateSettlement(nonMemberId, created.id, updateRequest)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.FORBIDDEN,
                }),
            );
        });

        it('should reject update by non-creator even if admin', async () => {
            const adminId = 'admin-user';
            const creatorId = 'creator-user';
            const payerId = 'payer-user';
            const payeeId = 'payee-user';

            appDriver.seedUser(adminId, { displayName: 'Admin User' });
            appDriver.seedUser(creatorId, { displayName: 'Creator User' });
            appDriver.seedUser(payerId, { displayName: 'Payer' });
            appDriver.seedUser(payeeId, { displayName: 'Payee' });

            const group = await appDriver.createGroup(adminId);
            const { linkId } = await appDriver.generateShareableLink(adminId, group.id);
            await appDriver.joinGroupByLink(creatorId, linkId);
            await appDriver.joinGroupByLink(payerId, linkId);
            await appDriver.joinGroupByLink(payeeId, linkId);

            const settlementRequest = new CreateSettlementRequestBuilder()
                .withGroupId(group.id)
                .withPayerId(payerId)
                .withPayeeId(payeeId)
                .withAmount(100, 'USD')
                .build();

            const created = await appDriver.createSettlement(creatorId, settlementRequest);

            const updateRequest = new SettlementUpdateBuilder()
                .withAmount(200.50, 'USD')
                .build();

            await expect(appDriver.updateSettlement(adminId, created.id, updateRequest)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.FORBIDDEN,
                }),
            );
        });

        it('should reject update with zero amount', async () => {
            const updateRequest = { amount: '0' };

            await expect(appDriver.updateSettlement('test-user', 'test-settlement', updateRequest)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'VALIDATION_ERROR',
                }),
            );
        });

        it('should reject update with negative amount', async () => {
            const updateRequest = { amount: '-50' };

            await expect(appDriver.updateSettlement('test-user', 'test-settlement', updateRequest)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'VALIDATION_ERROR',
                }),
            );
        });

        it('should reject update with excessively long note', async () => {
            const longNote = 'a'.repeat(501);
            const updateRequest = { note: longNote };

            await expect(appDriver.updateSettlement('test-user', 'test-settlement', updateRequest)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'VALIDATION_ERROR',
                }),
            );
        });
    });

    describe('deleteSettlement', () => {
        it('should soft delete settlement successfully', async () => {
            const userId = 'test-user';
            const payerId = 'payer-user';
            const payeeId = 'payee-user';

            appDriver.seedUser(userId, { displayName: 'Test User' });
            appDriver.seedUser(payerId, { displayName: 'Payer' });
            appDriver.seedUser(payeeId, { displayName: 'Payee' });

            const group = await appDriver.createGroup(userId);
            const { linkId } = await appDriver.generateShareableLink(userId, group.id);
            await appDriver.joinGroupByLink(payerId, linkId);
            await appDriver.joinGroupByLink(payeeId, linkId);

            const settlementRequest = new CreateSettlementRequestBuilder()
                .withGroupId(group.id)
                .withPayerId(payerId)
                .withPayeeId(payeeId)
                .withAmount(100, 'USD')
                .build();

            const created = await appDriver.createSettlement(userId, settlementRequest);

            const result = await appDriver.deleteSettlement(userId, created.id);

            expect(result).toMatchObject({
                message: 'Settlement deleted successfully',
            });
        });

        it('should reject delete with invalid settlement ID', async () => {
            await expect(appDriver.deleteSettlement('test-user', '')).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'INVALID_SETTLEMENT_ID',
                }),
            );
        });

        it('should reject delete of non-existent settlement', async () => {
            await expect(appDriver.deleteSettlement('test-user', 'non-existent-settlement')).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.NOT_FOUND,
                }),
            );
        });

        it('should allow group admin to delete settlement created by another user', async () => {
            const adminId = 'admin-user';
            const creatorId = 'creator-user';
            const payerId = 'payer-user';
            const payeeId = 'payee-user';

            appDriver.seedUser(adminId, { displayName: 'Admin User' });
            appDriver.seedUser(creatorId, { displayName: 'Creator User' });
            appDriver.seedUser(payerId, { displayName: 'Payer' });
            appDriver.seedUser(payeeId, { displayName: 'Payee' });

            const group = await appDriver.createGroup(adminId);
            const { linkId } = await appDriver.generateShareableLink(adminId, group.id);
            await appDriver.joinGroupByLink(creatorId, linkId);
            await appDriver.joinGroupByLink(payerId, linkId);
            await appDriver.joinGroupByLink(payeeId, linkId);

            const settlementRequest = new CreateSettlementRequestBuilder()
                .withGroupId(group.id)
                .withPayerId(payerId)
                .withPayeeId(payeeId)
                .withAmount(100, 'USD')
                .build();

            const created = await appDriver.createSettlement(creatorId, settlementRequest);

            const result = await appDriver.deleteSettlement(adminId, created.id);

            expect(result).toMatchObject({
                message: 'Settlement deleted successfully',
            });
        });

        it('should reject delete when user is not a group member', async () => {
            const creatorId = 'creator-user';
            const nonMemberId = 'non-member-user';
            const payerId = 'payer-user';
            const payeeId = 'payee-user';

            appDriver.seedUser(creatorId, { displayName: 'Creator User' });
            appDriver.seedUser(nonMemberId, { displayName: 'Non-member User' });
            appDriver.seedUser(payerId, { displayName: 'Payer' });
            appDriver.seedUser(payeeId, { displayName: 'Payee' });

            const group = await appDriver.createGroup(creatorId);
            const { linkId } = await appDriver.generateShareableLink(creatorId, group.id);
            await appDriver.joinGroupByLink(payerId, linkId);
            await appDriver.joinGroupByLink(payeeId, linkId);

            const settlementRequest = new CreateSettlementRequestBuilder()
                .withGroupId(group.id)
                .withPayerId(payerId)
                .withPayeeId(payeeId)
                .withAmount(100, 'USD')
                .build();

            const created = await appDriver.createSettlement(creatorId, settlementRequest);

            await expect(appDriver.deleteSettlement(nonMemberId, created.id)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.FORBIDDEN,
                }),
            );
        });

        it('should reject delete by non-creator regular member', async () => {
            const creatorId = 'creator-user';
            const otherMemberId = 'other-member-user';
            const payerId = 'payer-user';
            const payeeId = 'payee-user';

            appDriver.seedUser(creatorId, { displayName: 'Creator User' });
            appDriver.seedUser(otherMemberId, { displayName: 'Other Member User' });
            appDriver.seedUser(payerId, { displayName: 'Payer' });
            appDriver.seedUser(payeeId, { displayName: 'Payee' });

            const group = await appDriver.createGroup(creatorId);
            const { linkId } = await appDriver.generateShareableLink(creatorId, group.id);
            await appDriver.joinGroupByLink(otherMemberId, linkId);
            await appDriver.joinGroupByLink(payerId, linkId);
            await appDriver.joinGroupByLink(payeeId, linkId);

            const settlementRequest = new CreateSettlementRequestBuilder()
                .withGroupId(group.id)
                .withPayerId(payerId)
                .withPayeeId(payeeId)
                .withAmount(100, 'USD')
                .build();

            const created = await appDriver.createSettlement(creatorId, settlementRequest);

            await expect(appDriver.deleteSettlement(otherMemberId, created.id)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.FORBIDDEN,
                }),
            );
        });

        it('should allow creator to delete their own settlement', async () => {
            const creatorId = 'creator-user';
            const payerId = 'payer-user';
            const payeeId = 'payee-user';

            appDriver.seedUser(creatorId, { displayName: 'Creator User' });
            appDriver.seedUser(payerId, { displayName: 'Payer' });
            appDriver.seedUser(payeeId, { displayName: 'Payee' });

            const group = await appDriver.createGroup(creatorId);
            const { linkId } = await appDriver.generateShareableLink(creatorId, group.id);
            await appDriver.joinGroupByLink(payerId, linkId);
            await appDriver.joinGroupByLink(payeeId, linkId);

            const settlementRequest = new CreateSettlementRequestBuilder()
                .withGroupId(group.id)
                .withPayerId(payerId)
                .withPayeeId(payeeId)
                .withAmount(100, 'USD')
                .build();

            const created = await appDriver.createSettlement(creatorId, settlementRequest);

            const result = await appDriver.deleteSettlement(creatorId, created.id);

            expect(result).toMatchObject({
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
