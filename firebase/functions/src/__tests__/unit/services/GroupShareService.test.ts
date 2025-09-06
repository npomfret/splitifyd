import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GroupShareService } from '../../../services/GroupShareService';
import { MockFirestoreReader } from '../../../services/firestore/MockFirestoreReader';
import { ApiError } from '../../../utils/errors';
import { HTTP_STATUS } from '../../../constants';
import type { GroupDocument } from '../../../schemas';

// Mock external dependencies
vi.mock('../../../utils/groupHelpers', () => ({
    isGroupOwnerAsync: vi.fn(),
    isGroupMemberAsync: vi.fn(),
    getThemeColorForMember: vi.fn(() => ({
        light: '#007bff',
        dark: '#0066cc',
        name: 'Blue',
        pattern: 'solid',
        assignedAt: new Date().toISOString(),
        colorIndex: 0,
    })),
}));

vi.mock('../../../services/serviceRegistration', () => ({
    getGroupMemberService: vi.fn(() => ({
        getMembersFromSubcollection: vi.fn().mockResolvedValue([
            { userId: 'user1', role: 'admin' },
            { userId: 'user2', role: 'member' },
        ]),
        getMemberFromSubcollection: vi.fn().mockResolvedValue(null),
    })),
}));

vi.mock('../../../firebase', () => ({
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

vi.mock('../../../utils/firestore-helpers', () => ({
    runTransactionWithRetry: vi.fn(),
}));

describe('GroupShareService', () => {
    let groupShareService: GroupShareService;
    let mockFirestoreReader: MockFirestoreReader;

    beforeEach(() => {
        vi.clearAllMocks();
        mockFirestoreReader = new MockFirestoreReader();
        groupShareService = new GroupShareService(mockFirestoreReader);
    });

    describe('previewGroupByLink', () => {
        it('should return group preview when link is valid and group exists', async () => {
            const testGroup: GroupDocument = {
                id: 'test-group',
                name: 'Test Group',
                description: 'A test group for sharing',
                createdBy: 'creator-id',
                members: {},
                securityPreset: 'open',
                permissions: {
                    expenseEditing: 'anyone',
                    expenseDeletion: 'anyone',
                    memberInvitation: 'anyone',
                    memberApproval: 'automatic',
                    settingsManagement: 'anyone',
                },
                createdAt: new Date(),
                updatedAt: new Date(),
                deletedAt: null,
            };

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
            const { isGroupMemberAsync } = await import('../../../utils/groupHelpers');
            vi.mocked(isGroupMemberAsync).mockResolvedValue(false);

            const result = await groupShareService.previewGroupByLink('user-id', 'test-token');

            expect(result).toEqual({
                groupId: 'test-group',
                groupName: 'Test Group',
                groupDescription: 'A test group for sharing',
                memberCount: 2, // From mocked service
                isAlreadyMember: false,
            });

            expect(mockFirestoreReader.getGroup).toHaveBeenCalledWith('test-group');
            expect(isGroupMemberAsync).toHaveBeenCalledWith('test-group', 'user-id');
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

            await expect(
                groupShareService.previewGroupByLink('user-id', 'test-token')
            ).rejects.toThrow(ApiError);

            expect(mockFirestoreReader.getGroup).toHaveBeenCalledWith('nonexistent-group');
        });

        it('should throw BAD_REQUEST when linkId is missing', async () => {
            await expect(
                groupShareService.previewGroupByLink('user-id', '')
            ).rejects.toThrow(ApiError);

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
            const testGroup: GroupDocument = {
                id: 'test-group',
                name: 'Test Group',
                description: 'A test group',
                createdBy: 'owner-id',
                members: {},
                securityPreset: 'open',
                permissions: {
                    expenseEditing: 'anyone',
                    expenseDeletion: 'anyone',
                    memberInvitation: 'anyone',
                    memberApproval: 'automatic',
                    settingsManagement: 'anyone',
                },
                createdAt: new Date(),
                updatedAt: new Date(),
                deletedAt: null,
            };

            mockFirestoreReader.getGroup.mockResolvedValue(testGroup);
            const { isGroupOwnerAsync, isGroupMemberAsync } = await import('../../../utils/groupHelpers');
            vi.mocked(isGroupOwnerAsync).mockResolvedValue(true);
            vi.mocked(isGroupMemberAsync).mockResolvedValue(false);

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
            expect(isGroupOwnerAsync).toHaveBeenCalledWith('test-group', 'owner-id');
        });

        it('should generate shareable link for group member', async () => {
            const testGroup: GroupDocument = {
                id: 'test-group',
                name: 'Test Group',
                description: 'A test group',
                createdBy: 'creator-id',
                members: {},
                securityPreset: 'open',
                permissions: {
                    expenseEditing: 'anyone',
                    expenseDeletion: 'anyone',
                    memberInvitation: 'anyone',
                    memberApproval: 'automatic',
                    settingsManagement: 'anyone',
                },
                createdAt: new Date(),
                updatedAt: new Date(),
                deletedAt: null,
            };

            mockFirestoreReader.getGroup.mockResolvedValue(testGroup);
            const { isGroupOwnerAsync, isGroupMemberAsync } = await import('../../../utils/groupHelpers');
            vi.mocked(isGroupOwnerAsync).mockResolvedValue(false);
            vi.mocked(isGroupMemberAsync).mockResolvedValue(true);

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
            expect(isGroupMemberAsync).toHaveBeenCalledWith('test-group', 'member-id');
        });

        it('should throw UNAUTHORIZED for non-members', async () => {
            const testGroup: GroupDocument = {
                id: 'test-group',
                name: 'Test Group',
                description: 'A test group',
                createdBy: 'creator-id',
                members: {},
                securityPreset: 'open',
                permissions: {
                    expenseEditing: 'anyone',
                    expenseDeletion: 'anyone',
                    memberInvitation: 'anyone',
                    memberApproval: 'automatic',
                    settingsManagement: 'anyone',
                },
                createdAt: new Date(),
                updatedAt: new Date(),
                deletedAt: null,
            };

            mockFirestoreReader.getGroup.mockResolvedValue(testGroup);
            const { isGroupOwnerAsync, isGroupMemberAsync } = await import('../../../utils/groupHelpers');
            vi.mocked(isGroupOwnerAsync).mockResolvedValue(false);
            vi.mocked(isGroupMemberAsync).mockResolvedValue(false);

            await expect(
                groupShareService.generateShareableLink('unauthorized-user', 'test-group')
            ).rejects.toThrow(ApiError);

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

            await expect(
                groupShareService.generateShareableLink('user-id', 'nonexistent-group')
            ).rejects.toThrow(ApiError);

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
            const testGroup: GroupDocument = {
                id: 'test-group',
                name: 'Test Group',
                description: 'A test group',
                createdBy: 'creator-id',
                members: {},
                securityPreset: 'open',
                permissions: {
                    expenseEditing: 'anyone',
                    expenseDeletion: 'anyone',
                    memberInvitation: 'anyone',
                    memberApproval: 'automatic',
                    settingsManagement: 'anyone',
                },
                createdAt: new Date(),
                updatedAt: new Date(),
                deletedAt: null,
            };

            mockFirestoreReader.getGroup.mockResolvedValue(testGroup);
            const { isGroupOwnerAsync, isGroupMemberAsync } = await import('../../../utils/groupHelpers');
            vi.mocked(isGroupOwnerAsync).mockResolvedValue(true);
            vi.mocked(isGroupMemberAsync).mockResolvedValue(false);

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