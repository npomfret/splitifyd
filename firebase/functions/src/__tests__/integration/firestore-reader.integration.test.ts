/**
 * FirestoreReader Integration Tests
 *
 * Tests that would have caught the groups API bug where getGroupsForUser
 * was using the old members.userId query instead of subcollection architecture.
 *
 * These tests use the Firebase emulator to verify actual Firestore operations.
 */

import { describe, test, expect } from 'vitest';
import { ApiDriver, CreateGroupRequestBuilder, UserRegistrationBuilder } from '@splitifyd/test-support';
import { FirestoreReader } from '../../services/firestore';
import { getFirestore } from '../../firebase';

describe('FirestoreReader Integration Tests', () => {
    const apiDriver = new ApiDriver();
    const firestoreReader = new FirestoreReader(getFirestore());

    describe('getGroupsForUser', () => {
        test('should return groups for user using V2 top-level collection architecture', async () => {
            // Create fresh user for this specific test
            const testUser = await apiDriver.createUser(new UserRegistrationBuilder().withEmail(`firestore-test-v2-${Date.now()}@test.com`).withDisplayName('Test User V2').build());

            // Create a group using the API (which now creates both subcollection and top-level membership)
            const groupRequest = new CreateGroupRequestBuilder().withName('FirestoreReader Test Group V2').withDescription('Test group for FirestoreReader V2 integration').build();

            const createResponse = await apiDriver.createGroup(groupRequest, testUser.token);
            const groupId = createResponse.id;

            // Test the V2 method which queries the top-level GROUP_MEMBERSHIPS collection
            const paginatedGroups = await firestoreReader.getGroupsForUserV2(testUser.uid);

            // Should find the created group
            expect(paginatedGroups.data).toHaveLength(1);
            expect(paginatedGroups.data[0].id).toBe(groupId);
            expect(paginatedGroups.data[0].name).toBe('FirestoreReader Test Group V2');
            expect(paginatedGroups.hasMore).toBe(false);

            // This tests the V2 implementation that uses:
            // 1. Top-level GROUP_MEMBERSHIPS collection query
            // 2. Database-level ordering for proper pagination
            // 3. Improved performance for large user datasets
        });

        test('should return empty array for user with no groups', async () => {
            // Create a truly fresh user by generating a new one
            const testUser = await apiDriver.createUser(new UserRegistrationBuilder().withEmail(`firestore-test-empty-${Date.now()}@test.com`).withDisplayName('Test User Empty').build());

            const paginatedGroups = await firestoreReader.getGroupsForUserV2(testUser.uid);

            expect(paginatedGroups.data).toHaveLength(0);
            expect(paginatedGroups.hasMore).toBe(false);
        });

        test('should handle pagination options correctly with V2 method', async () => {
            // Create a fresh user specifically for this pagination test
            const testUser = await apiDriver.createUser(
                new UserRegistrationBuilder().withEmail(`firestore-test-pagination-v2-${Date.now()}@test.com`).withDisplayName('Test User Pagination V2').build(),
            );

            // Create multiple groups
            const groupNames = ['Group A', 'Group B', 'Group C'];
            const groupIds: string[] = [];

            for (const name of groupNames) {
                const groupRequest = new CreateGroupRequestBuilder().withName(name).withDescription(`Test group ${name}`).build();

                const createResponse = await apiDriver.createGroup(groupRequest, testUser.token);
                groupIds.push(createResponse.id);
            }

            // Test limit - should return paginated result with hasMore=true
            const limitedGroups = await firestoreReader.getGroupsForUserV2(testUser.uid, { limit: 2 });
            expect(limitedGroups.data).toHaveLength(2);
            expect(limitedGroups.hasMore).toBe(true);
            expect(limitedGroups.nextCursor).toBeDefined();

            // Test getting all groups (V2 uses database-level ordering by groupUpdatedAt)
            const allGroups = await firestoreReader.getGroupsForUserV2(testUser.uid, {
                orderBy: { field: 'updatedAt', direction: 'desc' },
            });
            expect(allGroups.data).toHaveLength(3);
            expect(allGroups.hasMore).toBe(false);

            // Verify all created groups are present
            const groupNamesInResult = allGroups.data.map((g) => g.name).sort();
            expect(groupNamesInResult).toEqual(['Group A', 'Group B', 'Group C']);
        });
    });

    describe('other methods integration tests', () => {
        test('should get group by id', async () => {
            // Create fresh user for this specific test
            const testUser = await apiDriver.createUser(new UserRegistrationBuilder().withEmail(`firestore-test-getgroup-${Date.now()}@test.com`).withDisplayName('Test User GetGroup').build());

            const groupRequest = new CreateGroupRequestBuilder().withName('Group for getGroup test').build();

            const createResponse = await apiDriver.createGroup(groupRequest, testUser.token);
            const groupId = createResponse.id;

            const group = await firestoreReader.getGroup(groupId);

            expect(group).toBeDefined();
            expect(group!.id).toBe(groupId);
            expect(group!.name).toBe('Group for getGroup test');
        });

        test('should return null for non-existent group', async () => {
            const group = await firestoreReader.getGroup('non-existent-id');

            expect(group).toBeNull();
        });
    });
});
