/**
 * Invalid Data Resilience Unit Tests
 *
 * This test suite verifies that the API continues to function correctly
 * even when invalid data exists in Firestore. Uses the firebase-simulator
 * for fast in-memory testing without requiring the Firebase emulator.
 *
 * Add new invalid data scenarios here as they're discovered in production.
 */

import type { UserId } from '@billsplit-wl/shared';
import { toGroupId } from '@billsplit-wl/shared';
import { convertToISOString, CreateGroupRequestBuilder, GroupDTOBuilder, GroupMemberDocumentBuilder } from '@billsplit-wl/test-support';
import { Timestamp } from 'firebase-admin/firestore';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FirestoreCollections } from '../../../constants';
import { createTopLevelMembershipDocument } from '../../../utils/groupMembershipHelpers';
import { newTopLevelMembershipDocId } from '../../../utils/idGenerator';
import { AppDriver } from '../AppDriver';

describe('Invalid Data Resilience - API should not break with bad data', () => {
    let appDriver: AppDriver;
    let testUser: UserId;
    let validGroupId: string;

    beforeEach(async () => {
        appDriver = new AppDriver();

        const { users } = await appDriver.createTestUsers({ count: 1 });
        [testUser] = users;

        // Create a valid group for comparison
        const groupRequest = new CreateGroupRequestBuilder()
            .withName('Valid Test Group')
            .withDescription('A properly created group for testing')
            .build();

        const createResponse = await appDriver.createGroup(groupRequest, testUser);
        validGroupId = createResponse.id;
    });

    afterEach(() => {
        appDriver.dispose();
    });

    describe('Invalid permissions values', () => {
        it('GET /groups should return successfully despite invalid permission values', async () => {
            const db = appDriver.firestoreStub;

            // Create groups with invalid permissions configurations
            const invalidPermissionCases: Array<{ name: string; mutate: (permissions: any) => any; }> = [
                {
                    name: 'Invalid Expense Editing Permission',
                    mutate: (permissions: any) => ({
                        ...permissions,
                        expenseEditing: 'invalid-value',
                    }),
                },
                {
                    name: 'Non-string Member Invitation Permission',
                    mutate: (permissions: any) => ({
                        ...permissions,
                        memberInvitation: 123 as any,
                    }),
                },
                {
                    name: 'Incomplete Permissions Object',
                    mutate: () => ({
                        expenseEditing: 'anyone',
                    }),
                },
            ];

            for (const { name, mutate } of invalidPermissionCases) {
                const groupId = `invalid-group-${Date.now()}-${Math.random().toString(36).slice(2)}`;

                // Build valid group data, then corrupt the permissions field
                const validGroup = new GroupDTOBuilder()
                    .withName(`Invalid Permissions Group - ${name}`)
                    .withDescription('Group with invalid permissions configuration')
                    .withCreatedBy(testUser)
                    .build();

                const now = Timestamp.now();
                // Corrupt the permissions field - this is the invalid data we're testing
                const corruptedGroup = {
                    name: validGroup.name,
                    description: validGroup.description,
                    createdBy: validGroup.createdBy,
                    permissions: mutate(validGroup.permissions),
                    id: groupId,
                    createdAt: now,
                    updatedAt: now,
                };

                db.seed(`${FirestoreCollections.GROUPS}/${groupId}`, corruptedGroup);

                // Create valid member document for top-level collection
                const memberDoc = new GroupMemberDocumentBuilder()
                    .withUserId(testUser)
                    .withGroupId(groupId)
                    .asAdmin()
                    .asActive()
                    .build();

                const topLevelMemberDoc = createTopLevelMembershipDocument(memberDoc, convertToISOString(new Date()));
                const topLevelDocId = newTopLevelMembershipDocId(testUser, toGroupId(groupId));
                db.seed(`${FirestoreCollections.GROUP_MEMBERSHIPS}/${topLevelDocId}`, topLevelMemberDoc);
            }

            // Call the API endpoint that would normally fail with invalid data
            const response = await appDriver.listGroups({}, testUser);

            // API should return successfully
            expect(response).toBeDefined();
            expect(response.groups).toBeDefined();
            expect(Array.isArray(response.groups)).toBe(true);

            // Should include the valid group
            const validGroup = response.groups.find((g) => g.id === validGroupId);
            expect(validGroup).toBeDefined();
            expect(validGroup?.name).toBe('Valid Test Group');
        });

        it('should handle completely malformed group documents', async () => {
            const db = appDriver.firestoreStub;
            const malformedGroupId = `malformed-group-${Date.now()}`;

            // Create completely malformed data (missing required fields)
            const malformedGroup = {
                // Missing name, description, createdBy, etc.
                randomField: 'random-value',
                anotherBadField: { nested: { deeply: 'malformed' } },
                id: malformedGroupId,
            };

            db.seed(`${FirestoreCollections.GROUPS}/${malformedGroupId}`, malformedGroup);

            // API should handle malformed data gracefully - expect error for completely malformed data
            await expect(appDriver.getGroup(malformedGroupId, testUser)).rejects.toThrow();
        });

        it('should filter out corrupted documents from group listings', async () => {
            const db = appDriver.firestoreStub;
            const corruptedGroupId = `corrupted-group-${Date.now()}`;

            // Build valid group, then corrupt critical fields
            const validGroup = new GroupDTOBuilder()
                .withName('Corrupted Test Group')
                .withCreatedBy(testUser)
                .build();

            const corruptedGroup = {
                ...validGroup,
                createdBy: null, // Corrupt required field
                members: 'not-an-object', // Wrong type
                id: corruptedGroupId,
            };

            db.seed(`${FirestoreCollections.GROUPS}/${corruptedGroupId}`, corruptedGroup);

            // Create membership so the user would see this group
            const memberDoc = new GroupMemberDocumentBuilder()
                .withUserId(testUser)
                .withGroupId(corruptedGroupId)
                .asAdmin()
                .asActive()
                .build();

            const topLevelMemberDoc = createTopLevelMembershipDocument(memberDoc, convertToISOString(new Date()));
            const topLevelDocId = newTopLevelMembershipDocId(testUser, toGroupId(corruptedGroupId));
            db.seed(`${FirestoreCollections.GROUP_MEMBERSHIPS}/${topLevelDocId}`, topLevelMemberDoc);

            // Should handle corrupted data without crashing
            const response = await appDriver.listGroups({}, testUser);

            expect(response.groups).toBeDefined();
            expect(Array.isArray(response.groups)).toBe(true);

            // Corrupted group should be filtered out or sanitized
            const corruptedGroupInResult = response.groups.find((g) => g.id === corruptedGroupId);
            expect(corruptedGroupInResult).toBeUndefined();

            // Valid group should still be present
            const validGroupInResult = response.groups.find((g) => g.id === validGroupId);
            expect(validGroupInResult).toBeDefined();
        });

        it('should handle groups with missing timestamps', async () => {
            const db = appDriver.firestoreStub;
            const noTimestampGroupId = `no-timestamp-group-${Date.now()}`;

            // Group without createdAt/updatedAt timestamps
            const groupWithoutTimestamps = {
                id: noTimestampGroupId,
                name: 'No Timestamps Group',
                description: 'Group missing timestamp fields',
                createdBy: testUser,
                permissions: {
                    expenseEditing: 'anyone',
                    memberInvitation: 'anyone',
                },
                // Missing: createdAt, updatedAt
            };

            db.seed(`${FirestoreCollections.GROUPS}/${noTimestampGroupId}`, groupWithoutTimestamps);

            // Create membership
            const memberDoc = new GroupMemberDocumentBuilder()
                .withUserId(testUser)
                .withGroupId(noTimestampGroupId)
                .asAdmin()
                .asActive()
                .build();

            const topLevelMemberDoc = createTopLevelMembershipDocument(memberDoc, convertToISOString(new Date()));
            const topLevelDocId = newTopLevelMembershipDocId(testUser, toGroupId(noTimestampGroupId));
            db.seed(`${FirestoreCollections.GROUP_MEMBERSHIPS}/${topLevelDocId}`, topLevelMemberDoc);

            // Should handle missing timestamps gracefully
            const response = await appDriver.listGroups({}, testUser);

            expect(response.groups).toBeDefined();
            expect(Array.isArray(response.groups)).toBe(true);
        });

        it('should handle groups with wrong timestamp types', async () => {
            const db = appDriver.firestoreStub;
            const wrongTypeGroupId = `wrong-type-group-${Date.now()}`;

            // Group with wrong timestamp types (strings instead of Timestamps)
            const groupWithWrongTypes = {
                id: wrongTypeGroupId,
                name: 'Wrong Types Group',
                description: 'Group with wrong timestamp types',
                createdBy: testUser,
                permissions: {
                    expenseEditing: 'anyone',
                    memberInvitation: 'anyone',
                },
                createdAt: '2024-01-01T00:00:00Z', // String instead of Timestamp
                updatedAt: 12345, // Number instead of Timestamp
            };

            db.seed(`${FirestoreCollections.GROUPS}/${wrongTypeGroupId}`, groupWithWrongTypes);

            // Create membership
            const memberDoc = new GroupMemberDocumentBuilder()
                .withUserId(testUser)
                .withGroupId(wrongTypeGroupId)
                .asAdmin()
                .asActive()
                .build();

            const topLevelMemberDoc = createTopLevelMembershipDocument(memberDoc, convertToISOString(new Date()));
            const topLevelDocId = newTopLevelMembershipDocId(testUser, toGroupId(wrongTypeGroupId));
            db.seed(`${FirestoreCollections.GROUP_MEMBERSHIPS}/${topLevelDocId}`, topLevelMemberDoc);

            // Should handle wrong types gracefully
            const response = await appDriver.listGroups({}, testUser);

            expect(response.groups).toBeDefined();
            expect(Array.isArray(response.groups)).toBe(true);
        });
    });
});
