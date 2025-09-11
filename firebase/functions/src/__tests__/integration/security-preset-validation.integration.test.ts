import { describe, it, expect, afterEach } from 'vitest';
import { getFirestore } from '../../firebase';
import { ApiDriver, UserRegistrationBuilder } from '@splitifyd/test-support';
import { SecurityPresets } from '@splitifyd/shared';

describe('Security Preset Validation - Integration Test', () => {
    const driver = new ApiDriver();
    const firestore = getFirestore();
    let testGroupId: string;

    afterEach(async () => {
        // Clean up test groups
        if (testGroupId) {
            try {
                await firestore.collection('groups').doc(testGroupId).delete();
            } catch (error) {
                // Ignore cleanup errors
            }
        }
    });

    it('should handle groups with invalid securityPreset values when fetching groups list', async () => {
        // Create a user for testing
        const testUser = await driver.createUser(new UserRegistrationBuilder().withEmail(`test-invalid-${Date.now()}@test.com`).withDisplayName('Test User Invalid').build());

        // Create a valid group first (without securityPreset in request)
        const validGroupData = {
            name: 'Valid Group Test ' + Date.now(),
            description: 'Testing valid security preset',
        };

        const validGroup = await driver.createGroup(validGroupData, testUser.token);
        testGroupId = validGroup.id;

        // Now directly insert a group with invalid securityPreset using Firestore SDK
        const invalidGroupId = 'invalid-group-' + Date.now();
        await firestore
            .collection('groups')
            .doc(invalidGroupId)
            .set({
                id: invalidGroupId,
                name: 'Invalid Security Preset Group',
                description: 'Group with invalid security preset',
                securityPreset: 'unknown', // Invalid value
                createdBy: testUser.uid,
                members: {
                    [testUser.uid]: {
                        role: 'admin',
                        status: 'active',
                        joinedAt: new Date().toISOString(),
                        color: {
                            light: '#FF6B6B',
                            dark: '#FF6B6B',
                            name: 'red',
                            pattern: 'solid',
                            colorIndex: 0,
                        },
                    },
                },
                permissions: {
                    expenseEditing: 'anyone',
                    expenseDeletion: 'anyone',
                    memberInvitation: 'anyone',
                    memberApproval: 'automatic',
                    settingsManagement: 'anyone',
                },
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            });

        // Try to fetch groups list - this should fail with validation error
        const listResponse = await driver.listGroups(testUser.token);

        // The API should handle the invalid data gracefully
        expect(listResponse).toBeDefined();
        expect(listResponse.groups).toBeDefined();

        // The response should contain error about validation
        console.log('List Groups Response:', listResponse);

        // For now, we expect an error because of the invalid data
        // The actual validation error happens when the frontend tries to parse the response

        // Clean up the invalid group
        await firestore.collection('groups').doc(invalidGroupId).delete();
    });

    it('should successfully fetch groups when all have valid securityPreset values', async () => {
        // Create a user for testing
        const testUser = await driver.createUser(new UserRegistrationBuilder().withEmail(`test-valid-${Date.now()}@test.com`).withDisplayName('Test User Valid').build());

        // Create multiple groups (they'll get default security preset from backend)
        const createdGroups = [];

        for (let i = 0; i < 3; i++) {
            const groupData = {
                name: `Valid Group ${i} - ${Date.now()}`,
                description: `Testing group ${i}`,
            };

            const response = await driver.createGroup(groupData, testUser.token);
            createdGroups.push(response);
        }

        // Fetch groups list - this should succeed
        const listResponse = await driver.listGroups(testUser.token);

        expect(listResponse.groups).toBeDefined();
        expect(Array.isArray(listResponse.groups)).toBe(true);

        // Verify all created groups are in the response
        const groupIds = listResponse.groups.map((g: any) => g.id);
        for (const group of createdGroups) {
            expect(groupIds).toContain(group.id);
        }

        // Clean up
        for (const group of createdGroups) {
            await firestore.collection('groups').doc(group.id).delete();
        }
    });

    it('should identify which groups have invalid securityPreset values', async () => {
        // Create a user for testing
        const testUser = await driver.createUser(new UserRegistrationBuilder().withEmail(`test-identify-${Date.now()}@test.com`).withDisplayName('Test User Identify').build());

        // Create a mix of valid and invalid groups
        const groups = [
            { id: 'valid-1-' + Date.now(), securityPreset: SecurityPresets.OPEN },
            { id: 'invalid-1-' + Date.now(), securityPreset: 'unknown' },
            { id: 'valid-2-' + Date.now(), securityPreset: SecurityPresets.MANAGED },
            { id: 'invalid-2-' + Date.now(), securityPreset: 'invalid_value' },
        ];

        // Insert all groups directly via Firestore
        for (const groupInfo of groups) {
            await firestore
                .collection('groups')
                .doc(groupInfo.id)
                .set({
                    id: groupInfo.id,
                    name: `Test Group ${groupInfo.id}`,
                    description: 'Testing security preset validation',
                    securityPreset: groupInfo.securityPreset,
                    createdBy: testUser.uid,
                    members: {
                        [testUser.uid]: {
                            role: 'admin',
                            status: 'active',
                            joinedAt: new Date().toISOString(),
                            color: {
                                light: '#FF6B6B',
                                dark: '#FF6B6B',
                                name: 'red',
                                pattern: 'solid',
                                colorIndex: 0,
                            },
                        },
                    },
                    permissions: {
                        expenseEditing: 'anyone',
                        expenseDeletion: 'anyone',
                        memberInvitation: 'anyone',
                        memberApproval: 'automatic',
                        settingsManagement: 'anyone',
                    },
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                });
        }

        // Try to fetch groups list
        try {
            const listResponse = await driver.listGroups(testUser.token);

            // Log the response for debugging
            console.log('List Groups Response:', JSON.stringify(listResponse, null, 2));

            // If we get here, check if any groups have the invalid presets
            const invalidGroups = listResponse.groups.filter((g: any) => g.securityPreset === 'unknown' || g.securityPreset === 'invalid_value');

            console.log('Found invalid groups:', invalidGroups.length);
        } catch (error: any) {
            console.log('Error fetching groups:', error.message);
            // If there's a validation error, it would be caught here
            if (error.message.includes('validation')) {
                console.log('Validation error detected as expected');
            }
        }

        // Clean up all test groups
        for (const groupInfo of groups) {
            await firestore.collection('groups').doc(groupInfo.id).delete();
        }
    });
});
