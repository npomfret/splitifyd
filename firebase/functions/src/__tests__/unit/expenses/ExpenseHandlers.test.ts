import type { UpdateExpenseRequest } from '@splitifyd/shared';
import { CreateExpenseRequestBuilder, ExpenseDTOBuilder, StubFirestoreDatabase, createStubRequest, createStubResponse } from '@splitifyd/test-support';
import { beforeEach, describe, expect, it } from 'vitest';
import { HTTP_STATUS } from '../../../constants';
import { ExpenseHandlers } from '../../../expenses/ExpenseHandlers';
import { ApplicationBuilder } from '../../../services/ApplicationBuilder';
import { FirestoreReader, FirestoreWriter } from '../../../services/firestore';
import { GroupMemberDocumentBuilder } from '../../support/GroupMemberDocumentBuilder';
import { StubAuthService } from '../mocks/firestore-stubs';

describe('ExpenseHandlers - Unit Tests', () => {
    let expenseHandlers: ExpenseHandlers;
    let db: StubFirestoreDatabase;
    let stubAuth: StubAuthService;

    beforeEach(() => {
        db = new StubFirestoreDatabase();
        stubAuth = new StubAuthService();

        const firestoreReader = new FirestoreReader(db);
        const firestoreWriter = new FirestoreWriter(db);
        const applicationBuilder = new ApplicationBuilder(firestoreReader, firestoreWriter, stubAuth);

        expenseHandlers = new ExpenseHandlers(applicationBuilder.buildExpenseService());
    });

    describe('createExpense', () => {
        it('should create an expense successfully with valid data', async () => {
            const groupId = 'test-group';
            const userId = 'test-user';
            const payerId = 'payer-user';

            db.seedUser(userId, {});
            db.seedUser(payerId, {});
            db.seedGroup(groupId, { createdBy: userId });
            db.initializeGroupBalance(groupId);

            db.seedGroupMember(groupId, userId, new GroupMemberDocumentBuilder().withUserId(userId).withGroupId(groupId).buildDocument());
            db.seedGroupMember(groupId, payerId, new GroupMemberDocumentBuilder().withUserId(payerId).withGroupId(groupId).buildDocument());

            const expenseRequest = new CreateExpenseRequestBuilder()
                .withGroupId(groupId)
                .withPaidBy(payerId)
                .withParticipants([userId, payerId])
                .build();

            const req = createStubRequest(userId, expenseRequest);
            const res = createStubResponse();

            await expenseHandlers.createExpense(req, res);

            expect((res as any).getStatus()).toBe(HTTP_STATUS.CREATED);
            const json = (res as any).getJson();
            expect(json).toMatchObject({
                id: expect.any(String),
                groupId,
                paidBy: payerId,
            });
        });

        it('should create expense with receipt URL', async () => {
            const groupId = 'test-group';
            const userId = 'test-user';

            db.seedUser(userId, {});
            db.seedGroup(groupId, { createdBy: userId });
            db.initializeGroupBalance(groupId);

            db.seedGroupMember(groupId, userId, new GroupMemberDocumentBuilder().withUserId(userId).withGroupId(groupId).buildDocument());

            const expenseRequest = new CreateExpenseRequestBuilder()
                .withGroupId(groupId)
                .withPaidBy(userId)
                .withParticipants([userId])
                .withReceiptUrl('https://example.com/receipt.jpg')
                .build();

            const req = createStubRequest(userId, expenseRequest);
            const res = createStubResponse();

            await expenseHandlers.createExpense(req, res);

            expect((res as any).getStatus()).toBe(HTTP_STATUS.CREATED);
            const json = (res as any).getJson();
            expect(json.receiptUrl).toBe('https://example.com/receipt.jpg');
        });

        it('should reject expense with missing group ID', async () => {
            const userId = 'test-user';
            const expenseRequest = new CreateExpenseRequestBuilder().build();
            (expenseRequest as any).groupId = '';

            const req = createStubRequest(userId, expenseRequest);
            const res = createStubResponse();

            await expect(expenseHandlers.createExpense(req, res)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'MISSING_GROUP_ID',
                }),
            );
        });

        it('should reject expense with missing payer', async () => {
            const userId = 'test-user';
            const expenseRequest = new CreateExpenseRequestBuilder().build();
            (expenseRequest as any).paidBy = '';

            const req = createStubRequest(userId, expenseRequest);
            const res = createStubResponse();

            await expect(expenseHandlers.createExpense(req, res)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'MISSING_PAYER',
                }),
            );
        });

        it('should reject expense with zero amount', async () => {
            const userId = 'test-user';
            const expenseRequest = new CreateExpenseRequestBuilder().build();
            (expenseRequest as any).amount = 0;

            const req = createStubRequest(userId, expenseRequest);
            const res = createStubResponse();

            await expect(expenseHandlers.createExpense(req, res)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'INVALID_AMOUNT',
                }),
            );
        });

        it('should reject expense with negative amount', async () => {
            const userId = 'test-user';
            const expenseRequest = new CreateExpenseRequestBuilder().build();
            (expenseRequest as any).amount = -50;

            const req = createStubRequest(userId, expenseRequest);
            const res = createStubResponse();

            await expect(expenseHandlers.createExpense(req, res)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'INVALID_AMOUNT',
                }),
            );
        });

        it('should reject expense with empty description', async () => {
            const userId = 'test-user';
            const expenseRequest = new CreateExpenseRequestBuilder().build();
            (expenseRequest as any).description = '';

            const req = createStubRequest(userId, expenseRequest);
            const res = createStubResponse();

            await expect(expenseHandlers.createExpense(req, res)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'INVALID_DESCRIPTION',
                }),
            );
        });

        it('should reject expense with invalid category', async () => {
            const userId = 'test-user';
            const expenseRequest = new CreateExpenseRequestBuilder().build();
            (expenseRequest as any).category = 'a'.repeat(51);

            const req = createStubRequest(userId, expenseRequest);
            const res = createStubResponse();

            await expect(expenseHandlers.createExpense(req, res)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'INVALID_CATEGORY',
                }),
            );
        });

        it('should reject expense with invalid split type', async () => {
            const userId = 'test-user';
            const expenseRequest = new CreateExpenseRequestBuilder().build();
            (expenseRequest as any).splitType = 'invalid';

            const req = createStubRequest(userId, expenseRequest);
            const res = createStubResponse();

            await expect(expenseHandlers.createExpense(req, res)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'INVALID_SPLIT_TYPE',
                }),
            );
        });

        it('should reject expense with no participants', async () => {
            const userId = 'test-user';
            const expenseRequest = new CreateExpenseRequestBuilder().build();
            (expenseRequest as any).participants = [];

            const req = createStubRequest(userId, expenseRequest);
            const res = createStubResponse();

            await expect(expenseHandlers.createExpense(req, res)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'INVALID_PARTICIPANTS',
                }),
            );
        });

        it('should reject expense when payer is not a participant', async () => {
            const userId = 'test-user';
            const payerId = 'payer-user';
            const otherUser = 'other-user';

            const expenseRequest = new CreateExpenseRequestBuilder()
                .withPaidBy(payerId)
                .withParticipants([otherUser])
                .build();

            const req = createStubRequest(userId, expenseRequest);
            const res = createStubResponse();

            await expect(expenseHandlers.createExpense(req, res)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'PAYER_NOT_PARTICIPANT',
                }),
            );
        });

        it('should reject expense with excessive precision for JPY', async () => {
            const userId = 'test-user';
            const expenseRequest = new CreateExpenseRequestBuilder()
                .withAmount(100.50)
                .withCurrency('JPY')
                .build();

            const req = createStubRequest(userId, expenseRequest);
            const res = createStubResponse();

            await expect(expenseHandlers.createExpense(req, res)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'INVALID_AMOUNT_PRECISION',
                }),
            );
        });
    });

    describe('updateExpense', () => {
        it('should update expense description successfully', async () => {
            const groupId = 'test-group';
            const userId = 'test-user';
            const expenseId = 'test-expense';

            db.seedUser(userId, {});
            db.seedGroup(groupId, { createdBy: userId });
            db.initializeGroupBalance(groupId);

            db.seedGroupMember(groupId, userId, new GroupMemberDocumentBuilder().withUserId(userId).withGroupId(groupId).buildDocument());

            const expense = new ExpenseDTOBuilder()
                .withId(expenseId)
                .withGroupId(groupId)
                .withPaidBy(userId)
                .withParticipants([userId])
                .build();
            db.seedExpense(expenseId, expense);

            const updateRequest: UpdateExpenseRequest = {
                description: 'Updated description',
            };

            const req = createStubRequest(userId, updateRequest);
            req.query = { id: expenseId };
            const res = createStubResponse();

            await expenseHandlers.updateExpense(req, res);

            const json = (res as any).getJson();
            expect(json.description).toBe('Updated description');
        });

        it('should update expense category successfully', async () => {
            const groupId = 'test-group';
            const userId = 'test-user';
            const expenseId = 'test-expense';

            db.seedUser(userId, {});
            db.seedGroup(groupId, { createdBy: userId });
            db.initializeGroupBalance(groupId);

            db.seedGroupMember(groupId, userId, new GroupMemberDocumentBuilder().withUserId(userId).withGroupId(groupId).buildDocument());

            const expense = new ExpenseDTOBuilder()
                .withId(expenseId)
                .withGroupId(groupId)
                .withPaidBy(userId)
                .withParticipants([userId])
                .build();
            db.seedExpense(expenseId, expense);

            const updateRequest: UpdateExpenseRequest = {
                category: 'Transport',
            };

            const req = createStubRequest(userId, updateRequest);
            req.query = { id: expenseId };
            const res = createStubResponse();

            await expenseHandlers.updateExpense(req, res);

            const json = (res as any).getJson();
            expect(json.category).toBe('Transport');
        });

        it('should reject update with invalid expense ID', async () => {
            const updateRequest: UpdateExpenseRequest = { amount: 150 };
            const req = createStubRequest('test-user', updateRequest);
            req.query = { id: '' };
            const res = createStubResponse();

            await expect(expenseHandlers.updateExpense(req, res)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'INVALID_EXPENSE_ID',
                }),
            );
        });

        it('should reject update with no fields provided', async () => {
            const updateRequest = {};
            const req = createStubRequest('test-user', updateRequest);
            req.query = { id: 'test-expense' };
            const res = createStubResponse();

            await expect(expenseHandlers.updateExpense(req, res)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'NO_UPDATE_FIELDS',
                }),
            );
        });

        it('should reject update with invalid amount precision when currency provided', async () => {
            const updateRequest: UpdateExpenseRequest = {
                amount: 100.50,
                currency: 'JPY',
            };
            const req = createStubRequest('test-user', updateRequest);
            req.query = { id: 'test-expense' };
            const res = createStubResponse();

            await expect(expenseHandlers.updateExpense(req, res)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'INVALID_AMOUNT_PRECISION',
                }),
            );
        });

        it('should reject update with empty description', async () => {
            const updateRequest: UpdateExpenseRequest = {
                description: '',
            };
            const req = createStubRequest('test-user', updateRequest);
            req.query = { id: 'test-expense' };
            const res = createStubResponse();

            await expect(expenseHandlers.updateExpense(req, res)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'INVALID_DESCRIPTION',
                }),
            );
        });

        it('should reject update with invalid category length', async () => {
            const updateRequest: UpdateExpenseRequest = {
                category: 'a'.repeat(51),
            };
            const req = createStubRequest('test-user', updateRequest);
            req.query = { id: 'test-expense' };
            const res = createStubResponse();

            await expect(expenseHandlers.updateExpense(req, res)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'INVALID_CATEGORY',
                }),
            );
        });
    });

    describe('deleteExpense', () => {
        it('should soft delete expense successfully', async () => {
            const groupId = 'test-group';
            const userId = 'test-user';
            const expenseId = 'test-expense';

            db.seedUser(userId, {});
            db.seedGroup(groupId, { name: 'Test Group', createdBy: userId });
            db.initializeGroupBalance(groupId);

            db.seedGroupMember(
                groupId,
                userId,
                new GroupMemberDocumentBuilder().withUserId(userId).withGroupId(groupId).buildDocument(),
            );

            const expense = new ExpenseDTOBuilder()
                .withId(expenseId)
                .withGroupId(groupId)
                .withPaidBy(userId)
                .withParticipants([userId])
                .build();
            db.seedExpense(expenseId, expense);

            const req = createStubRequest(userId, {});
            req.query = { id: expenseId };
            const res = createStubResponse();

            await expenseHandlers.deleteExpense(req, res);

            // Note: deleteExpense doesn't set status explicitly, so getStatus() returns undefined
            const json = (res as any).getJson();
            expect(json).toMatchObject({
                message: 'Expense deleted successfully',
            });
        });

        it('should reject delete with invalid expense ID', async () => {
            const req = createStubRequest('test-user', {});
            req.query = { id: '' };
            const res = createStubResponse();

            await expect(expenseHandlers.deleteExpense(req, res)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'INVALID_EXPENSE_ID',
                }),
            );
        });

        it('should reject delete of non-existent expense', async () => {
            const req = createStubRequest('test-user', {});
            req.query = { id: 'non-existent-expense' };
            const res = createStubResponse();

            await expect(expenseHandlers.deleteExpense(req, res)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.NOT_FOUND,
                }),
            );
        });

        it('should allow group admin to delete expense created by another user', async () => {
            const groupId = 'test-group';
            const adminId = 'admin-user';
            const creatorId = 'creator-user';
            const expenseId = 'test-expense';

            db.seedUser(adminId, {});
            db.seedUser(creatorId, {});
            db.seedGroup(groupId, { createdBy: adminId });
            db.initializeGroupBalance(groupId);

            db.seedGroupMember(
                groupId,
                adminId,
                new GroupMemberDocumentBuilder().withUserId(adminId).withGroupId(groupId).withRole('admin').buildDocument(),
            );
            db.seedGroupMember(
                groupId,
                creatorId,
                new GroupMemberDocumentBuilder().withUserId(creatorId).withGroupId(groupId).buildDocument(),
            );

            const expense = new ExpenseDTOBuilder()
                .withId(expenseId)
                .withGroupId(groupId)
                .withPaidBy(creatorId)
                .withParticipants([creatorId])
                .build();
            db.seedExpense(expenseId, expense);

            const req = createStubRequest(adminId, {});
            req.query = { id: expenseId };
            const res = createStubResponse();

            await expenseHandlers.deleteExpense(req, res);

            // Note: deleteExpense doesn't set status explicitly, so getStatus() returns undefined
            const json = (res as any).getJson();
            expect(json).toMatchObject({
                message: 'Expense deleted successfully',
            });
        });
    });

    describe('getExpenseFullDetails', () => {
        it('should get full expense details successfully', async () => {
            const groupId = 'test-group';
            const userId = 'test-user';
            const expenseId = 'test-expense';

            db.seedUser(userId, {});
            db.seedGroup(groupId, { createdBy: userId });
            db.initializeGroupBalance(groupId);

            db.seedGroupMember(
                groupId,
                userId,
                new GroupMemberDocumentBuilder().withUserId(userId).withGroupId(groupId).buildDocument(),
            );

            const expense = new ExpenseDTOBuilder()
                .withId(expenseId)
                .withGroupId(groupId)
                .withPaidBy(userId)
                .withParticipants([userId])
                .build();
            db.seedExpense(expenseId, expense);

            const req = createStubRequest(userId, {});
            req.params = { id: expenseId };
            const res = createStubResponse();

            await expenseHandlers.getExpenseFullDetails(req, res);

            // Note: getExpenseFullDetails doesn't set status explicitly, so getStatus() returns undefined
            const json = (res as any).getJson();
            expect(json).toMatchObject({
                expense: expect.objectContaining({
                    id: expenseId,
                    groupId,
                }),
                group: expect.objectContaining({
                    id: groupId,
                }),
                members: expect.objectContaining({
                    members: expect.any(Array),
                }),
            });
        });

        it('should reject request with invalid expense ID', async () => {
            const req = createStubRequest('test-user', {});
            req.params = { id: '' };
            const res = createStubResponse();

            await expect(expenseHandlers.getExpenseFullDetails(req, res)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'INVALID_EXPENSE_ID',
                }),
            );
        });

        it('should reject request for non-existent expense', async () => {
            const req = createStubRequest('test-user', {});
            req.params = { id: 'non-existent-expense' };
            const res = createStubResponse();

            await expect(expenseHandlers.getExpenseFullDetails(req, res)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.NOT_FOUND,
                }),
            );
        });
    });

    describe('Static Factory Method', () => {
        it('should create ExpenseHandlers instance with default ApplicationBuilder', () => {
            const handlers = ExpenseHandlers.createExpenseHandlers();
            expect(handlers).toBeInstanceOf(ExpenseHandlers);
            expect(handlers.createExpense).toBeDefined();
            expect(handlers.updateExpense).toBeDefined();
            expect(handlers.deleteExpense).toBeDefined();
            expect(handlers.getExpenseFullDetails).toBeDefined();
        });
    });
});
