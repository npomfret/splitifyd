import { StubCloudTasksClient, StubStorage } from '@billsplit-wl/firebase-simulator';
import { toCurrencyISOCode, USD } from '@billsplit-wl/shared';
import { CreateGroupRequestBuilder, CreateSettlementRequestBuilder, SettlementUpdateBuilder, StubFirestoreDatabase, UserRegistrationBuilder } from '@billsplit-wl/test-support';
import { beforeEach, describe, expect, it } from 'vitest';
import { HTTP_STATUS } from '../../../constants';
import { ComponentBuilder } from '../../../services/ComponentBuilder';
import { SettlementHandlers } from '../../../settlements/SettlementHandlers';
import { createUnitTestServiceConfig } from '../../test-config';
import { AppDriver } from '../AppDriver';
import { StubAuthService } from '../mocks/StubAuthService';

describe('SettlementHandlers - Unit Tests', () => {
    let appDriver: AppDriver;

    beforeEach(() => {
        appDriver = new AppDriver();
    });

    describe('createSettlement', () => {
        it('should create a settlement successfully with valid data', async () => {
            // Register users via API
            const userReg = new UserRegistrationBuilder()
                .withEmail('testuser@example.com')
                .withDisplayName('Test User')
                .withPassword('password12345')
                .build();
            const userResult = await appDriver.registerUser(userReg);
            const userId = userResult.user.uid;

            const payerReg = new UserRegistrationBuilder()
                .withEmail('payer@example.com')
                .withDisplayName('Payer')
                .withPassword('password12345')
                .build();
            const payerResult = await appDriver.registerUser(payerReg);
            const payerId = payerResult.user.uid;

            const payeeReg = new UserRegistrationBuilder()
                .withEmail('payee@example.com')
                .withDisplayName('Payee')
                .withPassword('password12345')
                .build();
            const payeeResult = await appDriver.registerUser(payeeReg);
            const payeeId = payeeResult.user.uid;

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), userId);
            const { shareToken } = await appDriver.generateShareableLink(group.id, undefined, userId);
            await appDriver.joinGroupByLink(shareToken, undefined, payerId);
            await appDriver.joinGroupByLink(shareToken, undefined, payeeId);

            const settlementRequest = new CreateSettlementRequestBuilder()
                .withGroupId(group.id)
                .withPayerId(payerId)
                .withPayeeId(payeeId)
                .withAmount(100.50, 'USD')
                .withNote('Test settlement')
                .build();

            const result = await appDriver.createSettlement(settlementRequest, userId);

            expect(result).toMatchObject({
                id: expect.any(String),
                groupId: group.id,
                payerId,
                payeeId,
                amount: '100.5',
                currency: USD,
                note: 'Test settlement',
            });
        });

        it('sanitizes settlement notes before persisting', async () => {
            // Register users via API
            const userReg = new UserRegistrationBuilder()
                .withEmail('testuser@example.com')
                .withDisplayName('Test User')
                .withPassword('password12345')
                .build();
            const userResult = await appDriver.registerUser(userReg);
            const userId = userResult.user.uid;

            const payerReg = new UserRegistrationBuilder()
                .withEmail('payer@example.com')
                .withDisplayName('Payer')
                .withPassword('password12345')
                .build();
            const payerResult = await appDriver.registerUser(payerReg);
            const payerId = payerResult.user.uid;

            const payeeReg = new UserRegistrationBuilder()
                .withEmail('payee@example.com')
                .withDisplayName('Payee')
                .withPassword('password12345')
                .build();
            const payeeResult = await appDriver.registerUser(payeeReg);
            const payeeId = payeeResult.user.uid;

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), userId);
            const { shareToken } = await appDriver.generateShareableLink(group.id, undefined, userId);
            await appDriver.joinGroupByLink(shareToken, undefined, payerId);
            await appDriver.joinGroupByLink(shareToken, undefined, payeeId);

            const settlementRequest = new CreateSettlementRequestBuilder()
                .withGroupId(group.id)
                .withPayerId(payerId)
                .withPayeeId(payeeId)
                .withAmount(75, 'USD')
                .withNote('Paid<script>alert(1)</script>')
                .build();

            const result = await appDriver.createSettlement(settlementRequest, userId);

            expect(result.note).toBe('Paid');
        });

        it('should create a settlement without optional note', async () => {
            // Register users via API
            const userReg = new UserRegistrationBuilder()
                .withEmail('testuser@example.com')
                .withDisplayName('Test User')
                .withPassword('password12345')
                .build();
            const userResult = await appDriver.registerUser(userReg);
            const userId = userResult.user.uid;

            const payerReg = new UserRegistrationBuilder()
                .withEmail('payer@example.com')
                .withDisplayName('Payer')
                .withPassword('password12345')
                .build();
            const payerResult = await appDriver.registerUser(payerReg);
            const payerId = payerResult.user.uid;

            const payeeReg = new UserRegistrationBuilder()
                .withEmail('payee@example.com')
                .withDisplayName('Payee')
                .withPassword('password12345')
                .build();
            const payeeResult = await appDriver.registerUser(payeeReg);
            const payeeId = payeeResult.user.uid;

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), userId);
            const { shareToken } = await appDriver.generateShareableLink(group.id, undefined, userId);
            await appDriver.joinGroupByLink(shareToken, undefined, payerId);
            await appDriver.joinGroupByLink(shareToken, undefined, payeeId);

            const settlementRequest = new CreateSettlementRequestBuilder()
                .withGroupId(group.id)
                .withPayerId(payerId)
                .withPayeeId(payeeId)
                .withAmount(50.00, 'USD')
                .withoutNote()
                .build();

            const result = await appDriver.createSettlement(settlementRequest, userId);

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

            await expect(appDriver.createSettlement(invalidRequest, 'test-user')).rejects.toThrow(
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

            await expect(appDriver.createSettlement(invalidRequest, 'test-user')).rejects.toThrow(
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

            await expect(appDriver.createSettlement(invalidRequest, 'test-user')).rejects.toThrow(
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

            await expect(appDriver.createSettlement(invalidRequest, 'test-user')).rejects.toThrow(
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

            await expect(appDriver.createSettlement(invalidRequest, 'test-user')).rejects.toThrow(
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

            await expect(appDriver.createSettlement(invalidRequest, 'test-user')).rejects.toThrow(
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

            await expect(appDriver.createSettlement(invalidRequest, 'test-user')).rejects.toThrow(
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

            await expect(appDriver.createSettlement(invalidRequest, 'test-user')).rejects.toThrow(
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

            await expect(appDriver.createSettlement(invalidRequest, 'test-user')).rejects.toThrow(
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

            await expect(appDriver.createSettlement(invalidRequest, 'test-user')).rejects.toThrow(
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

            await expect(appDriver.createSettlement(invalidRequest, 'test-user')).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'VALIDATION_ERROR',
                }),
            );
        });

        it('should reject settlement for non-existent group', async () => {
            // Register user via API
            const userReg = new UserRegistrationBuilder()
                .withEmail('nonexistent@example.com')
                .withDisplayName('Test User')
                .withPassword('password12345')
                .build();
            const userResult = await appDriver.registerUser(userReg);
            const userId = userResult.user.uid;

            const settlementRequest = new CreateSettlementRequestBuilder()
                .withGroupId('non-existent-group')
                .withPayerId('payer')
                .withPayeeId('payee')
                .withAmount(100, 'USD')
                .build();

            await expect(appDriver.createSettlement(settlementRequest, userId)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.NOT_FOUND,
                }),
            );
        });

        it('should reject settlement when creator is not a group member', async () => {
            // Register users via API
            const creatorReg = new UserRegistrationBuilder()
                .withEmail('creator@example.com')
                .withDisplayName('Creator User')
                .withPassword('password12345')
                .build();
            const creatorResult = await appDriver.registerUser(creatorReg);
            const creatorId = creatorResult.user.uid;

            const nonMemberReg = new UserRegistrationBuilder()
                .withEmail('nonmember@example.com')
                .withDisplayName('Non Member User')
                .withPassword('password12345')
                .build();
            const nonMemberResult = await appDriver.registerUser(nonMemberReg);
            const nonMemberId = nonMemberResult.user.uid;

            const payerReg = new UserRegistrationBuilder()
                .withEmail('payer2@example.com')
                .withDisplayName('Payer User')
                .withPassword('password12345')
                .build();
            const payerResult = await appDriver.registerUser(payerReg);
            const payerId = payerResult.user.uid;

            const payeeReg = new UserRegistrationBuilder()
                .withEmail('payee2@example.com')
                .withDisplayName('Payee User')
                .withPassword('password12345')
                .build();
            const payeeResult = await appDriver.registerUser(payeeReg);
            const payeeId = payeeResult.user.uid;

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), creatorId);
            const { shareToken } = await appDriver.generateShareableLink(group.id, undefined, creatorId);
            await appDriver.joinGroupByLink(shareToken, undefined, payerId);
            await appDriver.joinGroupByLink(shareToken, undefined, payeeId);

            const settlementRequest = new CreateSettlementRequestBuilder()
                .withGroupId(group.id)
                .withPayerId(payerId)
                .withPayeeId(payeeId)
                .withAmount(100, 'USD')
                .build();

            await expect(appDriver.createSettlement(settlementRequest, nonMemberId)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.FORBIDDEN,
                }),
            );
        });

        it('should reject settlement when payer is not a group member', async () => {
            // Register users via API
            const userReg = new UserRegistrationBuilder()
                .withEmail('user3@example.com')
                .withDisplayName('Test User')
                .withPassword('password12345')
                .build();
            const userResult = await appDriver.registerUser(userReg);
            const userId = userResult.user.uid;

            const nonMemberPayerReg = new UserRegistrationBuilder()
                .withEmail('nonmemberpayer@example.com')
                .withDisplayName('Non Member')
                .withPassword('password12345')
                .build();
            await appDriver.registerUser(nonMemberPayerReg);

            const payeeReg = new UserRegistrationBuilder()
                .withEmail('payee3@example.com')
                .withDisplayName('Payee User')
                .withPassword('password12345')
                .build();
            const payeeResult = await appDriver.registerUser(payeeReg);
            const payeeId = payeeResult.user.uid;

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), userId);
            const { shareToken } = await appDriver.generateShareableLink(group.id, undefined, userId);
            await appDriver.joinGroupByLink(shareToken, undefined, payeeId);

            const settlementRequest = new CreateSettlementRequestBuilder()
                .withGroupId(group.id)
                .withPayerId('non-member-payer')
                .withPayeeId(payeeId)
                .withAmount(100, 'USD')
                .build();

            await expect(appDriver.createSettlement(settlementRequest, userId)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                }),
            );
        });

        it('should reject settlement when payee is not a group member', async () => {
            // Register users via API
            const userReg = new UserRegistrationBuilder()
                .withEmail('user4@example.com')
                .withDisplayName('Test User')
                .withPassword('password12345')
                .build();
            const userResult = await appDriver.registerUser(userReg);
            const userId = userResult.user.uid;

            const payerReg = new UserRegistrationBuilder()
                .withEmail('payer4@example.com')
                .withDisplayName('Payer User')
                .withPassword('password12345')
                .build();
            const payerResult = await appDriver.registerUser(payerReg);
            const payerId = payerResult.user.uid;

            const nonMemberPayeeReg = new UserRegistrationBuilder()
                .withEmail('nonmemberpayee@example.com')
                .withDisplayName('Non Member')
                .withPassword('password12345')
                .build();
            await appDriver.registerUser(nonMemberPayeeReg);

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), userId);
            const { shareToken } = await appDriver.generateShareableLink(group.id, undefined, userId);
            await appDriver.joinGroupByLink(shareToken, undefined, payerId);

            const settlementRequest = new CreateSettlementRequestBuilder()
                .withGroupId(group.id)
                .withPayerId(payerId)
                .withPayeeId('non-member-payee')
                .withAmount(100, 'USD')
                .build();

            await expect(appDriver.createSettlement(settlementRequest, userId)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                }),
            );
        });
    });

    describe('updateSettlement', () => {
        it('should update settlement amount successfully', async () => {
            // Register users via API
            const userReg = new UserRegistrationBuilder()
                .withEmail('testuser@example.com')
                .withDisplayName('Test User')
                .withPassword('password12345')
                .build();
            const userResult = await appDriver.registerUser(userReg);
            const userId = userResult.user.uid;

            const payerReg = new UserRegistrationBuilder()
                .withEmail('payer@example.com')
                .withDisplayName('Payer')
                .withPassword('password12345')
                .build();
            const payerResult = await appDriver.registerUser(payerReg);
            const payerId = payerResult.user.uid;

            const payeeReg = new UserRegistrationBuilder()
                .withEmail('payee@example.com')
                .withDisplayName('Payee')
                .withPassword('password12345')
                .build();
            const payeeResult = await appDriver.registerUser(payeeReg);
            const payeeId = payeeResult.user.uid;

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), userId);
            const { shareToken } = await appDriver.generateShareableLink(group.id, undefined, userId);
            await appDriver.joinGroupByLink(shareToken, undefined, payerId);
            await appDriver.joinGroupByLink(shareToken, undefined, payeeId);

            const settlementRequest = new CreateSettlementRequestBuilder()
                .withGroupId(group.id)
                .withPayerId(payerId)
                .withPayeeId(payeeId)
                .withAmount(100, 'USD')
                .build();

            const created = await appDriver.createSettlement(settlementRequest, userId);

            const updateRequest = new SettlementUpdateBuilder()
                .withAmount(150.75, 'USD')
                .build();

            // Update creates new settlement with new ID (edit history via soft deletes)
            const updatedSettlement = await appDriver.updateSettlement(created.id, updateRequest, userId);

            // Verify the update persisted using the NEW settlement ID
            const fullDetails = await appDriver.getGroupFullDetails(group.id, {}, userId);
            const updated = fullDetails.settlements.settlements.find((s: any) => s.id === updatedSettlement.id);
            expect(updated?.amount).toBe('150.75');
        });

        it('should update settlement note successfully', async () => {
            // Register users via API
            const userReg = new UserRegistrationBuilder()
                .withEmail('testuser@example.com')
                .withDisplayName('Test User')
                .withPassword('password12345')
                .build();
            const userResult = await appDriver.registerUser(userReg);
            const userId = userResult.user.uid;

            const payerReg = new UserRegistrationBuilder()
                .withEmail('payer@example.com')
                .withDisplayName('Payer')
                .withPassword('password12345')
                .build();
            const payerResult = await appDriver.registerUser(payerReg);
            const payerId = payerResult.user.uid;

            const payeeReg = new UserRegistrationBuilder()
                .withEmail('payee@example.com')
                .withDisplayName('Payee')
                .withPassword('password12345')
                .build();
            const payeeResult = await appDriver.registerUser(payeeReg);
            const payeeId = payeeResult.user.uid;

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), userId);
            const { shareToken } = await appDriver.generateShareableLink(group.id, undefined, userId);
            await appDriver.joinGroupByLink(shareToken, undefined, payerId);
            await appDriver.joinGroupByLink(shareToken, undefined, payeeId);

            const settlementRequest = new CreateSettlementRequestBuilder()
                .withGroupId(group.id)
                .withPayerId(payerId)
                .withPayeeId(payeeId)
                .withAmount(100, 'USD')
                .withNote('Old note')
                .build();

            const created = await appDriver.createSettlement(settlementRequest, userId);

            const updateRequest = new SettlementUpdateBuilder()
                .withNote('Updated note')
                .build();

            // Update creates new settlement with new ID (edit history via soft deletes)
            const updatedSettlement = await appDriver.updateSettlement(created.id, updateRequest, userId);

            // Verify the update persisted using the NEW settlement ID
            const fullDetails = await appDriver.getGroupFullDetails(group.id, {}, userId);
            const updated = fullDetails.settlements.settlements.find((s: any) => s.id === updatedSettlement.id);
            expect(updated?.note).toBe('Updated note');
        });

        it('sanitizes settlement note updates before persisting', async () => {
            // Register users via API
            const userReg = new UserRegistrationBuilder()
                .withEmail('testuser@example.com')
                .withDisplayName('Test User')
                .withPassword('password12345')
                .build();
            const userResult = await appDriver.registerUser(userReg);
            const userId = userResult.user.uid;

            const payerReg = new UserRegistrationBuilder()
                .withEmail('payer@example.com')
                .withDisplayName('Payer')
                .withPassword('password12345')
                .build();
            const payerResult = await appDriver.registerUser(payerReg);
            const payerId = payerResult.user.uid;

            const payeeReg = new UserRegistrationBuilder()
                .withEmail('payee@example.com')
                .withDisplayName('Payee')
                .withPassword('password12345')
                .build();
            const payeeResult = await appDriver.registerUser(payeeReg);
            const payeeId = payeeResult.user.uid;

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), userId);
            const { shareToken } = await appDriver.generateShareableLink(group.id, undefined, userId);
            await appDriver.joinGroupByLink(shareToken, undefined, payerId);
            await appDriver.joinGroupByLink(shareToken, undefined, payeeId);

            const settlementRequest = new CreateSettlementRequestBuilder()
                .withGroupId(group.id)
                .withPayerId(payerId)
                .withPayeeId(payeeId)
                .withAmount(100, 'USD')
                .withNote('Initial note')
                .build();

            const created = await appDriver.createSettlement(settlementRequest, userId);

            const updateRequest = new SettlementUpdateBuilder()
                .withNote('Updated<script>alert(1)</script>')
                .build();

            // Update creates new settlement with new ID (edit history via soft deletes)
            const updatedSettlement = await appDriver.updateSettlement(created.id, updateRequest, userId);

            const result = await appDriver.getSettlement(group.id, updatedSettlement.id, userId);
            expect(result.note).toBe('Updated');
        });

        it('should reject update with invalid settlement ID', async () => {
            const updateRequest = SettlementUpdateBuilder.empty()
                .withAmount(150, 'USD')
                .build();

            await expect(appDriver.updateSettlement('', updateRequest, 'test-user')).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'INVALID_SETTLEMENT_ID',
                }),
            );
        });

        it('should reject update with no fields provided', async () => {
            const updateRequest = SettlementUpdateBuilder.empty().build();

            await expect(appDriver.updateSettlement('test-settlement', updateRequest, 'test-user')).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'VALIDATION_ERROR',
                }),
            );
        });

        it('should reject update with invalid amount precision when currency provided', async () => {
            const updateRequest = SettlementUpdateBuilder.empty()
                .withAmount(100.50, toCurrencyISOCode('JPY'))
                .build();

            await expect(appDriver.updateSettlement('test-settlement', updateRequest, 'test-user')).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'VALIDATION_ERROR',
                }),
            );
        });

        it('should reject update of non-existent settlement', async () => {
            // Register user via API
            const userReg = new UserRegistrationBuilder()
                .withEmail('updatenonexist@example.com')
                .withDisplayName('Test User')
                .withPassword('password12345')
                .build();
            const userResult = await appDriver.registerUser(userReg);
            const userId = userResult.user.uid;

            // Currency is required when updating amount
            const updateRequest = SettlementUpdateBuilder.empty()
                .withAmount(150, 'USD')
                .build();

            await expect(appDriver.updateSettlement('non-existent-settlement', updateRequest, userId)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.NOT_FOUND,
                }),
            );
        });

        it('should reject update when user is not a group member', async () => {
            // Register users via API
            const creatorReg = new UserRegistrationBuilder()
                .withEmail('creator2@example.com')
                .withDisplayName('Creator User')
                .withPassword('password12345')
                .build();
            const creatorResult = await appDriver.registerUser(creatorReg);
            const creatorId = creatorResult.user.uid;

            const nonMemberReg = new UserRegistrationBuilder()
                .withEmail('nonmember2@example.com')
                .withDisplayName('Non Member User')
                .withPassword('password12345')
                .build();
            const nonMemberResult = await appDriver.registerUser(nonMemberReg);
            const nonMemberId = nonMemberResult.user.uid;

            const payerReg = new UserRegistrationBuilder()
                .withEmail('payer5@example.com')
                .withDisplayName('Payer User')
                .withPassword('password12345')
                .build();
            const payerResult = await appDriver.registerUser(payerReg);
            const payerId = payerResult.user.uid;

            const payeeReg = new UserRegistrationBuilder()
                .withEmail('payee5@example.com')
                .withDisplayName('Payee User')
                .withPassword('password12345')
                .build();
            const payeeResult = await appDriver.registerUser(payeeReg);
            const payeeId = payeeResult.user.uid;

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), creatorId);
            const { shareToken } = await appDriver.generateShareableLink(group.id, undefined, creatorId);
            await appDriver.joinGroupByLink(shareToken, undefined, payerId);
            await appDriver.joinGroupByLink(shareToken, undefined, payeeId);

            const settlementRequest = new CreateSettlementRequestBuilder()
                .withGroupId(group.id)
                .withPayerId(payerId)
                .withPayeeId(payeeId)
                .withAmount(100, 'USD')
                .build();

            const created = await appDriver.createSettlement(settlementRequest, creatorId);

            const updateRequest = new SettlementUpdateBuilder()
                .withAmount(150, 'USD')
                .build();

            await expect(appDriver.updateSettlement(created.id, updateRequest, nonMemberId)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.FORBIDDEN,
                }),
            );
        });

        it('should reject update by non-creator even if admin', async () => {
            // Register users via API
            const adminReg = new UserRegistrationBuilder()
                .withEmail('admin@example.com')
                .withDisplayName('Admin User')
                .withPassword('password12345')
                .build();
            const adminResult = await appDriver.registerUser(adminReg);
            const adminId = adminResult.user.uid;

            const creatorReg = new UserRegistrationBuilder()
                .withEmail('creator3@example.com')
                .withDisplayName('Creator User')
                .withPassword('password12345')
                .build();
            const creatorResult = await appDriver.registerUser(creatorReg);
            const creatorId = creatorResult.user.uid;

            const payerReg = new UserRegistrationBuilder()
                .withEmail('payer6@example.com')
                .withDisplayName('Payer')
                .withPassword('password12345')
                .build();
            const payerResult = await appDriver.registerUser(payerReg);
            const payerId = payerResult.user.uid;

            const payeeReg = new UserRegistrationBuilder()
                .withEmail('payee6@example.com')
                .withDisplayName('Payee')
                .withPassword('password12345')
                .build();
            const payeeResult = await appDriver.registerUser(payeeReg);
            const payeeId = payeeResult.user.uid;

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), adminId);
            const { shareToken } = await appDriver.generateShareableLink(group.id, undefined, adminId);
            await appDriver.joinGroupByLink(shareToken, undefined, creatorId);
            await appDriver.joinGroupByLink(shareToken, undefined, payerId);
            await appDriver.joinGroupByLink(shareToken, undefined, payeeId);

            const settlementRequest = new CreateSettlementRequestBuilder()
                .withGroupId(group.id)
                .withPayerId(payerId)
                .withPayeeId(payeeId)
                .withAmount(100, 'USD')
                .build();

            const created = await appDriver.createSettlement(settlementRequest, creatorId);

            const updateRequest = new SettlementUpdateBuilder()
                .withAmount(200.50, 'USD')
                .build();

            await expect(appDriver.updateSettlement(created.id, updateRequest, adminId)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.FORBIDDEN,
                }),
            );
        });

        it('should reject update with zero amount', async () => {
            const updateRequest = SettlementUpdateBuilder.empty()
                .withInvalidAmount('0')
                .build();

            await expect(appDriver.updateSettlement('test-settlement', updateRequest, 'test-user')).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'VALIDATION_ERROR',
                }),
            );
        });

        it('should reject update with negative amount', async () => {
            const updateRequest = SettlementUpdateBuilder.empty()
                .withInvalidAmount('-50')
                .build();

            await expect(appDriver.updateSettlement('test-settlement', updateRequest, 'test-user')).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'VALIDATION_ERROR',
                }),
            );
        });

        it('should reject update with excessively long note', async () => {
            const longNote = 'a'.repeat(501);
            const updateRequest = SettlementUpdateBuilder.empty()
                .withInvalidNote(longNote)
                .build();

            await expect(appDriver.updateSettlement('test-settlement', updateRequest, 'test-user')).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'VALIDATION_ERROR',
                }),
            );
        });
    });

    describe('deleteSettlement', () => {
        it('should soft delete settlement successfully', async () => {
            // Register users via API
            const userReg = new UserRegistrationBuilder()
                .withEmail('testuser@example.com')
                .withDisplayName('Test User')
                .withPassword('password12345')
                .build();
            const userResult = await appDriver.registerUser(userReg);
            const userId = userResult.user.uid;

            const payerReg = new UserRegistrationBuilder()
                .withEmail('payer@example.com')
                .withDisplayName('Payer')
                .withPassword('password12345')
                .build();
            const payerResult = await appDriver.registerUser(payerReg);
            const payerId = payerResult.user.uid;

            const payeeReg = new UserRegistrationBuilder()
                .withEmail('payee@example.com')
                .withDisplayName('Payee')
                .withPassword('password12345')
                .build();
            const payeeResult = await appDriver.registerUser(payeeReg);
            const payeeId = payeeResult.user.uid;

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), userId);
            const { shareToken } = await appDriver.generateShareableLink(group.id, undefined, userId);
            await appDriver.joinGroupByLink(shareToken, undefined, payerId);
            await appDriver.joinGroupByLink(shareToken, undefined, payeeId);

            const settlementRequest = new CreateSettlementRequestBuilder()
                .withGroupId(group.id)
                .withPayerId(payerId)
                .withPayeeId(payeeId)
                .withAmount(100, 'USD')
                .build();

            const created = await appDriver.createSettlement(settlementRequest, userId);

            // Returns 204 No Content
            await appDriver.deleteSettlement(created.id, userId);
        });

        it('should reject delete with invalid settlement ID', async () => {
            await expect(appDriver.deleteSettlement('', 'test-user')).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'INVALID_SETTLEMENT_ID',
                }),
            );
        });

        it('should reject delete of non-existent settlement', async () => {
            await expect(appDriver.deleteSettlement('non-existent-settlement', 'test-user')).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.NOT_FOUND,
                }),
            );
        });

        it('should allow group admin to delete settlement created by another user', async () => {
            // Register users via API
            const adminReg = new UserRegistrationBuilder()
                .withEmail('admin@example.com')
                .withDisplayName('Admin User')
                .withPassword('password12345')
                .build();
            const adminResult = await appDriver.registerUser(adminReg);
            const adminId = adminResult.user.uid;

            const creatorReg = new UserRegistrationBuilder()
                .withEmail('creator3@example.com')
                .withDisplayName('Creator User')
                .withPassword('password12345')
                .build();
            const creatorResult = await appDriver.registerUser(creatorReg);
            const creatorId = creatorResult.user.uid;

            const payerReg = new UserRegistrationBuilder()
                .withEmail('payer6@example.com')
                .withDisplayName('Payer')
                .withPassword('password12345')
                .build();
            const payerResult = await appDriver.registerUser(payerReg);
            const payerId = payerResult.user.uid;

            const payeeReg = new UserRegistrationBuilder()
                .withEmail('payee6@example.com')
                .withDisplayName('Payee')
                .withPassword('password12345')
                .build();
            const payeeResult = await appDriver.registerUser(payeeReg);
            const payeeId = payeeResult.user.uid;

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), adminId);
            const { shareToken } = await appDriver.generateShareableLink(group.id, undefined, adminId);
            await appDriver.joinGroupByLink(shareToken, undefined, creatorId);
            await appDriver.joinGroupByLink(shareToken, undefined, payerId);
            await appDriver.joinGroupByLink(shareToken, undefined, payeeId);

            const settlementRequest = new CreateSettlementRequestBuilder()
                .withGroupId(group.id)
                .withPayerId(payerId)
                .withPayeeId(payeeId)
                .withAmount(100, 'USD')
                .build();

            const created = await appDriver.createSettlement(settlementRequest, creatorId);

            // Returns 204 No Content
            await appDriver.deleteSettlement(created.id, adminId);
        });

        it('should reject delete when user is not a group member', async () => {
            // Register users via API
            const creatorReg = new UserRegistrationBuilder()
                .withEmail('creator4@example.com')
                .withDisplayName('Creator User')
                .withPassword('password12345')
                .build();
            const creatorResult = await appDriver.registerUser(creatorReg);
            const creatorId = creatorResult.user.uid;

            const nonMemberReg = new UserRegistrationBuilder()
                .withEmail('nonmember3@example.com')
                .withDisplayName('Non-member User')
                .withPassword('password12345')
                .build();
            const nonMemberResult = await appDriver.registerUser(nonMemberReg);
            const nonMemberId = nonMemberResult.user.uid;

            const payerReg = new UserRegistrationBuilder()
                .withEmail('payer7@example.com')
                .withDisplayName('Payer')
                .withPassword('password12345')
                .build();
            const payerResult = await appDriver.registerUser(payerReg);
            const payerId = payerResult.user.uid;

            const payeeReg = new UserRegistrationBuilder()
                .withEmail('payee7@example.com')
                .withDisplayName('Payee')
                .withPassword('password12345')
                .build();
            const payeeResult = await appDriver.registerUser(payeeReg);
            const payeeId = payeeResult.user.uid;

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), creatorId);
            const { shareToken } = await appDriver.generateShareableLink(group.id, undefined, creatorId);
            await appDriver.joinGroupByLink(shareToken, undefined, payerId);
            await appDriver.joinGroupByLink(shareToken, undefined, payeeId);

            const settlementRequest = new CreateSettlementRequestBuilder()
                .withGroupId(group.id)
                .withPayerId(payerId)
                .withPayeeId(payeeId)
                .withAmount(100, 'USD')
                .build();

            const created = await appDriver.createSettlement(settlementRequest, creatorId);

            await expect(appDriver.deleteSettlement(created.id, nonMemberId)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.FORBIDDEN,
                }),
            );
        });

        it('should reject delete by non-creator regular member', async () => {
            // Register users via API
            const creatorReg = new UserRegistrationBuilder()
                .withEmail('creator6@example.com')
                .withDisplayName('Creator User')
                .withPassword('password12345')
                .build();
            const creatorResult = await appDriver.registerUser(creatorReg);
            const creatorId = creatorResult.user.uid;

            const otherMemberReg = new UserRegistrationBuilder()
                .withEmail('othermember2@example.com')
                .withDisplayName('Other Member User')
                .withPassword('password12345')
                .build();
            const otherMemberResult = await appDriver.registerUser(otherMemberReg);
            const otherMemberId = otherMemberResult.user.uid;

            const payerReg = new UserRegistrationBuilder()
                .withEmail('payer9@example.com')
                .withDisplayName('Payer')
                .withPassword('password12345')
                .build();
            const payerResult = await appDriver.registerUser(payerReg);
            const payerId = payerResult.user.uid;

            const payeeReg = new UserRegistrationBuilder()
                .withEmail('payee9@example.com')
                .withDisplayName('Payee')
                .withPassword('password12345')
                .build();
            const payeeResult = await appDriver.registerUser(payeeReg);
            const payeeId = payeeResult.user.uid;

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), creatorId);
            const { shareToken } = await appDriver.generateShareableLink(group.id, undefined, creatorId);
            await appDriver.joinGroupByLink(shareToken, undefined, otherMemberId);
            await appDriver.joinGroupByLink(shareToken, undefined, payerId);
            await appDriver.joinGroupByLink(shareToken, undefined, payeeId);

            const settlementRequest = new CreateSettlementRequestBuilder()
                .withGroupId(group.id)
                .withPayerId(payerId)
                .withPayeeId(payeeId)
                .withAmount(100, 'USD')
                .build();

            const created = await appDriver.createSettlement(settlementRequest, creatorId);

            await expect(appDriver.deleteSettlement(created.id, otherMemberId)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.FORBIDDEN,
                }),
            );
        });

        it('should allow creator to delete their own settlement', async () => {
            // Register users via API
            const creatorReg = new UserRegistrationBuilder()
                .withEmail('creator7@example.com')
                .withDisplayName('Creator User')
                .withPassword('password12345')
                .build();
            const creatorResult = await appDriver.registerUser(creatorReg);
            const creatorId = creatorResult.user.uid;

            const payerReg = new UserRegistrationBuilder()
                .withEmail('payer10@example.com')
                .withDisplayName('Payer')
                .withPassword('password12345')
                .build();
            const payerResult = await appDriver.registerUser(payerReg);
            const payerId = payerResult.user.uid;

            const payeeReg = new UserRegistrationBuilder()
                .withEmail('payee10@example.com')
                .withDisplayName('Payee')
                .withPassword('password12345')
                .build();
            const payeeResult = await appDriver.registerUser(payeeReg);
            const payeeId = payeeResult.user.uid;

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), creatorId);
            const { shareToken } = await appDriver.generateShareableLink(group.id, undefined, creatorId);
            await appDriver.joinGroupByLink(shareToken, undefined, payerId);
            await appDriver.joinGroupByLink(shareToken, undefined, payeeId);

            const settlementRequest = new CreateSettlementRequestBuilder()
                .withGroupId(group.id)
                .withPayerId(payerId)
                .withPayeeId(payeeId)
                .withAmount(100, 'USD')
                .build();

            const created = await appDriver.createSettlement(settlementRequest, creatorId);

            // Returns 204 No Content
            await appDriver.deleteSettlement(created.id, creatorId);
        });
    });

    describe('Static Factory Method', () => {
        it('should create SettlementHandlers instance with SettlementService', () => {
            const db = new StubFirestoreDatabase();
            const authService = new StubAuthService();
            const componentBuilder = new ComponentBuilder(
                authService,
                db,
                new StubStorage({ defaultBucketName: 'test-bucket' }),
                new StubCloudTasksClient(),
                createUnitTestServiceConfig(),
            );
            const handlers = new SettlementHandlers(componentBuilder.buildSettlementService());
            expect(handlers).toBeInstanceOf(SettlementHandlers);
            expect(handlers.createSettlement).toBeDefined();
            expect(handlers.updateSettlement).toBeDefined();
            expect(handlers.deleteSettlement).toBeDefined();
        });
    });
});
