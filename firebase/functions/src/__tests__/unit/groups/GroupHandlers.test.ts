import {
    CreateGroupRequestBuilder,
    GroupUpdateBuilder,
    StubFirestoreDatabase,
    createStubRequest,
    createStubResponse,
} from '@splitifyd/test-support';
import { beforeEach, describe, expect, it } from 'vitest';
import { GroupHandlers } from '../../../groups/GroupHandlers';
import { HTTP_STATUS } from '../../../constants';
import { ApplicationBuilder } from '../../../services/ApplicationBuilder';
import { FirestoreReader, FirestoreWriter } from '../../../services/firestore';
import { GroupMemberDocumentBuilder } from '../../support/GroupMemberDocumentBuilder';
import { StubAuthService } from '../mocks/StubAuthService';

describe('GroupHandlers - Unit Tests', () => {
    let groupHandlers: GroupHandlers;
    let db: StubFirestoreDatabase;

    beforeEach(() => {
        db = new StubFirestoreDatabase();
        const stubAuth = new StubAuthService();

        const firestoreReader = new FirestoreReader(db);
        const firestoreWriter = new FirestoreWriter(db);
        const applicationBuilder = new ApplicationBuilder(firestoreReader, firestoreWriter, stubAuth);

        groupHandlers = new GroupHandlers(applicationBuilder.buildGroupService(), firestoreWriter);
    });

    describe('createGroup', () => {
        it('should create a group successfully with name and description', async () => {
            const userId = 'test-user';
            db.seedUser(userId, { displayName: 'Test User' });

            const groupRequest = new CreateGroupRequestBuilder()
                .withName('My Test Group')
                .withDescription('A test group description')
                .build();

            const req = createStubRequest(userId, groupRequest);
            const res = createStubResponse();

            await groupHandlers.createGroup(req, res);

            expect((res as any).getStatus()).toBe(HTTP_STATUS.CREATED);
            const json = (res as any).getJson();
            expect(json).toMatchObject({
                id: expect.any(String),
                name: 'My Test Group',
                description: 'A test group description',
                createdBy: userId,
            });
        });

        it('should create a group successfully without description', async () => {
            const userId = 'test-user';
            db.seedUser(userId, { displayName: 'Test User' });

            const groupRequest = new CreateGroupRequestBuilder().withName('Simple Group').build();
            delete (groupRequest as any).description;

            const req = createStubRequest(userId, groupRequest);
            const res = createStubResponse();

            await groupHandlers.createGroup(req, res);

            expect((res as any).getStatus()).toBe(HTTP_STATUS.CREATED);
            const json = (res as any).getJson();
            expect(json).toMatchObject({
                name: 'Simple Group',
            });
        });

        it('should reject group creation with empty name', async () => {
            const groupRequest = new CreateGroupRequestBuilder().withName('').build();

            const req = createStubRequest('test-user', groupRequest);
            const res = createStubResponse();

            await expect(groupHandlers.createGroup(req, res)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'INVALID_INPUT',
                }),
            );
        });

        it('should reject group creation with name exceeding 100 characters', async () => {
            const longName = 'a'.repeat(101);
            const groupRequest = new CreateGroupRequestBuilder().withName(longName).build();

            const req = createStubRequest('test-user', groupRequest);
            const res = createStubResponse();

            await expect(groupHandlers.createGroup(req, res)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'INVALID_INPUT',
                }),
            );
        });

        it('should reject group creation with description exceeding 500 characters', async () => {
            const longDescription = 'a'.repeat(501);
            const groupRequest = new CreateGroupRequestBuilder()
                .withName('Test Group')
                .withDescription(longDescription)
                .build();

            const req = createStubRequest('test-user', groupRequest);
            const res = createStubResponse();

            await expect(groupHandlers.createGroup(req, res)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'INVALID_INPUT',
                }),
            );
        });

        it('should reject group creation with missing name field', async () => {
            const invalidRequest = {};

            const req = createStubRequest('test-user', invalidRequest);
            const res = createStubResponse();

            await expect(groupHandlers.createGroup(req, res)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'INVALID_INPUT',
                }),
            );
        });
    });

    describe('updateGroup', () => {
        it('should update group name successfully', async () => {
            const groupId = 'test-group';
            const userId = 'test-user';

            db.seedUser(userId, { displayName: 'Test User' });
            db.seedGroup(groupId, { name: 'Old Name', createdBy: userId });
            db.initializeGroupBalance(groupId);

            const membership = new GroupMemberDocumentBuilder()
                .withUserId(userId)
                .withGroupId(groupId)
                .withRole('admin')
                .withStatus('active')
                .buildDocument();
            db.seedGroupMember(groupId, userId, membership);

            const updateRequest = new GroupUpdateBuilder().withName('New Name').build();

            const req = createStubRequest(userId, updateRequest, { id: groupId });
            const res = createStubResponse();

            await groupHandlers.updateGroup(req, res);

            expect((res as any).getStatus()).toBeUndefined(); // Default 200
            const json = (res as any).getJson();
            expect(json).toMatchObject({
                message: 'Group updated successfully',
            });
        });

        it('should update group description successfully', async () => {
            const groupId = 'test-group';
            const userId = 'test-user';

            db.seedUser(userId, { displayName: 'Test User' });
            db.seedGroup(groupId, { name: 'Test Group', description: 'Old description', createdBy: userId });
            db.initializeGroupBalance(groupId);

            const membership = new GroupMemberDocumentBuilder()
                .withUserId(userId)
                .withGroupId(groupId)
                .withRole('admin')
                .withStatus('active')
                .buildDocument();
            db.seedGroupMember(groupId, userId, membership);

            const updateRequest = new GroupUpdateBuilder().withDescription('New description').build();

            const req = createStubRequest(userId, updateRequest, { id: groupId });
            const res = createStubResponse();

            await groupHandlers.updateGroup(req, res);

            expect((res as any).getStatus()).toBeUndefined(); // Default 200
            const json = (res as any).getJson();
            expect(json).toMatchObject({
                message: 'Group updated successfully',
            });
        });

        it('should update both name and description', async () => {
            const groupId = 'test-group';
            const userId = 'test-user';

            db.seedUser(userId, { displayName: 'Test User' });
            db.seedGroup(groupId, { name: 'Old Name', description: 'Old description', createdBy: userId });
            db.initializeGroupBalance(groupId);

            const membership = new GroupMemberDocumentBuilder()
                .withUserId(userId)
                .withGroupId(groupId)
                .withRole('admin')
                .withStatus('active')
                .buildDocument();
            db.seedGroupMember(groupId, userId, membership);

            const updateRequest = new GroupUpdateBuilder().withName('New Name').withDescription('New description').build();

            const req = createStubRequest(userId, updateRequest, { id: groupId });
            const res = createStubResponse();

            await groupHandlers.updateGroup(req, res);

            expect((res as any).getStatus()).toBeUndefined(); // Default 200
            const json = (res as any).getJson();
            expect(json).toMatchObject({
                message: 'Group updated successfully',
            });
        });

        it('should reject update with no fields provided', async () => {
            const updateRequest = {};

            const req = createStubRequest('test-user', updateRequest, { id: 'test-group' });
            const res = createStubResponse();

            await expect(groupHandlers.updateGroup(req, res)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'INVALID_INPUT',
                }),
            );
        });

        it('should reject update with empty group ID', async () => {
            const updateRequest = new GroupUpdateBuilder().withName('New Name').build();

            const req = createStubRequest('test-user', updateRequest, { id: '' });
            const res = createStubResponse();

            await expect(groupHandlers.updateGroup(req, res)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'INVALID_INPUT',
                }),
            );
        });

        it('should reject update with name exceeding 100 characters', async () => {
            const longName = 'a'.repeat(101);
            const updateRequest = new GroupUpdateBuilder().withName(longName).build();

            const req = createStubRequest('test-user', updateRequest, { id: 'test-group' });
            const res = createStubResponse();

            await expect(groupHandlers.updateGroup(req, res)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'INVALID_INPUT',
                }),
            );
        });

        it('should reject update with description exceeding 500 characters', async () => {
            const longDescription = 'a'.repeat(501);
            const updateRequest = new GroupUpdateBuilder().withDescription(longDescription).build();

            const req = createStubRequest('test-user', updateRequest, { id: 'test-group' });
            const res = createStubResponse();

            await expect(groupHandlers.updateGroup(req, res)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'INVALID_INPUT',
                }),
            );
        });
    });

    describe('deleteGroup', () => {
        it('should delete group successfully as admin', async () => {
            const groupId = 'test-group';
            const userId = 'test-user';

            db.seedUser(userId, { displayName: 'Test User' });
            db.seedGroup(groupId, { name: 'Test Group', createdBy: userId });
            db.initializeGroupBalance(groupId);

            const membership = new GroupMemberDocumentBuilder()
                .withUserId(userId)
                .withGroupId(groupId)
                .withRole('admin')
                .withStatus('active')
                .buildDocument();
            db.seedGroupMember(groupId, userId, membership);

            const req = createStubRequest(userId, {}, { id: groupId });
            const res = createStubResponse();

            await groupHandlers.deleteGroup(req, res);

            expect((res as any).getStatus()).toBeUndefined(); // Default 200
            const json = (res as any).getJson();
            expect(json).toMatchObject({
                message: 'Group and all associated data deleted permanently',
            });
        });

        it('should reject delete with empty group ID', async () => {
            const req = createStubRequest('test-user', {}, { id: '' });
            const res = createStubResponse();

            await expect(groupHandlers.deleteGroup(req, res)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'INVALID_INPUT',
                }),
            );
        });

        it('should reject delete of non-existent group', async () => {
            const userId = 'test-user';
            db.seedUser(userId, { displayName: 'Test User' });

            const req = createStubRequest(userId, {}, { id: 'non-existent-group' });
            const res = createStubResponse();

            await expect(groupHandlers.deleteGroup(req, res)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.NOT_FOUND,
                }),
            );
        });
    });

    describe('listGroups', () => {
        it('should list groups for user', async () => {
            const userId = 'test-user';
            const groupId1 = 'group-1';
            const groupId2 = 'group-2';

            db.seedUser(userId, { displayName: 'Test User' });
            db.seedGroup(groupId1, { name: 'Group 1', createdBy: userId });
            db.seedGroup(groupId2, { name: 'Group 2', createdBy: userId });

            const membership1 = new GroupMemberDocumentBuilder()
                .withUserId(userId)
                .withGroupId(groupId1)
                .withRole('admin')
                .withStatus('active')
                .buildDocument();
            const membership2 = new GroupMemberDocumentBuilder()
                .withUserId(userId)
                .withGroupId(groupId2)
                .withRole('member')
                .withStatus('active')
                .buildDocument();

            db.seedGroupMember(groupId1, userId, membership1);
            db.seedGroupMember(groupId2, userId, membership2);

            const req = createStubRequest(userId, {});
            req.query = { limit: '20' };
            const res = createStubResponse();

            await groupHandlers.listGroups(req, res);

            expect((res as any).getStatus()).toBeUndefined(); // Default 200
            const json = (res as any).getJson();
            expect(json).toMatchObject({
                groups: expect.any(Array),
            });
        });

        it('should list groups with pagination parameters', async () => {
            const userId = 'test-user';
            db.seedUser(userId, { displayName: 'Test User' });

            const req = createStubRequest(userId, {});
            req.query = { limit: '10', order: 'asc', cursor: 'some-cursor' };
            const res = createStubResponse();

            await groupHandlers.listGroups(req, res);

            expect((res as any).getStatus()).toBeUndefined(); // Default 200
            const json = (res as any).getJson();
            expect(json).toHaveProperty('groups');
        });
    });

    describe('updateGroupMemberDisplayName', () => {
        it('should update member display name successfully', async () => {
            const groupId = 'test-group';
            const userId = 'test-user';

            db.seedUser(userId, { displayName: 'Original Name' });
            db.seedGroup(groupId, { name: 'Test Group', createdBy: userId });

            const membership = new GroupMemberDocumentBuilder()
                .withUserId(userId)
                .withGroupId(groupId)
                .withRole('member')
                .withStatus('active')
                .withGroupDisplayName('Original Name')
                .buildDocument();
            db.seedGroupMember(groupId, userId, membership);

            const updateRequest = { displayName: 'New Display Name' };

            const req = createStubRequest(userId, updateRequest, { id: groupId });
            const res = createStubResponse();

            await groupHandlers.updateGroupMemberDisplayName(req, res);

            expect((res as any).getStatus()).toBeUndefined(); // Default 200
            const json = (res as any).getJson();
            expect(json).toMatchObject({
                success: true,
                message: 'Display name updated successfully',
            });
        });

        it('should reject update with empty display name', async () => {
            const updateRequest = { displayName: '' };

            const req = createStubRequest('test-user', updateRequest, { id: 'test-group' });
            const res = createStubResponse();

            await expect(groupHandlers.updateGroupMemberDisplayName(req, res)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'INVALID_INPUT',
                }),
            );
        });

        it('should reject update with display name exceeding 50 characters', async () => {
            const longName = 'a'.repeat(51);
            const updateRequest = { displayName: longName };

            const req = createStubRequest('test-user', updateRequest, { id: 'test-group' });
            const res = createStubResponse();

            await expect(groupHandlers.updateGroupMemberDisplayName(req, res)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'INVALID_INPUT',
                }),
            );
        });

        it('should reject update with missing display name field', async () => {
            const updateRequest = {};

            const req = createStubRequest('test-user', updateRequest, { id: 'test-group' });
            const res = createStubResponse();

            await expect(groupHandlers.updateGroupMemberDisplayName(req, res)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'INVALID_INPUT',
                }),
            );
        });
    });

    describe('Static Factory Method', () => {
        it('should create GroupHandlers instance with default ApplicationBuilder', () => {
            const handlers = GroupHandlers.createGroupHandlers();
            expect(handlers).toBeInstanceOf(GroupHandlers);
            expect(handlers.createGroup).toBeDefined();
            expect(handlers.updateGroup).toBeDefined();
            expect(handlers.deleteGroup).toBeDefined();
            expect(handlers.listGroups).toBeDefined();
            expect(handlers.updateGroupMemberDisplayName).toBeDefined();
        });
    });
});
