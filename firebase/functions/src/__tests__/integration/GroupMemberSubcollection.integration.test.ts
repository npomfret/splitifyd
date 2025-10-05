/**
 * Essential GroupMember Subcollection Integration Tests
 *
 * Tests Firestore collectionGroup queries and subcollection behavior that cannot be stubbed.
 * Most business logic is now covered by unit tests.
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { borrowTestUsers, CreateGroupRequestBuilder } from '@splitifyd/test-support';
import { PooledTestUser } from '@splitifyd/shared';
import { getAuth, getFirestore } from '../../firebase';
import { ApplicationBuilder } from '../../services/ApplicationBuilder';
import { GroupMemberDocumentBuilder } from "../support/GroupMemberDocumentBuilder";

describe('GroupMember Subcollection - Integration Tests (Essential Firestore Behavior)', () => {
    const firestore = getFirestore();
    const applicationBuilder = ApplicationBuilder.createApplicationBuilder(firestore, getAuth());
    const groupService = applicationBuilder.buildGroupService();
    const groupMemberService = applicationBuilder.buildGroupMemberService();
    const groupShareService = applicationBuilder.buildGroupShareService();

    let users: PooledTestUser[];
    let testUser1: PooledTestUser;
    let testUser2: PooledTestUser;
    let testGroup: any;

    beforeEach(async () => {
        users = await borrowTestUsers(3);
        testUser1 = users[0];
        testUser2 = users[1];

        testGroup = await groupService.createGroup(testUser1.uid,
            new CreateGroupRequestBuilder()
                .withName('Test Subcollection Group')
                .withDescription('Testing subcollection functionality')
                .build()
        );
    });

    describe('Firestore CollectionGroup Queries', () => {
        test('should execute collectionGroup query across multiple group subcollections', async () => {
            // This tests actual Firestore collectionGroup functionality that cannot be stubbed
            const group2 = await groupService.createGroup(testUser2.uid,
                new CreateGroupRequestBuilder()
                    .withName('User2 Group')
                    .withDescription('Second group')
                    .build()
            );

            // Add testUser1 to group2 via share link (production code path)
            const { linkId } = await groupShareService.generateShareableLink(testUser2.uid, group2.id);
            await groupShareService.joinGroupByLink(testUser1.uid, testUser1.email, linkId);

            // Test the actual Firestore collectionGroup query
            const userGroups = await groupMemberService.getUserGroupsViaSubcollection(testUser1.uid);

            // Should find groups across all subcollections where testUser1 is a member
            expect(userGroups).toContain(testGroup.id); // Creator of testGroup
            expect(userGroups).toContain(group2.id); // Member of group2
            expect(userGroups.length).toBeGreaterThanOrEqual(2);
        });

        test('should handle collectionGroup query scalability', async () => {
            // This tests Firestore's ability to efficiently query across many subcollections
            const groupPromises = [];
            for (let i = 0; i < 5; i++) {
                groupPromises.push(
                    groupService.createGroup(testUser1.uid,
                        new CreateGroupRequestBuilder()
                            .withName(`Scale Test Group ${i}`)
                            .withDescription(`Group ${i} for scalability testing`)
                            .build()
                    ),
                );
            }
            const groups = await Promise.all(groupPromises);

            // Query should efficiently find all groups using collectionGroup
            const userGroups = await groupMemberService.getUserGroupsViaSubcollection(testUser1.uid);

            // Should include original testGroup + 5 new groups = 6 total
            expect(userGroups.length).toBeGreaterThanOrEqual(6);

            // Verify all new groups are included in the collectionGroup query result
            const groupIds = groups.map((g) => g.id);
            for (const groupId of groupIds) {
                expect(userGroups).toContain(groupId);
            }
        });
    });
});