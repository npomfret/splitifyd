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
import { ApiDriver, CreateGroupRequestBuilder, FirestoreGroupBuilder, GroupMemberDocumentBuilder } from '@splitifyd/test-support';
import { FirestoreCollections } from '@splitifyd/shared';
import { FirestoreReader } from '../../services/firestore';
import { getTopLevelMembershipDocId, createTopLevelMembershipDocument } from '../../utils/groupMembershipHelpers';

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
                const validGroup = new FirestoreGroupBuilder().withName(invalidGroupNames[i]).withDescription('Group with invalid securityPreset').withCreatedBy(testUser.uid).build();

                // Corrupt the securityPreset field
                const corruptedGroup = {
                    ...validGroup,
                    securityPreset: invalidSecurityPresets[i],
                    id: groupRef.id,
                };

                await groupRef.set(corruptedGroup);
                testGroupIds.push(groupRef.id);

                // Create valid member document for top-level collection
                const memberDoc = new GroupMemberDocumentBuilder(testUser.uid, groupRef.id).asAdmin().asActive().build();

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

            // Should handle groups with invalid data (either skip them or sanitize)
            // The important thing is the API doesn't crash
            console.log(`API returned ${response.groups.length} groups successfully`);
        });

        // REMOVED: FirestoreReader validation test - moved to FirestoreReader.validation.unit.test.ts
        // This test is now covered by unit tests which are faster and don't require Firebase setup

        test('GET /groups/:id should handle invalid securityPreset for specific group', async () => {
            const invalidGroupRef = firestore.collection(FirestoreCollections.GROUPS).doc();

            // Build valid group data, then corrupt securityPreset
            const validGroup = new FirestoreGroupBuilder().withName('Direct Access Invalid Group').withDescription('Testing direct access to invalid group').withCreatedBy(testUser.uid).build();

            const corruptedGroup = {
                ...validGroup,
                securityPreset: 'totally-invalid-value',
                id: invalidGroupRef.id,
            };

            await invalidGroupRef.set(corruptedGroup);
            testGroupIds.push(invalidGroupRef.id);

            // Create valid member document
            const memberDoc = new GroupMemberDocumentBuilder(testUser.uid, invalidGroupRef.id).asAdmin().asActive().build();

            const topLevelMemberDoc = createTopLevelMembershipDocument(memberDoc, new Date().toISOString());
            const topLevelDocId = getTopLevelMembershipDocId(testUser.uid, invalidGroupRef.id);
            const topLevelRef = firestore.collection(FirestoreCollections.GROUP_MEMBERSHIPS).doc(topLevelDocId);
            await topLevelRef.set(topLevelMemberDoc);

            // API should handle the invalid data gracefully
            const response = await apiDriver.getGroup(invalidGroupRef.id, testUser.token);

            expect(response).toBeDefined();
            expect(response.id).toBe(invalidGroupRef.id);

            // If securityPreset is present in response, it should be valid (defaulted to 'open')
            expect(response.securityPreset).toBe('open');
        });

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
            const validGroup = new FirestoreGroupBuilder().withName('Corrupted Test Group').withCreatedBy(testUser.uid).build();

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
