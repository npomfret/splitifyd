import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GroupMemberService } from '../../../services/GroupMemberService';
import { MockFirestoreReader } from '../../test-utils/MockFirestoreReader';
import { ServiceRegistry } from '../../../services/ServiceRegistry';
import type { GroupMemberDocument } from '@splitifyd/shared';
import type { UserService } from '../../../services/UserService2';

describe('GroupMemberService', () => {
    let groupMemberService: GroupMemberService;
    let mockFirestoreReader: MockFirestoreReader;

    beforeEach(() => {
        mockFirestoreReader = new MockFirestoreReader();
        groupMemberService = new GroupMemberService(mockFirestoreReader);
    });

    describe('getGroupMembersResponseFromSubcollection', () => {
        it('should return members with profile data', async () => {
            // Mock UserService for profile enrichment
            const mockUserService: Partial<UserService> = {
                getUsers: vi.fn().mockResolvedValue(new Map())
            };
            const registry = ServiceRegistry.getInstance();
            registry.registerService('UserService', () => mockUserService as UserService);
            
            const groupId = 'test-group';
            const testMembers: GroupMemberDocument[] = [
                mockFirestoreReader.createTestGroupMemberDocument({
                    userId: 'user1',
                    groupId,
                    memberRole: 'admin'
                }),
                mockFirestoreReader.createTestGroupMemberDocument({
                    userId: 'user2', 
                    groupId,
                    memberRole: 'member'
                })
            ];

            // Mock the subcollection data
            mockFirestoreReader.mockGroupMembersSubcollection(groupId, testMembers);

            const result = await groupMemberService.getGroupMembersResponseFromSubcollection(groupId);

            expect(result.members).toHaveLength(2);
            expect(result.hasMore).toBe(false);
            expect(mockFirestoreReader.getMembersFromSubcollection).toHaveBeenCalledWith(groupId);
        });

        it('should handle empty member list', async () => {
            // Mock UserService for profile enrichment
            const mockUserService: Partial<UserService> = {
                getUsers: vi.fn().mockResolvedValue(new Map())
            };
            const registry = ServiceRegistry.getInstance();
            registry.registerService('UserService', () => mockUserService as UserService);
            
            const groupId = 'empty-group';
            mockFirestoreReader.mockGroupMembersSubcollection(groupId, []);

            const result = await groupMemberService.getGroupMembersResponseFromSubcollection(groupId);

            expect(result.members).toHaveLength(0);
            expect(result.hasMore).toBe(false);
        });
    });

    describe('getMemberFromSubcollection', () => {
        it('should return member if exists', async () => {
            const groupId = 'test-group';
            const userId = 'test-user';
            const testMember = mockFirestoreReader.createTestGroupMemberDocument({
                userId,
                groupId
            });

            mockFirestoreReader.mockMemberInSubcollection(groupId, testMember);

            const result = await groupMemberService.getMemberFromSubcollection(groupId, userId);

            expect(result).toEqual(testMember);
            expect(mockFirestoreReader.getMemberFromSubcollection).toHaveBeenCalledWith(groupId, userId);
        });

        it('should return null if member does not exist', async () => {
            const groupId = 'test-group';
            const userId = 'nonexistent-user';

            mockFirestoreReader.getMemberFromSubcollection.mockResolvedValue(null);

            const result = await groupMemberService.getMemberFromSubcollection(groupId, userId);

            expect(result).toBeNull();
            expect(mockFirestoreReader.getMemberFromSubcollection).toHaveBeenCalledWith(groupId, userId);
        });
    });

    describe('getMembersFromSubcollection', () => {
        it('should return all members for a group', async () => {
            const groupId = 'test-group';
            const testMembers: GroupMemberDocument[] = [
                mockFirestoreReader.createTestGroupMemberDocument({
                    userId: 'user1',
                    groupId
                }),
                mockFirestoreReader.createTestGroupMemberDocument({
                    userId: 'user2',
                    groupId
                })
            ];

            mockFirestoreReader.mockGroupMembersSubcollection(groupId, testMembers);

            const result = await groupMemberService.getMembersFromSubcollection(groupId);

            expect(result).toEqual(testMembers);
            expect(mockFirestoreReader.getMembersFromSubcollection).toHaveBeenCalledWith(groupId);
        });
    });
});