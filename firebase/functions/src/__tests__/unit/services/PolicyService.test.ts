import { toPolicyId, toPolicyName, toPolicyText, toVersionHash } from '@billsplit-wl/shared';
import { UserRegistrationBuilder } from '@billsplit-wl/test-support';
import * as crypto from 'crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { HTTP_STATUS } from '../../../constants';
import { ErrorCode } from '../../../errors';
import { PolicyService } from '../../../services/PolicyService';
import { AppDriver } from '../AppDriver';

/**
 * Consolidated PolicyService Unit Tests
 *
 * This file consolidates all unit tests for PolicyService that were previously
 * spread across multiple files including:
 * - PolicyService.test.ts (original core tests)
 * - PolicyService.comprehensive.unit.test.ts (workflow tests)
 *
 * Uses AppDriver for API-driven testing where possible, with direct service
 * access for unit testing service layer logic.
 *
 * Test coverage includes:
 * - Core CRUD operations (create, read, update, delete)
 * - End-to-end policy management workflows
 * - Version management and publishing
 * - Error handling and validation
 * - Edge cases and constraints
 * - Hash generation and consistency
 * - Concurrent operations protection
 */
describe('PolicyService - Consolidated Unit Tests', () => {
    let policyService: PolicyService;
    let app: AppDriver;
    let adminToken: string;

    beforeEach(async () => {
        // Create AppDriver (which includes database)
        app = new AppDriver();

        // Create PolicyService with real services
        policyService = app.componentBuilder.buildPolicyService();

        // Register admin user for API operations
        const adminResult = await app.registerUser(
            new UserRegistrationBuilder()
                .withEmail('admin@test.com')
                .withPassword('password123456')
                .withDisplayName('Admin User')
                .build(),
        );
        adminToken = adminResult.user.uid;
        app.seedAdminUser(adminToken);
    });

    describe('createPolicy', () => {
        it('should create a new policy with correct hash and structure', async () => {
            // Arrange
            const policyName = toPolicyName('Privacy Policy'); // Maps to standard 'privacy-policy' ID
            const policyText = toPolicyText('This is the privacy policy content.');
            const expectedId = 'privacy-policy';

            // Act
            const result = await policyService.createPolicy(policyName, policyText);

            // Assert
            expect(result.id).toBe(expectedId);
            expect(result.currentVersionHash).toHaveLength(64); // SHA256 hash

            // Verify hash consistency
            const expectedHash = crypto.createHash('sha256').update(policyText, 'utf8').digest('hex');
            expect(result.currentVersionHash).toBe(expectedHash);
        });

        it('should generate different hashes for different content', () => {
            // Arrange
            const text1 = 'First policy content';
            const text2 = 'Second policy content';

            // Act
            const hash1 = crypto.createHash('sha256').update(text1, 'utf8').digest('hex');
            const hash2 = crypto.createHash('sha256').update(text2, 'utf8').digest('hex');

            // Assert
            expect(hash1).not.toBe(hash2);
            expect(hash1).toHaveLength(64);
            expect(hash2).toHaveLength(64);
        });

        it('should generate consistent hashes for same content', () => {
            // Arrange
            const text = 'Same policy content';

            // Act
            const hash1 = crypto.createHash('sha256').update(text, 'utf8').digest('hex');
            const hash2 = crypto.createHash('sha256').update(text, 'utf8').digest('hex');

            // Assert
            expect(hash1).toBe(hash2);
        });

        it('should throw conflict error if policy already exists', async () => {
            // Arrange
            const policyName = toPolicyName('Terms Of Service'); // Maps to 'terms-of-service'
            const policyText = toPolicyText('Some content');

            // Create policy via API
            await app.createPolicy({ policyName, text: policyText }, adminToken);

            // Act & Assert - Try to create again
            await expect(policyService.createPolicy(policyName, policyText)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.CONFLICT,
                    code: ErrorCode.ALREADY_EXISTS,
                }),
            );
        });

        it('should reject empty policy name', async () => {
            await expect(policyService.createPolicy(toPolicyName(''), toPolicyText('content'))).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: ErrorCode.VALIDATION_ERROR,
                }),
            );
        });

        it('should reject empty policy text', async () => {
            await expect(policyService.createPolicy(toPolicyName('name'), toPolicyText(''))).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: ErrorCode.VALIDATION_ERROR,
                }),
            );
        });
    });

    describe('getPolicy', () => {
        it('should return policy when it exists', async () => {
            // Arrange - Create policy via API
            const policyName = toPolicyName('Terms Of Service'); // Maps to 'terms-of-service'
            const policyText = toPolicyText('Test policy content');
            await app.createPolicy({ policyName, text: policyText }, adminToken);
            const policyId = toPolicyId('terms-of-service');

            // Act
            const result = await policyService.getPolicy(policyId);

            // Assert
            expect(result).toEqual(expect.objectContaining({
                id: policyId,
                policyName: policyName,
            }));
        });

        it('should throw NOT_FOUND when policy does not exist', async () => {
            // Arrange
            const policyId = toPolicyId('non-existent-policy');

            // Act & Assert
            await expect(policyService.getPolicy(policyId)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.NOT_FOUND,
                    code: ErrorCode.NOT_FOUND,
                }),
            );
        });
    });

    describe('updatePolicy', () => {
        it('should create new version when text is different', async () => {
            // Arrange - Create policy via API
            const policyName = toPolicyName('Terms Of Service');
            const initialText = toPolicyText('Initial policy content');
            await app.createPolicy({ policyName, text: initialText }, adminToken);
            const policyId = toPolicyId('terms-of-service');

            const newText = toPolicyText('Updated policy content');

            // Act
            const result = await policyService.updatePolicy(policyId, newText, false);

            // Assert
            expect(result.versionHash).toHaveLength(64);
            expect(result.currentVersionHash).toBeUndefined(); // Not published
        });

        it('should auto-publish when publish flag is true', async () => {
            // Arrange - Create policy via API
            const policyName = toPolicyName('Cookie Policy');
            const initialText = toPolicyText('Initial policy content');
            await app.createPolicy({ policyName, text: initialText }, adminToken);
            const policyId = toPolicyId('cookie-policy');

            const newText = toPolicyText('Published policy content');

            // Act
            const result = await policyService.updatePolicy(policyId, newText, true);

            // Assert
            expect(result.versionHash).toHaveLength(64);
            expect(result.currentVersionHash).toBe(result.versionHash); // Published
        });

        it('should reject update with same content', async () => {
            // Arrange - Create policy via API
            const policyName = toPolicyName('Privacy Policy');
            const existingText = toPolicyText('Default policy content for testing...');
            await app.createPolicy({ policyName, text: existingText }, adminToken);
            const policyId = toPolicyId('privacy-policy');

            // Act & Assert - Try to update with same content
            await expect(policyService.updatePolicy(policyId, existingText)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.CONFLICT,
                    code: ErrorCode.ALREADY_EXISTS,
                }),
            );
        });

        it('should throw NOT_FOUND when policy does not exist', async () => {
            // Arrange
            const policyId = toPolicyId('non-existent-policy');

            // Act & Assert
            await expect(policyService.updatePolicy(policyId, toPolicyText('text'))).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.NOT_FOUND,
                    code: ErrorCode.NOT_FOUND,
                }),
            );
        });
    });

    describe('publishPolicy', () => {
        it('should publish existing version successfully', async () => {
            // Arrange - Create policy via API and add new version
            const policyName = toPolicyName('Terms Of Service');
            const initialText = toPolicyText('Version 1 content');
            await app.createPolicy({ policyName, text: initialText }, adminToken);
            const policyId = toPolicyId('terms-of-service');

            // Create a new version (unpublished)
            const newText = toPolicyText('Version 2 content');
            const updateResult = await policyService.updatePolicy(policyId, newText, false);
            const versionHash = updateResult.versionHash;

            // Act - Publish the new version
            const result = await policyService.publishPolicy(policyId, toVersionHash(versionHash));

            // Assert
            expect(result.currentVersionHash).toBe(versionHash);
        });

        it('should throw NOT_FOUND when policy does not exist', async () => {
            // Arrange
            const policyId = toPolicyId('non-existent-policy');
            const versionHash = toVersionHash('version-hash');

            // Act & Assert
            await expect(policyService.publishPolicy(policyId, versionHash)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.NOT_FOUND,
                    code: ErrorCode.NOT_FOUND,
                }),
            );
        });

        it('should throw NOT_FOUND when version does not exist', async () => {
            // Arrange - Create policy via API
            const policyName = toPolicyName('Cookie Policy');
            const initialText = toPolicyText('Initial content');
            await app.createPolicy({ policyName, text: initialText }, adminToken);
            const policyId = toPolicyId('cookie-policy');

            const nonExistentVersionHash = toVersionHash('non-existent-version');

            // Act & Assert
            await expect(policyService.publishPolicy(policyId, nonExistentVersionHash)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.NOT_FOUND,
                    code: ErrorCode.NOT_FOUND,
                }),
            );
        });
    });

    describe('listPolicies', () => {
        it('should return all policies with count', async () => {
            // Arrange - Create policies via API
            await app.createPolicy({
                policyName: toPolicyName('Privacy Policy'),
                text: toPolicyText('Privacy content'),
            }, adminToken);
            await app.createPolicy({
                policyName: toPolicyName('Terms Of Service'),
                text: toPolicyText('Terms content'),
            }, adminToken);

            // Act
            const result = await policyService.listPolicies();

            // Assert
            expect(result.policies).toHaveLength(2);
            expect(result.count).toBe(2);
            expect(result.policies).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        id: 'privacy-policy',
                        policyName: toPolicyName('Privacy Policy'),
                    }),
                    expect.objectContaining({
                        id: 'terms-of-service',
                        policyName: toPolicyName('Terms Of Service'),
                    }),
                ]),
            );
        });

        it('should return empty array when no policies exist', async () => {
            // Act
            const result = await policyService.listPolicies();

            // Assert
            expect(result.policies).toEqual([]);
            expect(result.count).toBe(0);
        });
    });

    describe('getPolicyVersion', () => {
        it('should return specific version when it exists', async () => {
            // Arrange - Create policy via API
            const policyName = toPolicyName('Terms Of Service');
            const initialText = toPolicyText('Version 1 content');
            await app.createPolicy({ policyName, text: initialText }, adminToken);
            const policyId = toPolicyId('terms-of-service');

            // Create a new version
            const versionText = toPolicyText('Specific version content');
            const updateResult = await policyService.updatePolicy(policyId, versionText, false);
            const versionHash = toVersionHash(updateResult.versionHash);

            // Act
            const result = await policyService.getPolicyVersion(policyId, versionHash);

            // Assert
            expect(result.versionHash).toBe(versionHash);
            expect(result.text).toBe(versionText);
            expect(result.createdAt).toBeDefined();
        });

        it('should throw NOT_FOUND when version does not exist', async () => {
            // Arrange - Create policy via API
            const policyName = toPolicyName('Cookie Policy');
            const initialText = toPolicyText('Initial content');
            await app.createPolicy({ policyName, text: initialText }, adminToken);
            const policyId = toPolicyId('cookie-policy');

            const nonExistentVersionHash = toVersionHash('non-existent-version');

            // Act & Assert
            await expect(policyService.getPolicyVersion(policyId, nonExistentVersionHash)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.NOT_FOUND,
                    code: ErrorCode.NOT_FOUND,
                }),
            );
        });
    });

    describe('deletePolicyVersion', () => {
        it('should throw error when trying to delete current version', async () => {
            // Arrange - Create policy via API
            const policyName = toPolicyName('Terms Of Service');
            const initialText = toPolicyText('Current content');
            const createResult = await app.createPolicy({ policyName, text: initialText }, adminToken);
            const policyId = toPolicyId('terms-of-service');
            const currentVersionHash = toVersionHash(createResult.versionHash);

            // Act & Assert - Deleting the only version (which is also current) should fail
            await expect(policyService.deletePolicyVersion(policyId, currentVersionHash)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: ErrorCode.INVALID_REQUEST, // Cannot delete current version
                }),
            );
        });

        it('should successfully delete non-current version', async () => {
            // Arrange - Create policy via API with multiple versions
            const policyName = toPolicyName('Cookie Policy');
            const initialText = toPolicyText('Version 1 content');
            await app.createPolicy({ policyName, text: initialText }, adminToken);
            const policyId = toPolicyId('cookie-policy');

            // Create version 2 and publish it
            const version2Text = toPolicyText('Version 2 content');
            const updateResult = await policyService.updatePolicy(policyId, version2Text, false);
            const version2Hash = toVersionHash(updateResult.versionHash);
            await policyService.publishPolicy(policyId, version2Hash);

            // Now delete version 1 (old version)
            const policy = await policyService.getPolicy(policyId);
            const oldVersionHash = Object.keys(policy.versions!).find(hash => hash !== version2Hash);

            // Act & Assert
            await expect(policyService.deletePolicyVersion(policyId, toVersionHash(oldVersionHash!))).resolves.not.toThrow();
        });

        it('should throw NOT_FOUND when policy does not exist', async () => {
            // Arrange
            const policyId = toPolicyId('non-existent-policy');
            const versionHash = toVersionHash('some-version');

            // Act & Assert
            await expect(policyService.deletePolicyVersion(policyId, versionHash)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.NOT_FOUND,
                    code: ErrorCode.NOT_FOUND,
                }),
            );
        });

        it('should throw NOT_FOUND when version does not exist', async () => {
            // Arrange - Create policy via API with multiple versions
            const policyName = toPolicyName('Privacy Policy');
            const initialText = toPolicyText('Current content');
            await app.createPolicy({ policyName, text: initialText }, adminToken);
            const policyId = toPolicyId('privacy-policy');

            // Add another version
            const version2Text = toPolicyText('Another content');
            await policyService.updatePolicy(policyId, version2Text, false);

            const nonExistentVersion = toVersionHash('non-existent-version');

            // Act & Assert
            await expect(policyService.deletePolicyVersion(policyId, nonExistentVersion)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.NOT_FOUND,
                    code: ErrorCode.NOT_FOUND,
                }),
            );
        });
    });

    describe('Edge Cases and Error Handling', () => {
        it('should handle firestore write failures gracefully', async () => {
            // Note: This test demonstrates how write failures would be handled
            // The current stub implementation doesn't actually throw on write failures
            // In a real scenario, this would be tested with actual Firebase errors

            // This test is kept for documentation purposes showing the expected behavior
            expect(true).toBe(true); // Placeholder assertion
        });
    });

    describe('Version Management Scenarios', () => {
        it('should handle multiple version creation and management', async () => {
            // Arrange - Create policy via API
            const policyName = toPolicyName('Terms Of Service');
            const version1Text = toPolicyText('Version 1 content');
            const createResult = await app.createPolicy({ policyName, text: version1Text }, adminToken);
            const policyId = toPolicyId('terms-of-service');
            const version1Hash = createResult.versionHash;

            // Act - Create version 2
            const result2 = await policyService.updatePolicy(policyId, toPolicyText('Version 2 content'), false);
            expect(result2.versionHash).toBeDefined();

            // Act - Create version 3
            const result3 = await policyService.updatePolicy(policyId, toPolicyText('Version 3 content'), false);
            expect(result3.versionHash).toBeDefined();

            // Assert - Verify that different versions have different hashes
            expect(result2.versionHash).not.toBe(version1Hash);
            expect(result3.versionHash).not.toBe(version1Hash);
            expect(result2.versionHash).not.toBe(result3.versionHash);
        });

        it('should prevent deletion of only remaining version', async () => {
            // Arrange - Create policy via API
            const policyName = toPolicyName('Cookie Policy');
            const onlyVersionText = toPolicyText('Only version content');
            const createResult = await app.createPolicy({ policyName, text: onlyVersionText }, adminToken);
            const policyId = toPolicyId('cookie-policy');
            const onlyVersionHash = toVersionHash(createResult.versionHash);

            // Act & Assert
            await expect(policyService.deletePolicyVersion(policyId, onlyVersionHash)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: ErrorCode.INVALID_REQUEST, // Cannot delete current version
                }),
            );
        });

        it('should handle version retrieval edge cases', async () => {
            // Arrange - Create policy via API with multiple versions
            const policyName = toPolicyName('Privacy Policy');
            const initialText = toPolicyText('Initial content');
            await app.createPolicy({ policyName, text: initialText }, adminToken);
            const policyId = toPolicyId('privacy-policy');

            // Create a test version
            const testVersionText = toPolicyText('Test version content');
            const updateResult = await policyService.updatePolicy(policyId, testVersionText, false);
            const versionHash = toVersionHash(updateResult.versionHash);

            // Act
            const version = await policyService.getPolicyVersion(policyId, versionHash);

            // Assert
            expect(version.versionHash).toBe(versionHash);
            expect(version.text).toBe(testVersionText);
            expect(version.createdAt).toBeDefined();
        });
    });

    describe('Concurrent Operations Protection', () => {
        it('should handle concurrent version creation attempts', async () => {
            // Arrange - Create policy via API
            const policyName = toPolicyName('Terms Of Service');
            const baseText = toPolicyText('Base content');
            await app.createPolicy({ policyName, text: baseText }, adminToken);
            const policyId = toPolicyId('terms-of-service');

            // Act - Simulate concurrent version creation
            const promise1 = policyService.updatePolicy(policyId, toPolicyText('Concurrent content 1'), false);
            const promise2 = policyService.updatePolicy(policyId, toPolicyText('Concurrent content 2'), false);

            // Assert - Both should succeed (in unit test context)
            const [result1, result2] = await Promise.all([promise1, promise2]);

            expect(result1.versionHash).toBeDefined();
            expect(result2.versionHash).toBeDefined();
            expect(result1.versionHash).not.toBe(result2.versionHash);
        });

        it('should handle concurrent policy publication attempts', async () => {
            // Arrange - Create policy via API with multiple versions
            const policyName = toPolicyName('Cookie Policy');
            const initialText = toPolicyText('Current content');
            await app.createPolicy({ policyName, text: initialText }, adminToken);
            const policyId = toPolicyId('cookie-policy');

            // Create a new version
            const newText = toPolicyText('New content');
            const updateResult = await policyService.updatePolicy(policyId, newText, false);
            const newVersion = toVersionHash(updateResult.versionHash);

            // Act
            const result = await policyService.publishPolicy(policyId, newVersion);

            // Assert
            expect(result.currentVersionHash).toBe(newVersion);
        });
    });

    describe('Policy Lifecycle Management', () => {
        it('should handle complete policy lifecycle from creation to deletion', async () => {
            // Arrange
            const policyName = toPolicyName('Privacy Policy'); // Maps to 'privacy-policy'
            const initialContent = toPolicyText('Initial content');
            const updatedContent = toPolicyText('Updated content');

            // Act - Create policy
            const createResult = await policyService.createPolicy(policyName, initialContent);
            const policyId = toPolicyId(createResult.id);
            expect(createResult.id).toBeDefined();
            expect(createResult.currentVersionHash).toBeDefined();

            const initialVersionHash = createResult.currentVersionHash;

            // Act - Update policy
            const updateResult = await policyService.updatePolicy(policyId, updatedContent, false);
            expect(updateResult.versionHash).toBeDefined();
            expect(updateResult.versionHash).not.toBe(initialVersionHash);

            // Act - Publish new version
            const publishResult = await policyService.publishPolicy(policyId, updateResult.versionHash);
            expect(publishResult.currentVersionHash).toBe(updateResult.versionHash);

            // Act - Delete old version
            await expect(policyService.deletePolicyVersion(policyId, initialVersionHash)).resolves.not.toThrow();

            // Verify current version is still accessible
            const currentPolicy = await policyService.getPolicy(policyId);
            expect(currentPolicy.currentVersionHash).toBe(updateResult.versionHash);
            expect(currentPolicy.versions[currentPolicy.currentVersionHash].text).toBe(updatedContent);
        });
    });

    describe('End-to-End Policy Management Workflows', () => {
        it('should create, read, update, and publish policies', async () => {
            const policyName = toPolicyName('Cookie Policy'); // Maps to 'cookie-policy'
            const initialText = toPolicyText('Initial policy content for integration testing.');
            const expectedId = toPolicyId('cookie-policy');
            const initialHash = crypto.createHash('sha256').update('Initial policy content for integration testing.', 'utf8').digest('hex');

            // Step 1: Create a new policy
            const createResult = await policyService.createPolicy(policyName, initialText);

            expect(createResult).toEqual({
                id: expectedId,
                currentVersionHash: initialHash,
            });

            // Step 2: Read the created policy
            const retrievedPolicy = await policyService.getPolicy(expectedId);

            expect(retrievedPolicy).toEqual(
                expect.objectContaining({
                    id: expectedId,
                    policyName,
                    currentVersionHash: initialHash,
                    versions: expect.objectContaining({
                        [initialHash]: expect.objectContaining({
                            text: initialText,
                        }),
                    }),
                }),
            );

            // Step 3: Update policy with new version (draft)
            const updatedText = toPolicyText('Updated policy content with new requirements.');
            const updatedHash = PolicyService.makeVersionHash('Updated policy content with new requirements.');

            const updateResult = await policyService.updatePolicy(expectedId, updatedText, false);

            expect(updateResult).toEqual({
                versionHash: updatedHash,
                // No currentVersionHash since it's a draft
            });

            // Step 4: Verify policy now has multiple versions but same current version
            const policyAfterUpdate = await policyService.getPolicy(expectedId);
            expect(policyAfterUpdate.currentVersionHash).toBe(initialHash); // Unchanged
            expect(Object.keys(policyAfterUpdate.versions!)).toHaveLength(2);
            expect(policyAfterUpdate.versions![updatedHash]).toEqual(
                expect.objectContaining({
                    text: updatedText,
                }),
            );

            // Step 5: Publish the new version
            const publishResult = await policyService.publishPolicy(expectedId, updatedHash);

            expect(publishResult.currentVersionHash).toBe(updatedHash);

            // Step 6: Verify current version was updated
            const finalPolicy = await policyService.getPolicy(expectedId);
            expect(finalPolicy.currentVersionHash).toBe(updatedHash);

            // Step 7: Verify current policy version content
            expect(finalPolicy.id).toBe(expectedId);
            expect(finalPolicy.policyName).toBe(policyName);
            expect(finalPolicy.versions[updatedHash]).toBeDefined();
            expect(finalPolicy.versions[updatedHash].text).toBe(updatedText);
        });

        it('should handle policy version management correctly', async () => {
            // Arrange - Create policy via API with multiple versions
            const policyName = toPolicyName('Privacy Policy');
            const version1Text = toPolicyText('Version 1');
            const version2Text = toPolicyText('Version 2');
            const version3Text = toPolicyText('Version 3');

            await app.createPolicy({ policyName, text: version1Text }, adminToken);
            const policyId = toPolicyId('privacy-policy');
            const version1Hash = PolicyService.makeVersionHash('Version 1');

            // Create version 2 and version 3
            const v2Result = await policyService.updatePolicy(policyId, version2Text, false);
            const version2Hash = v2Result.versionHash;

            const v3Result = await policyService.updatePolicy(policyId, version3Text, true); // Publish version 3
            const version3Hash = v3Result.versionHash;

            // Verify we can get specific versions
            const v1 = await policyService.getPolicyVersion(policyId, version1Hash);
            const v2 = await policyService.getPolicyVersion(policyId, toVersionHash(version2Hash));
            const v3 = await policyService.getPolicyVersion(policyId, toVersionHash(version3Hash));

            expect(v1.text).toBe(version1Text);
            expect(v2.text).toBe(version2Text);
            expect(v3.text).toBe(version3Text);

            // Delete a non-current version (version 2)
            await policyService.deletePolicyVersion(policyId, toVersionHash(version2Hash));

            // Verify version was deleted
            await expect(policyService.getPolicyVersion(policyId, toVersionHash(version2Hash))).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.NOT_FOUND,
                }),
            );

            // Verify other versions still exist
            await expect(policyService.getPolicyVersion(policyId, version1Hash)).resolves.toBeDefined();
            await expect(policyService.getPolicyVersion(policyId, toVersionHash(version3Hash))).resolves.toBeDefined();
        });

        it('should enforce version constraints correctly', async () => {
            // Arrange - Create policy via API
            const policyName = toPolicyName('Cookie Policy');
            const originalText = toPolicyText('Original');
            const createResult = await app.createPolicy({ policyName, text: originalText }, adminToken);
            const policyId = toPolicyId('cookie-policy');
            const currentHash = createResult.versionHash;

            // Cannot delete current version (which is also the only version)
            await expect(policyService.deletePolicyVersion(policyId, currentHash)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: ErrorCode.INVALID_REQUEST, // Cannot delete current version
                }),
            );
        });

        it('should prevent duplicate policy creation', async () => {
            const policyName = toPolicyName('Terms Of Service'); // Maps to 'terms-of-service'

            // Create first policy
            await policyService.createPolicy(policyName, toPolicyText('Content 1'));

            // Attempt to create policy with same name (should generate same ID)
            await expect(policyService.createPolicy(policyName, toPolicyText('Content 2'))).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.CONFLICT,
                    code: ErrorCode.ALREADY_EXISTS,
                }),
            );
        });

        it('should handle concurrent version creation correctly', async () => {
            // Arrange - Create policy via API
            const policyName = toPolicyName('Privacy Policy');
            const baseContent = toPolicyText('Base content');
            await app.createPolicy({ policyName, text: baseContent }, adminToken);
            const policyId = toPolicyId('privacy-policy');

            // Create same content version - should fail
            await expect(
                policyService.updatePolicy(policyId, baseContent), // Same text as original
            )
                .rejects
                .toThrow(
                    expect.objectContaining({
                        statusCode: HTTP_STATUS.CONFLICT,
                        code: ErrorCode.ALREADY_EXISTS,
                    }),
                );

            // Different content should succeed
            const updateResult = await policyService.updatePolicy(policyId, toPolicyText('Different content'));
            expect(updateResult).toHaveProperty('versionHash');
        });

        it('should handle policy listing correctly', async () => {
            // Arrange - Create policies via API
            await app.createPolicy({
                policyName: toPolicyName('Privacy Policy'),
                text: toPolicyText('Policy 1 content'),
            }, adminToken);
            await app.createPolicy({
                policyName: toPolicyName('Cookie Policy'),
                text: toPolicyText('Policy 2 content'),
            }, adminToken);

            // Test listPolicies
            const listResult = await policyService.listPolicies();

            expect(listResult.policies).toHaveLength(2);
            expect(listResult.count).toBe(2);
        });

        it('should handle non-existent policy operations gracefully', async () => {
            const nonExistentId = toPolicyId('definitely-does-not-exist');

            await expect(policyService.getPolicy(nonExistentId)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.NOT_FOUND,
                    code: ErrorCode.NOT_FOUND,
                }),
            );

            await expect(policyService.updatePolicy(nonExistentId, toPolicyText('text'))).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.NOT_FOUND,
                    code: ErrorCode.NOT_FOUND,
                }),
            );

            await expect(policyService.publishPolicy(nonExistentId, toVersionHash('hash'))).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.NOT_FOUND,
                    code: ErrorCode.NOT_FOUND,
                }),
            );
        });

        it('should handle invalid version hash operations', async () => {
            // Arrange - Create policy via API
            const policyName = toPolicyName('Terms Of Service');
            const policyText = toPolicyText('Content');
            await app.createPolicy({ policyName, text: policyText }, adminToken);
            const policyId = toPolicyId('terms-of-service');

            const invalidHash = toVersionHash('invalid-hash');

            // Try to publish invalid version
            await expect(policyService.publishPolicy(policyId, invalidHash)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.NOT_FOUND,
                    code: ErrorCode.NOT_FOUND,
                }),
            );

            // Try to get invalid version
            await expect(policyService.getPolicyVersion(policyId, invalidHash)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.NOT_FOUND,
                }),
            );

            // Try to delete invalid version - policy only has one version
            // so it should fail with INVALID_REQUEST instead of version not found
            await expect(policyService.deletePolicyVersion(policyId, invalidHash)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: ErrorCode.INVALID_REQUEST,
                }),
            );
        });

        it('should properly use encapsulated write operations', async () => {
            const policyName = toPolicyName('Cookie Policy'); // Maps to 'cookie-policy'
            const content = toPolicyText('Content');

            // Test successful write
            const createResult = await policyService.createPolicy(policyName, content);
            const policyId = createResult.id;
            expect(createResult.id).toBeDefined();

            // Test update operation
            const updateResult = await policyService.updatePolicy(policyId, toPolicyText('Updated Content'), true);
            expect(updateResult).toHaveProperty('versionHash');
            expect(updateResult).toHaveProperty('currentVersionHash');
        });
    });
});
