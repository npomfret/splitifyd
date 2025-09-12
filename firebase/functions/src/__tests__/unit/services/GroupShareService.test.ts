import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GroupShareService } from '../../../services/GroupShareService';
import { MockFirestoreReader } from '../../test-utils/MockFirestoreReader';
import { ApiError } from '../../../utils/errors';
import { HTTP_STATUS } from '../../../constants';
import { FirestoreGroupBuilder } from '@splitifyd/test-support';
import type { IFirestoreWriter } from '../../../services/firestore';

// Create mock GroupMemberService
const createMockGroupMemberService = () => ({
    isGroupMemberAsync: vi.fn().mockResolvedValue(false),
    isGroupOwnerAsync: vi.fn().mockResolvedValue(false),
    getAllGroupMembers: vi.fn().mockResolvedValue([
        { userId: 'user1', role: 'admin' },
        { userId: 'user2', role: 'member' },
    ]),
    getGroupMember: vi.fn().mockResolvedValue(null),
    getGroupMembersResponseFromSubcollection: vi.fn(),
});

vi.mock('../../../firebase', () => ({
    isTest: vi.fn(() => true),
    getFirestore: vi.fn(() => ({
        collection: vi.fn(() => ({
            doc: vi.fn(() => ({
                get: vi.fn(),
                collection: vi.fn(() => ({
                    doc: vi.fn(() => ({
                        set: vi.fn(),
                    })),
                })),
            })),
        })),
        collectionGroup: vi.fn(() => ({
            where: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            get: vi.fn(),
        })),
        runTransaction: vi.fn(),
    })),
}));

