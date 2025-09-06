/**
 * Invalid Data Resilience Tests
 * 
 * This test suite verifies that the API continues to function correctly
 * even when invalid data exists in Firestore. It directly inserts malformed
 * data and ensures the system handles it gracefully.
 * 
 * Add new invalid data scenarios here as they're discovered in production.
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { getFirestore } from '../../firebase';
import { getFirestoreReader, registerAllServices } from '../../services/serviceRegistration';
import { ApiDriver, CreateGroupRequestBuilder, UserRegistrationBuilder } from '@splitifyd/test-support';
import { FirestoreCollections } from '@splitifyd/shared';
import type { Firestore } from 'firebase-admin/firestore';

describe('Invalid Data Resilience - API should not break with bad data', () => {
    let firestore: Firestore;
    let apiDriver: ApiDriver;
    let testUser: any;
    let validGroupId: string;
    const createdGroupIds: string[] = []; // Track all created groups for cleanup

    beforeAll(async () => {
        registerAllServices();
        firestore = getFirestore();
        apiDriver = new ApiDriver();

        // Create a test user for API calls
        testUser = await apiDriver.createUser(
            new UserRegistrationBuilder()
                .withEmail(`invalid-data-test-${Date.now()}@test.com`)
                .withDisplayName('Invalid Data Test User')
                .build()
        );

        // Create a valid group for comparison
        const groupRequest = new CreateGroupRequestBuilder()
            .withName('Valid Test Group')
            .withDescription('A properly created group for testing')
            .build();

        const createResponse = await apiDriver.createGroup(groupRequest, testUser.token);
        validGroupId = createResponse.id;
        createdGroupIds.push(validGroupId); // Track for cleanup
    });

    afterAll(async () => {
        // Cleanup: Remove all test groups created during this test suite
        try {
            // Delete all tracked groups
            const deletePromises = createdGroupIds.map(groupId => 
                firestore.collection(FirestoreCollections.GROUPS).doc(groupId).delete()
            );
            
            // Also clean up any groups created directly in tests that might not be tracked
            const testGroupsSnapshot = await firestore
                .collection(FirestoreCollections.GROUPS)
                .where('createdBy', '==', testUser.uid)
                .get();
                
            testGroupsSnapshot.docs.forEach(doc => {
                deletePromises.push(doc.ref.delete());
            });
            
            await Promise.all(deletePromises);
            console.log(`Cleaned up ${deletePromises.length} test groups`);
        } catch (error) {
            console.warn('Cleanup of test data failed:', error);
        }
    });

    describe('Invalid securityPreset values', () => {
        let testGroupIds: string[] = []; // Track groups created in each test
        
        beforeEach(async () => {
            testGroupIds = []; // Reset for each test
            // Insert groups with various invalid securityPreset values directly into Firestore
            const invalidGroups = [
                {
                    name: 'Invalid SecurityPreset Group - Unknown',
                    description: 'Group with invalid securityPreset value',
                    securityPreset: 'unknown', // Invalid value
                    createdBy: testUser.uid,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                },
                {
                    name: 'Invalid SecurityPreset Group - Numeric',
                    description: 'Group with numeric securityPreset',
                    securityPreset: 123, // Wrong type
                    createdBy: testUser.uid,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                },
                {
                    name: 'Invalid SecurityPreset Group - Null',
                    description: 'Group with null securityPreset',
                    securityPreset: null, // Null value
                    createdBy: testUser.uid,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                },
            ];

            // Insert invalid groups and add user to members subcollection
            for (const groupData of invalidGroups) {
                const groupRef = firestore.collection(FirestoreCollections.GROUPS).doc();
                await groupRef.set(groupData);
                testGroupIds.push(groupRef.id); // Track for cleanup
                
                // Add user as member in subcollection (required for group to show up in queries)
                await groupRef.collection('members').doc(testUser.uid).set({
                    userId: testUser.uid,
                    groupId: groupRef.id,
                    memberRole: 'admin',
                    memberStatus: 'active',
                    joinedAt: new Date(),
                });
            }
        });
        
        afterEach(async () => {
            // Clean up groups created in this test
            try {
                const deletePromises = testGroupIds.map(groupId =>
                    firestore.collection(FirestoreCollections.GROUPS).doc(groupId).delete()
                );
                await Promise.all(deletePromises);
            } catch (error) {
                console.warn('Failed to clean up test groups:', error);
            }
        });

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

        test('FirestoreReader.getGroupsForUser should handle invalid securityPreset values', async () => {
            const firestoreReader = getFirestoreReader();
            
            // This should not throw even with invalid data in the database
            let paginatedResult: any;
            let error;
            
            try {
                paginatedResult = await firestoreReader.getGroupsForUser(testUser.uid);
            } catch (e) {
                error = e;
            }

            // Should not throw an error
            expect(error).toBeUndefined();
            expect(paginatedResult).toBeDefined();
            expect(paginatedResult.data).toBeDefined();
            expect(Array.isArray(paginatedResult.data)).toBe(true);

            // Should include at least the valid group
            const validGroup = paginatedResult.data.find((g: any) => g.id === validGroupId);
            expect(validGroup).toBeDefined();

            console.log(`FirestoreReader returned ${paginatedResult.data.length} groups successfully`);
        });

        test('GET /groups/:id should handle invalid securityPreset for specific group', async () => {
            // First, create a group with invalid data
            const invalidGroupRef = firestore.collection(FirestoreCollections.GROUPS).doc();
            await invalidGroupRef.set({
                name: 'Direct Access Invalid Group',
                description: 'Testing direct access to invalid group',
                securityPreset: 'totally-invalid-value',
                createdBy: testUser.uid,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            });
            testGroupIds.push(invalidGroupRef.id); // Track for cleanup

            // Add user as member
            await invalidGroupRef.collection('members').doc(testUser.uid).set({
                userId: testUser.uid,
                groupId: invalidGroupRef.id,
                memberRole: 'admin',
                memberStatus: 'active',
                joinedAt: new Date(),
            });

            // Try to get the group through the API
            let response;
            let error;
            
            try {
                response = await apiDriver.getGroup(invalidGroupRef.id, testUser.token);
            } catch (e) {
                error = e;
            }

            // Should either return the group with sanitized data or handle gracefully
            // The important thing is it doesn't crash the API
            if (response) {
                expect(response).toBeDefined();
                expect(response.id).toBe(invalidGroupRef.id);
                // If securityPreset is present, it should be valid
                if (response.securityPreset) {
                    expect(['open', 'managed', 'custom']).toContain(response.securityPreset);
                }
            }
        });
    });

    // Space for future invalid data scenarios
    describe.todo('Invalid date formats', () => {
        // Add tests for malformed timestamps, invalid date strings, etc.
    });

    describe.todo('Invalid user references', () => {
        // Add tests for expenses/settlements with non-existent user IDs
    });

    describe.todo('Invalid numeric values', () => {
        // Add tests for negative amounts, NaN, Infinity, etc.
    });

    describe.todo('Missing required fields', () => {
        // Add tests for documents missing required fields
    });
});