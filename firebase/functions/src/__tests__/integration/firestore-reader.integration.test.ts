/**
 * FirestoreReader Integration Tests
 * 
 * Tests that would have caught the groups API bug where getGroupsForUser
 * was using the old members.userId query instead of subcollection architecture.
 * 
 * These tests use the Firebase emulator to verify actual Firestore operations.
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { getFirestoreReader, registerAllServices } from '../../services/serviceRegistration';
import {ApiDriver, CreateGroupRequestBuilder, UserRegistrationBuilder} from '@splitifyd/test-support';

describe('FirestoreReader Integration Tests', () => {
    const apiDriver = new ApiDriver();

    beforeAll(async () => {
        registerAllServices();
    });

    afterAll(async () => {
    });

    describe('getGroupsForUser', () => {
        test('should return groups for user using subcollection architecture', async () => {
            // Create fresh user for this specific test
            const testUser = await apiDriver.createUser(
                new UserRegistrationBuilder()
                    .withEmail(`firestore-test-subcollection-${Date.now()}@test.com`)
                    .withDisplayName('Test User Subcollection')
                    .build()
            );

            // Create a group using the API (which properly creates subcollections)
            const groupRequest = new CreateGroupRequestBuilder()
                .withName('FirestoreReader Test Group')
                .withDescription('Test group for FirestoreReader integration')
                .build();

            const createResponse = await apiDriver.createGroup(groupRequest, testUser.token);
            const groupId = createResponse.id;

            // Now test FirestoreReader.getGroupsForUser
            const firestoreReader = getFirestoreReader();
            const groups = await firestoreReader.getGroupsForUser(testUser.uid);

            // Should find the created group
            expect(groups).toHaveLength(1);
            expect(groups[0].id).toBe(groupId);
            expect(groups[0].name).toBe('FirestoreReader Test Group');

            // This test would have FAILED before the fix because:
            // 1. Old implementation: .where(`members.${userId}`, '!=', null)
            // 2. New subcollections don't have members field on Group document
            // 3. Query would return empty array
            // 4. Test would fail: expect(groups).toHaveLength(1) ❌ but got 0
        });

        test('should return empty array for user with no groups', async () => {
            // Create a truly fresh user by generating a new one
            const testUser = await apiDriver.createUser(
                new UserRegistrationBuilder()
                    .withEmail(`firestore-test-empty-${Date.now()}@test.com`)
                    .withDisplayName('Test User Empty')
                    .build()
            );

            const firestoreReader = getFirestoreReader();
            const groups = await firestoreReader.getGroupsForUser(testUser.uid);

            expect(groups).toHaveLength(0);
        });

        test('should handle pagination options correctly', async () => {
            // Create a fresh user specifically for this pagination test
            const testUser = await apiDriver.createUser(
                new UserRegistrationBuilder()
                    .withEmail(`firestore-test-pagination-${Date.now()}@test.com`)
                    .withDisplayName('Test User Pagination')
                    .build()
            );

            // Create multiple groups
            const groupNames = ['Group A', 'Group B', 'Group C'];
            const groupIds: string[] = [];

            for (const name of groupNames) {
                const groupRequest = new CreateGroupRequestBuilder()
                    .withName(name)
                    .withDescription(`Test group ${name}`)
                    .build();

                const createResponse = await apiDriver.createGroup(groupRequest, testUser.token);
                groupIds.push(createResponse.id);
            }

            const firestoreReader = getFirestoreReader();

            // Test limit
            const limitedGroups = await firestoreReader.getGroupsForUser(testUser.uid, { limit: 2 });
            expect(limitedGroups).toHaveLength(2);

            // Test ordering
            const allGroups = await firestoreReader.getGroupsForUser(testUser.uid, {
                orderBy: { field: 'name', direction: 'asc' }
            });
            expect(allGroups).toHaveLength(3);
            expect(allGroups[0].name).toBe('Group A');
            expect(allGroups[1].name).toBe('Group B');
            expect(allGroups[2].name).toBe('Group C');
        });
    });

    describe('other methods integration tests', () => {
        test('should get group by id', async () => {
            // Create fresh user for this specific test
            const testUser = await apiDriver.createUser(
                new UserRegistrationBuilder()
                    .withEmail(`firestore-test-getgroup-${Date.now()}@test.com`)
                    .withDisplayName('Test User GetGroup')
                    .build()
            );

            const groupRequest = new CreateGroupRequestBuilder()
                .withName('Group for getGroup test')
                .build();

            const createResponse = await apiDriver.createGroup(groupRequest, testUser.token);
            const groupId = createResponse.id;

            const firestoreReader = getFirestoreReader();
            const group = await firestoreReader.getGroup(groupId);

            expect(group).toBeDefined();
            expect(group!.id).toBe(groupId);
            expect(group!.name).toBe('Group for getGroup test');
        });

        test('should return null for non-existent group', async () => {
            const firestoreReader = getFirestoreReader();
            const group = await firestoreReader.getGroup('non-existent-id');

            expect(group).toBeNull();
        });
    });
});