/**
 * Invalid Data Resilience Integration Tests
 *
 * This test suite verifies that the API continues to function correctly
 * even when invalid data exists in Firestore. It focuses on testing the
 * end-to-end behavior that requires actual Firebase interaction.
 *
 * IMPORTANT: Data validation and sanitization logic has been moved to unit tests:
 * - FirestoreReader.validation.unit.test.ts - Tests data sanitization without Firebase
 * - These integration tests focus on actual API behavior with real Firebase
 *
 * Add new invalid data scenarios here as they're discovered in production.
 */

import { describe, test, expect, beforeAll, beforeEach } from 'vitest';
import { getFirestore } from '../../firebase';
import { Timestamp } from 'firebase-admin/firestore';
import { ApiDriver, CreateGroupRequestBuilder, GroupDTOBuilder } from '@splitifyd/test-support';
import { FirestoreReader } from '../../services/firestore';
import { getTopLevelMembershipDocId, createTopLevelMembershipDocument } from '../../utils/groupMembershipHelpers';
import { GroupMemberDocumentBuilder } from '../support/GroupMemberDocumentBuilder';
import { FirestoreCollections } from '../../constants';

describe('Invalid Data Resilience - API should not break with bad data', () => {
    const firestore = getFirestore();
    const apiDriver = new ApiDriver();
    let testUser: any;
    let validGroupId: string;

    beforeAll(async () => {
        // Use pooled user instead of creating a custom one
        testUser = await apiDriver.createUser();

        // Create a valid group for comparison
        const groupRequest = new CreateGroupRequestBuilder().withName('Valid Test Group').withDescription('A properly created group for testing').build();

        const createResponse = await apiDriver.createGroup(groupRequest, testUser.token);
        validGroupId = createResponse.id;
    });

    describe('Invalid securityPreset values', () => {
        let testGroupIds: string[] = []; // Track groups created in each test

        beforeEach(async () => {
            testGroupIds = [];

            // Create groups with invalid securityPreset values using builders
            const invalidSecurityPresets = ['unknown', 123, null];
            const invalidGroupNames = ['Invalid SecurityPreset Group - Unknown', 'Invalid SecurityPreset Group - Numeric', 'Invalid SecurityPreset Group - Null'];

            for (let i = 0; i < invalidSecurityPresets.length; i++) {
                const groupRef = firestore.collection(FirestoreCollections.GROUPS).doc();

                // Build valid group data, then corrupt the securityPreset field
                // Note: GroupDTOBuilder produces DTOs with ISO strings, but we're writing to Firestore
                // which requires Timestamps. We must convert ALL date fields.
                const validGroup = new GroupDTOBuilder().withName(invalidGroupNames[i]).withDescription('Group with invalid securityPreset').withCreatedBy(testUser.uid).build();

                const now = Timestamp.now();
                // Corrupt the securityPreset field - this is the invalid data we're testing
                const corruptedGroup = {
                    name: validGroup.name,
                    description: validGroup.description,
                    createdBy: validGroup.createdBy,
                    permissions: validGroup.permissions,
                    securityPreset: invalidSecurityPresets[i],
                    id: groupRef.id,
                    // All timestamps must be Firestore Timestamps, not ISO strings
                    createdAt: now,
                    updatedAt: now,
                    presetAppliedAt: now,
                };

                await groupRef.set(corruptedGroup);
                testGroupIds.push(groupRef.id);

                // Create valid member document for top-level collection
                const memberDoc = new GroupMemberDocumentBuilder().withUserId(testUser.uid).withGroupId(groupRef.id).asAdmin().asActive().build();

                const topLevelMemberDoc = createTopLevelMembershipDocument(memberDoc, new Date().toISOString());
                const topLevelDocId = getTopLevelMembershipDocId(testUser.uid, groupRef.id);
                const topLevelRef = firestore.collection(FirestoreCollections.GROUP_MEMBERSHIPS).doc(topLevelDocId);
                await topLevelRef.set(topLevelMemberDoc);
            }
        });

        afterEach(async () => {});

        test('GET /groups should return successfully despite invalid securityPreset values', async () => {
            // Call the API endpoint that would normally fail with invalid data
            const response = await apiDriver.listGroups(testUser.token);

            // API should return successfully
            expect(response).toBeDefined();
            expect(response.groups).toBeDefined();
            expect(Array.isArray(response.groups)).toBe(true);

            // Should include the valid group
            const validGroup = response.groups.find((g: any) => g.id === validGroupId);
            expect(validGroup).toBeDefined();
            expect(validGroup?.name).toBe('Valid Test Group');
        });

        // REMOVED: Individual group securityPreset validation test
        // This is now covered by unit tests (FirestoreReader.validation.unit.test.ts)
        // which are faster and don't require Firebase setup.
        // The GET /groups test above already validates that invalid presets don't break the list endpoint.

        test('should handle completely malformed group documents', async () => {
            const malformedGroupRef = firestore.collection(FirestoreCollections.GROUPS).doc();

            // Create completely malformed data (missing required fields)
            const malformedGroup = {
                // Missing name, description, createdBy, etc.
                randomField: 'random-value',
                anotherBadField: { nested: { deeply: 'malformed' } },
                id: malformedGroupRef.id,
            };

            await malformedGroupRef.set(malformedGroup);
            testGroupIds.push(malformedGroupRef.id);

            // API should handle malformed data gracefully - expect internal error for completely malformed data
            await expect(apiDriver.getGroup(malformedGroupRef.id, testUser.token)).rejects.toThrow(/INTERNAL_ERROR|Group not found|Permission denied|Invalid data/);
        });

        test('should validate data integrity in FirestoreReader with corrupted documents', async () => {
            const corruptedGroupRef = firestore.collection(FirestoreCollections.GROUPS).doc();

            // Build valid group, then corrupt critical fields
            const validGroup = new GroupDTOBuilder().withName('Corrupted Test Group').withCreatedBy(testUser.uid).build();

            const corruptedGroup = {
                ...validGroup,
                createdBy: null, // Corrupt required field
                members: 'not-an-object', // Wrong type
                id: corruptedGroupRef.id,
            };

            await corruptedGroupRef.set(corruptedGroup);
            testGroupIds.push(corruptedGroupRef.id);

            const firestoreReader = new FirestoreReader(getFirestore());

            // Should handle corrupted data without crashing
            const result = await firestoreReader.getGroupsForUserV2(testUser.uid);

            expect(result.data).toBeDefined();
            expect(Array.isArray(result.data)).toBe(true);

            // Corrupted group should be filtered out or sanitized
            const corruptedGroupInResult = result.data.find((g: any) => g.id === corruptedGroupRef.id);
            expect(corruptedGroupInResult).toBeUndefined();
        });

        // NOTE: Additional data validation scenarios have been moved to unit tests:
        // - FirestoreReader.validation.unit.test.ts covers securityPreset sanitization
        // - Timestamp validation, missing fields, and wrong data types
        // - These unit tests are faster and provide better isolation
    });
});
