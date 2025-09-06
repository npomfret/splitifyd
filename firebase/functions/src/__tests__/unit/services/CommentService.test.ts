import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CommentService } from '../../../services/CommentService';
import { MockFirestoreReader } from '../../../services/firestore/MockFirestoreReader';
import { ApiError } from '../../../utils/errors';
import { HTTP_STATUS } from '../../../constants';
import type { GroupDocument, ExpenseDocument } from '../../../schemas';

// Mock the external dependencies
vi.mock('../../../utils/groupHelpers', () => ({
    isGroupMemberAsync: vi.fn(),
}));

vi.mock('../../../firebase', () => ({
    getAuth: vi.fn(() => ({
        getUser: vi.fn(),
    })),
    getFirestore: vi.fn(() => ({
        collection: vi.fn(() => ({
            doc: vi.fn(() => ({
                collection: vi.fn(() => ({
                    doc: vi.fn(() => ({
                        get: vi.fn(),
                        set: vi.fn(),
                    })),
                    orderBy: vi.fn(() => ({
                        limit: vi.fn(() => ({
                            get: vi.fn(),
                        })),
                    })),
                })),
            })),
        })),
    })),
}));

describe('CommentService', () => {
    let commentService: CommentService;
    let mockFirestoreReader: MockFirestoreReader;

    beforeEach(() => {
        vi.clearAllMocks();
        mockFirestoreReader = new MockFirestoreReader();
        commentService = new CommentService(mockFirestoreReader);
    });

    describe('verifyCommentAccess for GROUP comments', () => {
        it('should allow access when group exists and user is member', async () => {
            const testGroup: GroupDocument = {
                id: 'test-group',
                name: 'Test Group',
                description: 'Test Description',
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
            const { isGroupMemberAsync } = await import('../../../utils/groupHelpers');
            vi.mocked(isGroupMemberAsync).mockResolvedValue(true);

            // Should not throw
            await expect(
                (commentService as any).verifyCommentAccess('group', 'test-group', 'user-id')
            ).resolves.not.toThrow();

            expect(mockFirestoreReader.getGroup).toHaveBeenCalledWith('test-group');
            expect(isGroupMemberAsync).toHaveBeenCalledWith('test-group', 'user-id');
        });

        it('should throw NOT_FOUND when group does not exist', async () => {
            mockFirestoreReader.getGroup.mockResolvedValue(null);

            await expect(
                (commentService as any).verifyCommentAccess('group', 'nonexistent-group', 'user-id')
            ).rejects.toThrow(ApiError);

            expect(mockFirestoreReader.getGroup).toHaveBeenCalledWith('nonexistent-group');
        });

        it('should throw FORBIDDEN when user is not a group member', async () => {
            const testGroup: GroupDocument = {
                id: 'test-group',
                name: 'Test Group',
                description: 'Test Description',
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
            const { isGroupMemberAsync } = await import('../../../utils/groupHelpers');
            vi.mocked(isGroupMemberAsync).mockResolvedValue(false);

            await expect(
                (commentService as any).verifyCommentAccess('group', 'test-group', 'unauthorized-user')
            ).rejects.toThrow(ApiError);

            const error = await (commentService as any).verifyCommentAccess('group', 'test-group', 'unauthorized-user')
                .catch((e: ApiError) => e);
            
            expect(error.statusCode).toBe(HTTP_STATUS.FORBIDDEN);
        });
    });

    describe('verifyCommentAccess for EXPENSE comments', () => {
        it('should allow access when expense exists and user is group member', async () => {
            const testExpense: ExpenseDocument = {
                id: 'test-expense',
                groupId: 'test-group',
                createdBy: 'user-id',
                paidBy: 'user-id',
                amount: 100,
                currency: 'USD',
                description: 'Test Description',
                category: 'category',
                date: new Date().toISOString(),
                splitType: 'equal' as const,
                participants: ['user-id'],
                splits: [{ userId: 'user-id', amount: 100 }],
                deletedBy: null,
                createdAt: new Date(),
                updatedAt: new Date(),
                deletedAt: null,
            };

            const testGroup: GroupDocument = {
                id: 'test-group',
                name: 'Test Group',
                description: 'Test Description',
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

            mockFirestoreReader.getExpense.mockResolvedValue(testExpense);
            mockFirestoreReader.getGroup.mockResolvedValue(testGroup);
            const { isGroupMemberAsync } = await import('../../../utils/groupHelpers');
            vi.mocked(isGroupMemberAsync).mockResolvedValue(true);

            await expect(
                (commentService as any).verifyCommentAccess('expense', 'test-expense', 'user-id', 'test-group')
            ).resolves.not.toThrow();

            expect(mockFirestoreReader.getExpense).toHaveBeenCalledWith('test-expense');
            expect(mockFirestoreReader.getGroup).toHaveBeenCalledWith('test-group');
            expect(isGroupMemberAsync).toHaveBeenCalledWith('test-group', 'user-id');
        });

        it('should throw NOT_FOUND when expense does not exist', async () => {
            mockFirestoreReader.getExpense.mockResolvedValue(null);

            await expect(
                (commentService as any).verifyCommentAccess('expense', 'nonexistent-expense', 'user-id', 'test-group')
            ).rejects.toThrow(ApiError);

            expect(mockFirestoreReader.getExpense).toHaveBeenCalledWith('nonexistent-expense');
        });

        it('should throw EXPENSE_GROUP_MISMATCH when expense belongs to different group', async () => {
            const testExpense: ExpenseDocument = {
                id: 'test-expense',
                groupId: 'different-group', // Different from the provided groupId
                createdBy: 'user-id',
                paidBy: 'user-id',
                amount: 100,
                currency: 'USD',
                description: 'Test Description',
                category: 'category',
                date: new Date().toISOString(),
                splitType: 'equal' as const,
                participants: ['user-id'],
                splits: [{ userId: 'user-id', amount: 100 }],
                deletedBy: null,
                createdAt: new Date(),
                updatedAt: new Date(),
                deletedAt: null,
            };

            const testGroup: GroupDocument = {
                id: 'test-group',
                name: 'Test Group',
                description: 'Test Description',
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

            mockFirestoreReader.getExpense.mockResolvedValue(testExpense);
            mockFirestoreReader.getGroup.mockResolvedValue(testGroup);
            const { isGroupMemberAsync } = await import('../../../utils/groupHelpers');
            vi.mocked(isGroupMemberAsync).mockResolvedValue(true);

            await expect(
                (commentService as any).verifyCommentAccess('expense', 'test-expense', 'user-id', 'test-group')
            ).rejects.toThrow(ApiError);

            const error = await (commentService as any).verifyCommentAccess('expense', 'test-expense', 'user-id', 'test-group')
                .catch((e: ApiError) => e);
            
            expect(error.message).toContain('does not belong to the specified group');
        });
    });

    describe('dependency injection', () => {
        it('should use injected FirestoreReader for group reads', async () => {
            const testGroup: GroupDocument = {
                id: 'test-group',
                name: 'Test Group',
                description: 'Test Description',
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
            const { isGroupMemberAsync } = await import('../../../utils/groupHelpers');
            vi.mocked(isGroupMemberAsync).mockResolvedValue(true);

            await (commentService as any).verifyCommentAccess('group', 'test-group', 'user-id');

            expect(mockFirestoreReader.getGroup).toHaveBeenCalledWith('test-group');
        });

        it('should use injected FirestoreReader for expense reads', async () => {
            const testExpense: ExpenseDocument = {
                id: 'test-expense',
                groupId: 'test-group',
                createdBy: 'user-id',
                paidBy: 'user-id',
                amount: 100,
                currency: 'USD',
                description: 'Test Description',
                category: 'category',
                date: new Date().toISOString(),
                splitType: 'equal' as const,
                participants: ['user-id'],
                splits: [{ userId: 'user-id', amount: 100 }],
                deletedBy: null,
                createdAt: new Date(),
                updatedAt: new Date(),
                deletedAt: null,
            };

            mockFirestoreReader.getExpense.mockResolvedValue(testExpense);

            // Test the listComments method which calls getExpense
            await expect(
                (commentService as any).listComments('expense', 'test-expense', 'user-id', { groupId: 'test-group' })
            ).rejects.toThrow(); // Will throw due to incomplete mocking, but we verify the reader call

            expect(mockFirestoreReader.getExpense).toHaveBeenCalledWith('test-expense');
        });
    });
});