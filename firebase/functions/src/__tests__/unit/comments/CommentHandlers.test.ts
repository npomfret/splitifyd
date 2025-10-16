import { CommentTargetTypes } from '@splitifyd/shared';
import { CommentRequestBuilder, createStubRequest, createStubResponse, ExpenseDTOBuilder, StubFirestoreDatabase } from '@splitifyd/test-support';
import { beforeEach, describe, expect, it } from 'vitest';
import { CommentHandlers } from '../../../comments/CommentHandlers';
import { HTTP_STATUS } from '../../../constants';
import { ApplicationBuilder } from '../../../services/ApplicationBuilder';
import { FirestoreReader, FirestoreWriter } from '../../../services/firestore';
import { GroupMemberDocumentBuilder } from '../../support/GroupMemberDocumentBuilder';
import { StubAuthService } from '../mocks/StubAuthService';

describe('CommentHandlers - Unit Tests', () => {
    let commentHandlers: CommentHandlers;
    let db: StubFirestoreDatabase;
    let stubAuth: StubAuthService;

    beforeEach(() => {
        db = new StubFirestoreDatabase();
        stubAuth = new StubAuthService();

        const firestoreReader = new FirestoreReader(db);
        const firestoreWriter = new FirestoreWriter(db);
        const applicationBuilder = new ApplicationBuilder(firestoreReader, firestoreWriter, stubAuth);

        commentHandlers = new CommentHandlers(applicationBuilder.buildCommentService());
    });

    describe('createComment - Group Target', () => {
        it('should create a group comment successfully with valid data', async () => {
            const groupId = 'test-group';
            const userId = 'test-user';

            stubAuth.setUser(userId, { uid: userId });
            db.seedUser(userId, {});
            db.seedGroup(groupId, { createdBy: userId });
            db.seedGroupMember(
                groupId,
                userId,
                new GroupMemberDocumentBuilder().withUserId(userId).withGroupId(groupId).buildDocument(),
            );

            const commentRequest = new CommentRequestBuilder().withGroupTarget(groupId).withText('This is a test comment').build();

            const req = createStubRequest(userId, commentRequest, { groupId });
            req.path = `/api/groups/${groupId}/comments`;
            const res = createStubResponse();

            await commentHandlers.createComment(req, res);

            expect((res as any).getStatus()).toBe(HTTP_STATUS.OK);
            const json = (res as any).getJson();
            expect(json).toMatchObject(expect.objectContaining({
                id: expect.any(String),
                text: 'This is a test comment',
                authorId: userId,
            }));
        });

        it('should create a comment with whitespace trimmed', async () => {
            const groupId = 'test-group';
            const userId = 'test-user';

            stubAuth.setUser(userId, { uid: userId });
            db.seedUser(userId, {});
            db.seedGroup(groupId, { createdBy: userId });
            db.seedGroupMember(
                groupId,
                userId,
                new GroupMemberDocumentBuilder().withUserId(userId).withGroupId(groupId).buildDocument(),
            );

            const commentRequest = new CommentRequestBuilder().withGroupTarget(groupId).withWhitespaceText('test comment').build();

            const req = createStubRequest(userId, commentRequest, { groupId });
            req.path = `/api/groups/${groupId}/comments`;
            const res = createStubResponse();

            await commentHandlers.createComment(req, res);

            expect((res as any).getStatus()).toBe(HTTP_STATUS.OK);
            expect((res as any).getJson().text).toBe('test comment');
        });

        it('should sanitize XSS attempts in comment text', async () => {
            const groupId = 'test-group';
            const userId = 'test-user';

            stubAuth.setUser(userId, { uid: userId });
            db.seedUser(userId, {});
            db.seedGroup(groupId, { createdBy: userId });
            db.seedGroupMember(
                groupId,
                userId,
                new GroupMemberDocumentBuilder().withUserId(userId).withGroupId(groupId).buildDocument(),
            );

            const commentRequest = new CommentRequestBuilder().withGroupTarget(groupId).withXSSText().build();

            const req = createStubRequest(userId, commentRequest, { groupId });
            req.path = `/api/groups/${groupId}/comments`;
            const res = createStubResponse();

            await commentHandlers.createComment(req, res);

            expect((res as any).getStatus()).toBe(HTTP_STATUS.OK);
            const json = (res as any).getJson();
            expect(json.text).not.toContain('<script>');
            expect(json.text).toContain('Safe text');
        });

        it('should reject comment with empty text', async () => {
            const groupId = 'test-group';
            const userId = 'test-user';

            const commentRequest = new CommentRequestBuilder()
                .withGroupTarget(groupId)
                .withText('')
                .build();

            const req = createStubRequest(userId, commentRequest, { groupId });
            req.path = `/api/groups/${groupId}/comments`;
            const res = createStubResponse();

            await expect(commentHandlers.createComment(req, res)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'INVALID_COMMENT_TEXT',
                }),
            );
        });

        it('should reject comment with only whitespace', async () => {
            const groupId = 'test-group';
            const userId = 'test-user';

            const commentRequest = new CommentRequestBuilder()
                .withGroupTarget(groupId)
                .withText('   ')
                .build();

            const req = createStubRequest(userId, commentRequest, { groupId });
            req.path = `/api/groups/${groupId}/comments`;
            const res = createStubResponse();

            await expect(commentHandlers.createComment(req, res)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'INVALID_COMMENT_TEXT',
                }),
            );
        });

        it('should reject comment with text exceeding 500 characters', async () => {
            const groupId = 'test-group';
            const userId = 'test-user';

            const commentRequest = new CommentRequestBuilder()
                .withGroupTarget(groupId)
                .withLongText(501)
                .build();

            const req = createStubRequest(userId, commentRequest, { groupId });
            req.path = `/api/groups/${groupId}/comments`;
            const res = createStubResponse();

            await expect(commentHandlers.createComment(req, res)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'INVALID_COMMENT_TEXT',
                }),
            );
        });

        it('should reject comment with missing target ID', async () => {
            const userId = 'test-user';

            const commentRequest = new CommentRequestBuilder()
                .withTargetType(CommentTargetTypes.GROUP)
                .withText('Test comment')
                .withMissingField('targetId')
                .build();

            const req = createStubRequest(userId, commentRequest);
            req.path = '/api/groups/undefined/comments';
            const res = createStubResponse();

            await expect(commentHandlers.createComment(req, res)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                }),
            );
        });

        it('should reject comment when user is not a group member', async () => {
            const groupId = 'test-group';
            const userId = 'test-user';
            const creatorId = 'creator-user';

            db.seedUser(userId, {});
            db.seedUser(creatorId, {});
            db.seedGroup(groupId, { createdBy: creatorId });
            db.seedGroupMember(
                groupId,
                creatorId,
                new GroupMemberDocumentBuilder().withUserId(creatorId).withGroupId(groupId).buildDocument(),
            );

            const commentRequest = new CommentRequestBuilder().withGroupTarget(groupId).withText('Test comment').build();

            const req = createStubRequest(userId, commentRequest, { groupId });
            req.path = `/api/groups/${groupId}/comments`;
            const res = createStubResponse();

            await expect(commentHandlers.createComment(req, res)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.FORBIDDEN,
                }),
            );
        });

        it('should reject comment for non-existent group', async () => {
            const groupId = 'non-existent-group';
            const userId = 'test-user';

            db.seedUser(userId, {});

            const commentRequest = new CommentRequestBuilder().withGroupTarget(groupId).withText('Test comment').build();

            const req = createStubRequest(userId, commentRequest, { groupId });
            req.path = `/api/groups/${groupId}/comments`;
            const res = createStubResponse();

            await expect(commentHandlers.createComment(req, res)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.NOT_FOUND,
                }),
            );
        });
    });

    describe('createComment - Expense Target', () => {
        it('should create an expense comment successfully with valid data', async () => {
            const groupId = 'test-group';
            const expenseId = 'test-expense';
            const userId = 'test-user';

            stubAuth.setUser(userId, { uid: userId });
            db.seedUser(userId, {});
            db.seedGroup(groupId, { createdBy: userId });
            db.seedGroupMember(
                groupId,
                userId,
                new GroupMemberDocumentBuilder().withUserId(userId).withGroupId(groupId).buildDocument(),
            );
            db.seedExpense(expenseId, new ExpenseDTOBuilder().withId(expenseId).withGroupId(groupId).build());

            const commentRequest = new CommentRequestBuilder().withExpenseTarget(expenseId, groupId).withText('This is an expense comment').build();

            const req = createStubRequest(userId, commentRequest, { expenseId });
            req.path = `/api/expenses/${expenseId}/comments`;
            const res = createStubResponse();

            await commentHandlers.createComment(req, res);

            expect((res as any).getStatus()).toBe(HTTP_STATUS.OK);
            const json = (res as any).getJson();
            expect(json).toMatchObject(expect.objectContaining({
                id: expect.any(String),
                text: 'This is an expense comment',
                authorId: userId,
            }));
        });

        it('should reject expense comment when user is not a group member', async () => {
            const groupId = 'test-group';
            const expenseId = 'test-expense';
            const userId = 'test-user';
            const creatorId = 'creator-user';

            db.seedUser(userId, {});
            db.seedUser(creatorId, {});
            db.seedGroup(groupId, { createdBy: creatorId });
            db.seedGroupMember(
                groupId,
                creatorId,
                new GroupMemberDocumentBuilder().withUserId(creatorId).withGroupId(groupId).buildDocument(),
            );
            db.seedExpense(expenseId, new ExpenseDTOBuilder().withId(expenseId).withGroupId(groupId).build());

            const commentRequest = new CommentRequestBuilder().withExpenseTarget(expenseId, groupId).withText('Test comment').build();

            const req = createStubRequest(userId, commentRequest, { expenseId });
            req.path = `/api/expenses/${expenseId}/comments`;
            const res = createStubResponse();

            await expect(commentHandlers.createComment(req, res)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.FORBIDDEN,
                }),
            );
        });

        it('should reject expense comment for non-existent expense', async () => {
            const groupId = 'test-group';
            const expenseId = 'non-existent-expense';
            const userId = 'test-user';

            db.seedUser(userId, {});
            db.seedGroup(groupId, { createdBy: userId });
            db.seedGroupMember(
                groupId,
                userId,
                new GroupMemberDocumentBuilder().withUserId(userId).withGroupId(groupId).buildDocument(),
            );

            const commentRequest = new CommentRequestBuilder().withExpenseTarget(expenseId, groupId).withText('Test comment').build();

            const req = createStubRequest(userId, commentRequest, { expenseId });
            req.path = `/api/expenses/${expenseId}/comments`;
            const res = createStubResponse();

            await expect(commentHandlers.createComment(req, res)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.NOT_FOUND,
                }),
            );
        });
    });

    describe('listGroupComments', () => {
        it('should list group comments successfully', async () => {
            const groupId = 'test-group';
            const userId = 'test-user';

            db.seedUser(userId, {});
            db.seedGroup(groupId, { createdBy: userId });
            db.seedGroupMember(
                groupId,
                userId,
                new GroupMemberDocumentBuilder().withUserId(userId).withGroupId(groupId).buildDocument(),
            );

            const req = createStubRequest(userId, {}, { groupId });
            req.query = {};
            const res = createStubResponse();

            await commentHandlers.listGroupComments(req, res);

            expect((res as any).getStatus()).toBe(HTTP_STATUS.OK);
            const json = (res as any).getJson();
            expect(json).toMatchObject({
                comments: expect.any(Array),
                hasMore: expect.any(Boolean),
            });
        });

        it('should return empty array when no comments exist', async () => {
            const groupId = 'test-group';
            const userId = 'test-user';

            db.seedUser(userId, {});
            db.seedGroup(groupId, { createdBy: userId });
            db.seedGroupMember(
                groupId,
                userId,
                new GroupMemberDocumentBuilder().withUserId(userId).withGroupId(groupId).buildDocument(),
            );

            const req = createStubRequest(userId, {}, { groupId });
            req.query = {};
            const res = createStubResponse();

            await commentHandlers.listGroupComments(req, res);

            expect((res as any).getStatus()).toBe(HTTP_STATUS.OK);
            expect((res as any).getJson().comments).toEqual([]);
            expect((res as any).getJson().hasMore).toBe(false);
        });

        it('should reject listing comments with invalid group ID', async () => {
            const userId = 'test-user';

            db.seedUser(userId, {});

            const req = createStubRequest(userId, {}, { groupId: '' });
            const res = createStubResponse();

            await expect(commentHandlers.listGroupComments(req, res)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'INVALID_GROUP_ID',
                }),
            );
        });

        it('should reject listing comments when user is not a group member', async () => {
            const groupId = 'test-group';
            const userId = 'test-user';
            const creatorId = 'creator-user';

            db.seedUser(userId, {});
            db.seedUser(creatorId, {});
            db.seedGroup(groupId, { createdBy: creatorId });
            db.seedGroupMember(
                groupId,
                creatorId,
                new GroupMemberDocumentBuilder().withUserId(creatorId).withGroupId(groupId).buildDocument(),
            );

            const req = createStubRequest(userId, {}, { groupId });
            req.query = {};
            const res = createStubResponse();

            await expect(commentHandlers.listGroupComments(req, res)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.FORBIDDEN,
                }),
            );
        });

        it('should reject listing comments for non-existent group', async () => {
            const groupId = 'non-existent-group';
            const userId = 'test-user';

            db.seedUser(userId, {});

            const req = createStubRequest(userId, {}, { groupId });
            req.query = {};
            const res = createStubResponse();

            await expect(commentHandlers.listGroupComments(req, res)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.NOT_FOUND,
                }),
            );
        });

        it('should handle pagination with cursor and limit', async () => {
            const groupId = 'test-group';
            const userId = 'test-user';

            db.seedUser(userId, {});
            db.seedGroup(groupId, { createdBy: userId });
            db.seedGroupMember(
                groupId,
                userId,
                new GroupMemberDocumentBuilder().withUserId(userId).withGroupId(groupId).buildDocument(),
            );

            const req = createStubRequest(userId, {}, { groupId });
            req.query = { cursor: 'test-cursor', limit: '10' };
            const res = createStubResponse();

            await commentHandlers.listGroupComments(req, res);

            expect((res as any).getStatus()).toBe(HTTP_STATUS.OK);
            const json = (res as any).getJson();
            expect(json).toMatchObject({
                comments: expect.any(Array),
                hasMore: expect.any(Boolean),
            });
        });
    });

    describe('listExpenseComments', () => {
        it('should list expense comments successfully', async () => {
            const groupId = 'test-group';
            const expenseId = 'test-expense';
            const userId = 'test-user';

            db.seedUser(userId, {});
            db.seedGroup(groupId, { createdBy: userId });
            db.seedGroupMember(
                groupId,
                userId,
                new GroupMemberDocumentBuilder().withUserId(userId).withGroupId(groupId).buildDocument(),
            );
            db.seedExpense(expenseId, new ExpenseDTOBuilder().withId(expenseId).withGroupId(groupId).build());

            const req = createStubRequest(userId, {}, { expenseId });
            req.query = {};
            const res = createStubResponse();

            await commentHandlers.listExpenseComments(req, res);

            expect((res as any).getStatus()).toBe(HTTP_STATUS.OK);
            const json = (res as any).getJson();
            expect(json).toMatchObject({
                comments: expect.any(Array),
                hasMore: expect.any(Boolean),
            });
        });

        it('should return empty array when no expense comments exist', async () => {
            const groupId = 'test-group';
            const expenseId = 'test-expense';
            const userId = 'test-user';

            db.seedUser(userId, {});
            db.seedGroup(groupId, { createdBy: userId });
            db.seedGroupMember(
                groupId,
                userId,
                new GroupMemberDocumentBuilder().withUserId(userId).withGroupId(groupId).buildDocument(),
            );
            db.seedExpense(expenseId, new ExpenseDTOBuilder().withId(expenseId).withGroupId(groupId).build());

            const req = createStubRequest(userId, {}, { expenseId });
            req.query = {};
            const res = createStubResponse();

            await commentHandlers.listExpenseComments(req, res);

            expect((res as any).getStatus()).toBe(HTTP_STATUS.OK);
            expect((res as any).getJson().comments).toEqual([]);
            expect((res as any).getJson().hasMore).toBe(false);
        });

        it('should reject listing comments with invalid expense ID', async () => {
            const userId = 'test-user';

            db.seedUser(userId, {});

            const req = createStubRequest(userId, {}, { expenseId: '' });
            const res = createStubResponse();

            await expect(commentHandlers.listExpenseComments(req, res)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'INVALID_EXPENSE_ID',
                }),
            );
        });

        it('should reject listing comments when user is not a group member', async () => {
            const groupId = 'test-group';
            const expenseId = 'test-expense';
            const userId = 'test-user';
            const creatorId = 'creator-user';

            db.seedUser(userId, {});
            db.seedUser(creatorId, {});
            db.seedGroup(groupId, { createdBy: creatorId });
            db.seedGroupMember(
                groupId,
                creatorId,
                new GroupMemberDocumentBuilder().withUserId(creatorId).withGroupId(groupId).buildDocument(),
            );
            db.seedExpense(expenseId, new ExpenseDTOBuilder().withId(expenseId).withGroupId(groupId).build());

            const req = createStubRequest(userId, {}, { expenseId });
            req.query = {};
            const res = createStubResponse();

            await expect(commentHandlers.listExpenseComments(req, res)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.FORBIDDEN,
                }),
            );
        });

        it('should reject listing comments for non-existent expense', async () => {
            const expenseId = 'non-existent-expense';
            const userId = 'test-user';

            db.seedUser(userId, {});

            const req = createStubRequest(userId, {}, { expenseId });
            req.query = {};
            const res = createStubResponse();

            await expect(commentHandlers.listExpenseComments(req, res)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.NOT_FOUND,
                }),
            );
        });

        it('should handle pagination with cursor and limit', async () => {
            const groupId = 'test-group';
            const expenseId = 'test-expense';
            const userId = 'test-user';

            db.seedUser(userId, {});
            db.seedGroup(groupId, { createdBy: userId });
            db.seedGroupMember(
                groupId,
                userId,
                new GroupMemberDocumentBuilder().withUserId(userId).withGroupId(groupId).buildDocument(),
            );
            db.seedExpense(expenseId, new ExpenseDTOBuilder().withId(expenseId).withGroupId(groupId).build());

            const req = createStubRequest(userId, {}, { expenseId });
            req.query = { cursor: 'test-cursor', limit: '10' };
            const res = createStubResponse();

            await commentHandlers.listExpenseComments(req, res);

            expect((res as any).getStatus()).toBe(HTTP_STATUS.OK);
            const json = (res as any).getJson();
            expect(json).toMatchObject({
                comments: expect.any(Array),
                hasMore: expect.any(Boolean),
            });
        });
    });

    describe('Static Factory Method', () => {
        it('should create CommentHandlers instance with default ApplicationBuilder', () => {
            const handlers = CommentHandlers.createCommentHandlers();
            expect(handlers).toBeInstanceOf(CommentHandlers);
            expect(handlers.createComment).toBeDefined();
            expect(handlers.listGroupComments).toBeDefined();
            expect(handlers.listExpenseComments).toBeDefined();
        });
    });
});