describe('GroupShareService', () => {
    let groupShareService: GroupShareService;
    let mockFirestoreReader: MockFirestoreReader;
    let mockFirestoreWriter: IFirestoreWriter;
    let mockGroupMemberService: ReturnType<typeof createMockGroupMemberService>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockFirestoreReader = new MockFirestoreReader();
        mockFirestoreWriter = {
            runTransaction: vi.fn(),
            updateInTransaction: vi.fn(),
            createInTransaction: vi.fn(),
            deleteInTransaction: vi.fn(),
            createUser: vi.fn(),
            updateUser: vi.fn(),
            deleteUser: vi.fn(),
        } as any;
        mockGroupMemberService = createMockGroupMemberService();
        groupShareService = new GroupShareService(mockFirestoreReader, mockFirestoreWriter, mockGroupMemberService as any);
    });

    describe('previewGroupByLink', () => {
        it('should return group preview when link is valid and group exists', async () => {
            const testGroup = new FirestoreGroupBuilder().withId('test-group').withName('Test Group').withDescription('A test group for sharing').withCreatedBy('creator-id').build();

            // Mock the findShareLinkByToken method
            vi.spyOn(groupShareService as any, 'findShareLinkByToken').mockResolvedValue({
                groupId: 'test-group',
                shareLink: {
                    id: 'link-id',
                    token: 'test-token',
                    createdBy: 'creator-id',
                    createdAt: new Date().toISOString(),
                    isActive: true,
                },
            });

            mockFirestoreReader.getGroup.mockResolvedValue(testGroup);
            mockGroupMemberService.isGroupMemberAsync.mockResolvedValue(false);

            const result = await groupShareService.previewGroupByLink('user-id', 'test-token');

            expect(result).toEqual({
                groupId: 'test-group',
                groupName: 'Test Group',
                groupDescription: 'A test group for sharing',
                memberCount: 2, // From mocked service
                isAlreadyMember: false,
            });

            expect(mockFirestoreReader.getGroup).toHaveBeenCalledWith('test-group');
            expect(mockGroupMemberService.isGroupMemberAsync).toHaveBeenCalledWith('test-group', 'user-id');
        });

        it('should throw NOT_FOUND when group does not exist', async () => {
            vi.spyOn(groupShareService as any, 'findShareLinkByToken').mockResolvedValue({
                groupId: 'nonexistent-group',
                shareLink: {
                    id: 'link-id',
                    token: 'test-token',
                    createdBy: 'creator-id',
                    createdAt: new Date().toISOString(),
                    isActive: true,
                },
            });

            mockFirestoreReader.getGroup.mockResolvedValue(null);

            await expect(groupShareService.previewGroupByLink('user-id', 'test-token')).rejects.toThrow(ApiError);

            expect(mockFirestoreReader.getGroup).toHaveBeenCalledWith('nonexistent-group');
        });

        it('should throw BAD_REQUEST when linkId is missing', async () => {
            await expect(groupShareService.previewGroupByLink('user-id', '')).rejects.toThrow(ApiError);

            let caughtError: ApiError | undefined;
            try {
                await groupShareService.previewGroupByLink('user-id', '');
            } catch (error) {
                caughtError = error as ApiError;
            }

            expect(caughtError).toBeInstanceOf(ApiError);
            expect(caughtError?.statusCode).toBe(HTTP_STATUS.BAD_REQUEST);
            expect(caughtError?.message).toContain('Link ID is required');
        });
    });

    describe('generateShareableLink', () => {
        it('should generate shareable link for group owner', async () => {
            const testGroup = new FirestoreGroupBuilder().withId('test-group').withCreatedBy('owner-id').build();

            mockFirestoreReader.getGroup.mockResolvedValue(testGroup);
            mockGroupMemberService.isGroupOwnerAsync.mockResolvedValue(true);
            mockGroupMemberService.isGroupMemberAsync.mockResolvedValue(false);

            // Mock the Firestore transaction
            const { getFirestore } = await import('../../../firebase');
            vi.mocked(getFirestore().runTransaction).mockImplementation(async (transactionFn: any) => {
                const mockTransaction = {
                    get: vi.fn().mockResolvedValue({ exists: true }),
                    set: vi.fn(),
                };
                return await transactionFn(mockTransaction);
            });

            const result = await groupShareService.generateShareableLink('owner-id', 'test-group');

            expect(result.shareablePath).toMatch(/^\/join\?linkId=.+$/);
            expect(result.linkId).toBeDefined();
            expect(result.linkId.length).toBeGreaterThan(0);

            expect(mockFirestoreReader.getGroup).toHaveBeenCalledWith('test-group');
            expect(mockGroupMemberService.isGroupOwnerAsync).toHaveBeenCalledWith('test-group', 'owner-id');
        });

        it('should generate shareable link for group member', async () => {
            const testGroup = new FirestoreGroupBuilder().withId('test-group').withCreatedBy('creator-id').build();

            mockFirestoreReader.getGroup.mockResolvedValue(testGroup);
            mockGroupMemberService.isGroupOwnerAsync.mockResolvedValue(false);
            mockGroupMemberService.isGroupMemberAsync.mockResolvedValue(true);

            // Mock the Firestore transaction
            const { getFirestore } = await import('../../../firebase');
            vi.mocked(getFirestore().runTransaction).mockImplementation(async (transactionFn: any) => {
                const mockTransaction = {
                    get: vi.fn().mockResolvedValue({ exists: true }),
                    set: vi.fn(),
                };
                return await transactionFn(mockTransaction);
            });

            const result = await groupShareService.generateShareableLink('member-id', 'test-group');

            expect(result.shareablePath).toMatch(/^\/join\?linkId=.+$/);
            expect(result.linkId).toBeDefined();

            expect(mockFirestoreReader.getGroup).toHaveBeenCalledWith('test-group');
            expect(mockGroupMemberService.isGroupMemberAsync).toHaveBeenCalledWith('test-group', 'member-id');
        });

        it('should throw UNAUTHORIZED for non-members', async () => {
            const testGroup = new FirestoreGroupBuilder().withId('test-group').withCreatedBy('creator-id').build();

            mockFirestoreReader.getGroup.mockResolvedValue(testGroup);
            mockGroupMemberService.isGroupOwnerAsync.mockResolvedValue(false);
            mockGroupMemberService.isGroupMemberAsync.mockResolvedValue(false);

            await expect(groupShareService.generateShareableLink('unauthorized-user', 'test-group')).rejects.toThrow(ApiError);

            let caughtError: ApiError | undefined;
            try {
                await groupShareService.generateShareableLink('unauthorized-user', 'test-group');
            } catch (error) {
                caughtError = error as ApiError;
            }

            expect(caughtError).toBeInstanceOf(ApiError);
            expect(caughtError?.statusCode).toBe(HTTP_STATUS.FORBIDDEN);
            expect(caughtError?.message).toContain('Only group members can generate share links');
        });

        it('should throw NOT_FOUND when group does not exist', async () => {
            mockFirestoreReader.getGroup.mockResolvedValue(null);

            await expect(groupShareService.generateShareableLink('user-id', 'nonexistent-group')).rejects.toThrow(ApiError);

            let caughtError: ApiError | undefined;
            try {
                await groupShareService.generateShareableLink('user-id', 'nonexistent-group');
            } catch (error) {
                caughtError = error as ApiError;
            }

            expect(caughtError).toBeInstanceOf(ApiError);
            expect(caughtError?.statusCode).toBe(HTTP_STATUS.NOT_FOUND);
            expect(caughtError?.message).toContain('Group not found');
        });
    });

    describe('dependency injection', () => {
        it('should use injected FirestoreReader for group reads', async () => {
            const testGroup = new FirestoreGroupBuilder().withId('test-group').withCreatedBy('creator-id').build();

            mockFirestoreReader.getGroup.mockResolvedValue(testGroup);
            mockGroupMemberService.isGroupOwnerAsync.mockResolvedValue(true);
            mockGroupMemberService.isGroupMemberAsync.mockResolvedValue(false);

            // Mock the Firestore transaction
            const { getFirestore } = await import('../../../firebase');
            vi.mocked(getFirestore().runTransaction).mockImplementation(async (transactionFn: any) => {
                const mockTransaction = {
                    get: vi.fn().mockResolvedValue({ exists: true }),
                    set: vi.fn(),
                };
                return await transactionFn(mockTransaction);
            });

            await groupShareService.generateShareableLink('owner-id', 'test-group');

            // Verify that the injected reader was used
            expect(mockFirestoreReader.getGroup).toHaveBeenCalledWith('test-group');
        });
    });
});
