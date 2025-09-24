import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GroupMemberService } from '../../../services/GroupMemberService';
import { ApplicationBuilder } from '../../../services/ApplicationBuilder';
import { StubFirestoreReader, StubFirestoreWriter, StubAuthService } from '../mocks/firestore-stubs';
import { FirestoreGroupBuilder } from '@splitifyd/test-support';
import type { GroupMemberDocument } from '@splitifyd/shared';

// Mock logger
vi.mock('../../../logger', () => ({
    logger: {
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
    },
    LoggerContext: {
        setBusinessContext: vi.fn(),
        clearBusinessContext: vi.fn(),
    },
}));

describe('GroupMemberService Unit Tests', () => {
    let groupMemberService: GroupMemberService;
    let stubReader: StubFirestoreReader;
    let stubWriter: StubFirestoreWriter;
    let stubAuth: StubAuthService;
    let applicationBuilder: ApplicationBuilder;

    const testGroupId = 'test-group-id';
    const testUserId1 = 'user-1';
    const testUserId2 = 'user-2';
    const testUserId3 = 'user-3';

    const defaultTheme = {
        light: '#FF6B6B',
        dark: '#FF6B6B',
        name: 'Test Theme',
        pattern: 'solid' as const,
        assignedAt: new Date().toISOString(),
        colorIndex: 0
    };

    beforeEach(() => {
        // Create stubs
        stubReader = new StubFirestoreReader();
        stubWriter = new StubFirestoreWriter();
        stubAuth = new StubAuthService();

        // Pass stubs directly to ApplicationBuilder constructor
        applicationBuilder = new ApplicationBuilder(stubReader, stubWriter, stubAuth);
        groupMemberService = applicationBuilder.buildGroupMemberService();

        // Setup test group using builder
        const testGroup = new FirestoreGroupBuilder()
            .withId(testGroupId)
            .withName('Test Group')
            .build();
        stubReader.setDocument('groups', testGroupId, testGroup);

        vi.clearAllMocks();
    });

    describe('getGroupMember', () => {
        it('should return member if exists', async () => {
            const testMember = {
                userId: testUserId1,
                groupId: testGroupId,
                memberRole: 'member',
                memberStatus: 'active',
                theme: defaultTheme,
                joinedAt: new Date().toISOString()
            };

            stubReader.setDocument('group-members', `${testGroupId}_${testUserId1}`, testMember);

            const result = await groupMemberService.getGroupMember(testGroupId, testUserId1);

            expect(result).toEqual(testMember);
        });

        it('should return null if member does not exist', async () => {
            const nonExistentUserId = 'nonexistent-user';

            const result = await groupMemberService.getGroupMember(testGroupId, nonExistentUserId);

            expect(result).toBeNull();
        });

        it('should handle invalid group ID', async () => {
            const invalidGroupId = '';

            const result = await groupMemberService.getGroupMember(invalidGroupId, testUserId1);

            expect(result).toBeNull();
        });

        it('should handle invalid user ID', async () => {
            const invalidUserId = '';

            const result = await groupMemberService.getGroupMember(testGroupId, invalidUserId);

            expect(result).toBeNull();
        });
    });

    describe('getAllGroupMembers', () => {
        it('should return all members for a group', async () => {
            const testMembers: GroupMemberDocument[] = [
                {
                    userId: testUserId1,
                    groupId: testGroupId,
                    memberRole: 'member',
                    memberStatus: 'active',
                    theme: defaultTheme,
                    joinedAt: new Date().toISOString()
                },
                {
                    userId: testUserId2,
                    groupId: testGroupId,
                    memberRole: 'member',
                    memberStatus: 'active',
                    theme: defaultTheme,
                    joinedAt: new Date().toISOString()
                },
                {
                    userId: testUserId3,
                    groupId: testGroupId,
                    memberRole: 'admin',
                    memberStatus: 'active',
                    theme: defaultTheme,
                    joinedAt: new Date().toISOString()
                },
            ];

            // Set up group members in stub
            testMembers.forEach(member => {
                stubReader.setDocument('group-members', `${testGroupId}_${member.userId}`, member);
            });

            const result = await groupMemberService.getAllGroupMembers(testGroupId);

            expect(result).toEqual(testMembers);
            expect(result).toHaveLength(3);
        });

        it('should return empty array for group with no members', async () => {
            const result = await groupMemberService.getAllGroupMembers(testGroupId);

            expect(result).toEqual([]);
            expect(result).toHaveLength(0);
        });

        it('should handle invalid group ID', async () => {
            const invalidGroupId = '';

            const result = await groupMemberService.getAllGroupMembers(invalidGroupId);

            expect(result).toEqual([]);
        });
    });

    describe('isGroupMemberAsync', () => {
        it('should return true for existing group member', async () => {
            const testMember = {
                userId: testUserId1,
                groupId: testGroupId,
                memberRole: 'member',
                memberStatus: 'active',
                theme: defaultTheme,
                joinedAt: new Date().toISOString()
            };

            stubReader.setDocument('group-members', `${testGroupId}_${testUserId1}`, testMember);

            const result = await groupMemberService.isGroupMemberAsync(testGroupId, testUserId1);

            expect(result).toBe(true);
        });

        it('should return false for non-existent group member', async () => {
            const nonExistentUserId = 'nonexistent-user';

            const result = await groupMemberService.isGroupMemberAsync(testGroupId, nonExistentUserId);

            expect(result).toBe(false);
        });

        it('should return false for invalid group ID', async () => {
            const invalidGroupId = '';

            const result = await groupMemberService.isGroupMemberAsync(invalidGroupId, testUserId1);

            expect(result).toBe(false);
        });

        it('should return false for invalid user ID', async () => {
            const invalidUserId = '';

            const result = await groupMemberService.isGroupMemberAsync(testGroupId, invalidUserId);

            expect(result).toBe(false);
        });
    });

    describe('member document structure validation', () => {
        it('should handle member documents with all required fields', async () => {
            const completeMember = {
                userId: testUserId1,
                groupId: testGroupId,
                memberRole: 'member',
                memberStatus: 'active',
                theme: defaultTheme,
                joinedAt: new Date().toISOString()
            };

            stubReader.setDocument('group-members', `${testGroupId}_${testUserId1}`, completeMember);

            const result = await groupMemberService.getGroupMember(testGroupId, testUserId1);

            expect(result).toBeDefined();
            expect(result?.userId).toBe(testUserId1);
            expect(result?.groupId).toBe(testGroupId);
            expect(result?.memberRole).toBe('member');
            expect(result?.joinedAt).toBeDefined();
        });

        it('should handle member documents with admin role', async () => {
            const adminMember = {
                userId: testUserId1,
                groupId: testGroupId,
                memberRole: 'admin',
                memberStatus: 'active',
                theme: defaultTheme,
                joinedAt: new Date().toISOString()
            };

            stubReader.setDocument('group-members', `${testGroupId}_${testUserId1}`, adminMember);

            const result = await groupMemberService.getGroupMember(testGroupId, testUserId1);

            expect(result).toBeDefined();
            expect(result?.memberRole).toBe('admin');
        });
    });
});
