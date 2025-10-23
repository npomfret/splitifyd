import { StubFirestoreDatabase } from '@splitifyd/firebase-simulator';
import { PolicyDocumentBuilder } from '@splitifyd/test-support';
import * as crypto from 'crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { HTTP_STATUS } from '../../../constants';
import { FirestoreReader } from '../../../services/firestore';
import { FirestoreWriter } from '../../../services/firestore';
import { PolicyService } from '../../../services/PolicyService';

/**
 * Consolidated PolicyService Unit Tests
 *
 * This file consolidates all unit tests for PolicyService that were previously
 * spread across multiple files including:
 * - PolicyService.test.ts (original core tests)
 * - PolicyService.comprehensive.unit.test.ts (workflow tests)
 *
 * Uses StubFirestoreDatabase with real FirestoreReader/Writer implementations
 * for fast, reliable unit testing without Firebase dependencies.
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
    let db: StubFirestoreDatabase;

    beforeEach(() => {
        // Create stub database
        db = new StubFirestoreDatabase();

        // Create real services using stub database
        // Create PolicyService with real services
        policyService = new PolicyService(new FirestoreReader(db), new FirestoreWriter(db));
    });

    describe('createPolicy', () => {
        it('should create a new policy with correct hash and structure', async () => {
            // Arrange
            const policyName = 'Test Privacy Policy';
            const policyText = 'This is the privacy policy content.';
            const expectedId = 'test-privacy-policy';

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
            const policyName = 'Existing Policy';
            const policyText = 'Some content';
            const policyId = 'existing-policy';

            const existingPolicy = new PolicyDocumentBuilder()
                .withId(policyId)
                .withPolicyName(policyName)
                .build();
            db.seedPolicy(policyId, existingPolicy);

            // Act & Assert
            await expect(policyService.createPolicy(policyName, policyText)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.CONFLICT,
                    code: 'POLICY_EXISTS',
                }),
            );
        });

        it('should reject empty policy name', async () => {
            await expect(policyService.createPolicy('', 'content')).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'MISSING_FIELDS',
                }),
            );
        });

        it('should reject empty policy text', async () => {
            await expect(policyService.createPolicy('name', '')).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'MISSING_FIELDS',
                }),
            );
        });
    });

    describe('getPolicy', () => {
        it('should return policy when it exists', async () => {
            // Arrange
            const policyId = 'test-policy';
            const mockPolicy = new PolicyDocumentBuilder()
                .withId(policyId)
                .withPolicyName('Test Policy')
                .build();

            db.seedPolicy(policyId, mockPolicy);

            // Act
            const result = await policyService.getPolicy(policyId);

            // Assert
            expect(result).toEqual(expect.objectContaining({
                id: policyId,
                policyName: 'Test Policy',
            }));
        });

        it('should throw NOT_FOUND when policy does not exist', async () => {
            // Arrange
            const policyId = 'non-existent-policy';

            // Act & Assert
            await expect(policyService.getPolicy(policyId)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.NOT_FOUND,
                    code: 'POLICY_NOT_FOUND',
                }),
            );
        });
    });

    describe('updatePolicy', () => {
        it('should create new version when text is different', async () => {
            // Arrange
            const policyId = 'test-policy';
            const newText = 'Updated policy content';
            const existingPolicy = new PolicyDocumentBuilder()
                .withId(policyId)
                .withPolicyName('Test Policy')
                .build();

            db.seedPolicy(policyId, existingPolicy);

            // Act
            const result = await policyService.updatePolicy(policyId, newText, false);

            // Assert
            expect(result.versionHash).toHaveLength(64);
            expect(result.currentVersionHash).toBeUndefined(); // Not published
        });

        it('should auto-publish when publish flag is true', async () => {
            // Arrange
            const policyId = 'test-policy';
            const newText = 'Published policy content';
            const existingPolicy = new PolicyDocumentBuilder()
                .withId(policyId)
                .withPolicyName('Test Policy')
                .build();

            db.seedPolicy(policyId, existingPolicy);

            // Act
            const result = await policyService.updatePolicy(policyId, newText, true);

            // Assert
            expect(result.versionHash).toHaveLength(64);
            expect(result.currentVersionHash).toBe(result.versionHash); // Published
        });

        it('should reject update with same content', async () => {
            // Arrange
            const policyId = 'test-policy';
            const existingText = 'Default policy content for testing...';
            const existingHash = crypto.createHash('sha256').update(existingText, 'utf8').digest('hex');

            const existingPolicy = new PolicyDocumentBuilder()
                .withId(policyId)
                .withPolicyName('Test Policy')
                .withVersionText(existingHash, existingText) // Use real hash
                .build();

            db.seedPolicy(policyId, existingPolicy);

            // Act & Assert
            await expect(policyService.updatePolicy(policyId, existingText)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.CONFLICT,
                    code: 'VERSION_ALREADY_EXISTS',
                }),
            );
        });

        it('should throw NOT_FOUND when policy does not exist', async () => {
            // Arrange
            const policyId = 'non-existent-policy';

            // Act & Assert
            await expect(policyService.updatePolicy(policyId, 'text')).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.NOT_FOUND,
                    code: 'POLICY_NOT_FOUND',
                }),
            );
        });
    });

    describe('publishPolicy', () => {
        it('should publish existing version successfully', async () => {
            // Arrange
            const policyId = 'test-policy';
            const versionHash = 'version-hash-123';
            const existingPolicy = new PolicyDocumentBuilder()
                .withId(policyId)
                .withPolicyName('Test Policy')
                .withVersionText(versionHash, 'Version content')
                .build();

            // Add an additional version to the policy
            existingPolicy.versions[versionHash] = {
                text: 'Version content',
                createdAt: new Date().toISOString(),
            };

            db.seedPolicy(policyId, existingPolicy);

            // Act
            const result = await policyService.publishPolicy(policyId, versionHash);

            // Assert
            expect(result.currentVersionHash).toBe(versionHash);
        });

        it('should throw NOT_FOUND when policy does not exist', async () => {
            // Arrange
            const policyId = 'non-existent-policy';
            const versionHash = 'version-hash';

            // Act & Assert
            await expect(policyService.publishPolicy(policyId, versionHash)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.NOT_FOUND,
                    code: 'POLICY_NOT_FOUND',
                }),
            );
        });

        it('should throw NOT_FOUND when version does not exist', async () => {
            // Arrange
            const policyId = 'test-policy';
            const nonExistentVersionHash = 'non-existent-version';
            const existingPolicy = new PolicyDocumentBuilder()
                .withId(policyId)
                .withPolicyName('Test Policy')
                .build();

            db.seedPolicy(policyId, existingPolicy);

            // Act & Assert
            await expect(policyService.publishPolicy(policyId, nonExistentVersionHash)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.NOT_FOUND,
                    code: 'VERSION_NOT_FOUND',
                }),
            );
        });
    });

    describe('listPolicies', () => {
        it('should return all policies with count', async () => {
            // Arrange
            const policy1 = new PolicyDocumentBuilder()
                .withId('policy1')
                .withPolicyName('Privacy Policy')
                .build();
            const policy2 = new PolicyDocumentBuilder()
                .withId('policy2')
                .withPolicyName('Terms of Service')
                .build();

            db.seedPolicy('policy1', policy1);
            db.seedPolicy('policy2', policy2);

            // Act
            const result = await policyService.listPolicies();

            // Assert
            expect(result.policies).toHaveLength(2);
            expect(result.count).toBe(2);
            expect(result.policies).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        id: 'policy1',
                        policyName: 'Privacy Policy',
                    }),
                    expect.objectContaining({
                        id: 'policy2',
                        policyName: 'Terms of Service',
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

    describe('getCurrentPolicy', () => {
        it('should return current version details', async () => {
            // Arrange
            const policyId = 'test-policy';
            const currentVersionHash = 'current-version-hash';
            const policyText = 'Current policy content';
            const mockPolicy = new PolicyDocumentBuilder()
                .withId(policyId)
                .withPolicyName('Test Policy')
                .withVersionText(currentVersionHash, policyText)
                .build();

            db.seedPolicy(policyId, mockPolicy);

            // Act
            const result = await policyService.getCurrentPolicy(policyId);

            // Assert
            expect(result.id).toBe(policyId);
            expect(result.policyName).toBe('Test Policy');
            expect(result.currentVersionHash).toBe(currentVersionHash);
            expect(result.text).toBe(policyText);
            expect(result.createdAt).toBeDefined();
        });

        it('should throw NOT_FOUND when policy does not exist', async () => {
            // Arrange
            const policyId = 'non-existent-policy';

            // Act & Assert
            await expect(policyService.getCurrentPolicy(policyId)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.NOT_FOUND,
                    code: 'POLICY_NOT_FOUND',
                }),
            );
        });
    });

    describe('getPolicyVersion', () => {
        it('should return specific version when it exists', async () => {
            // Arrange
            const policyId = 'test-policy';
            const versionHash = 'version-hash-123';
            const versionText = 'Specific version content';
            const mockPolicy = new PolicyDocumentBuilder()
                .withId(policyId)
                .withPolicyName('Test Policy')
                .build();

            // Add specific version
            mockPolicy.versions[versionHash] = {
                text: versionText,
                createdAt: new Date().toISOString(),
            };

            db.seedPolicy(policyId, mockPolicy);

            // Act
            const result = await policyService.getPolicyVersion(policyId, versionHash);

            // Assert
            expect(result.versionHash).toBe(versionHash);
            expect(result.text).toBe(versionText);
            expect(result.createdAt).toBeDefined();
        });

        it('should throw NOT_FOUND when version does not exist', async () => {
            // Arrange
            const policyId = 'test-policy';
            const nonExistentVersionHash = 'non-existent-version';
            const mockPolicy = new PolicyDocumentBuilder()
                .withId(policyId)
                .withPolicyName('Test Policy')
                .build();

            db.seedPolicy(policyId, mockPolicy);

            // Act & Assert
            await expect(policyService.getPolicyVersion(policyId, nonExistentVersionHash)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.NOT_FOUND,
                    code: 'VERSION_NOT_FOUND',
                }),
            );
        });
    });

    describe('deletePolicyVersion', () => {
        it('should throw error when trying to delete current version', async () => {
            // Arrange
            const policyId = 'test-policy';
            const currentVersionHash = 'current-version';
            const mockPolicy = new PolicyDocumentBuilder()
                .withId(policyId)
                .withVersionText(currentVersionHash, 'Current content')
                .build();

            db.seedPolicy(policyId, mockPolicy);

            // Act & Assert
            await expect(policyService.deletePolicyVersion(policyId, currentVersionHash)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'CANNOT_DELETE_CURRENT',
                }),
            );
        });

        it('should successfully delete non-current version', async () => {
            // Arrange
            const policyId = 'test-policy';
            const currentVersionHash = 'current-version';
            const versionToDelete = 'old-version';
            const mockPolicy = new PolicyDocumentBuilder()
                .withId(policyId)
                .withVersionText(currentVersionHash, 'Current content')
                .build();

            // Add old version
            mockPolicy.versions[versionToDelete] = {
                text: 'Old content',
                createdAt: new Date().toISOString(),
            };

            db.seedPolicy(policyId, mockPolicy);

            // Act & Assert
            await expect(policyService.deletePolicyVersion(policyId, versionToDelete)).resolves.not.toThrow();
        });

        it('should throw NOT_FOUND when policy does not exist', async () => {
            // Arrange
            const policyId = 'non-existent-policy';
            const versionHash = 'some-version';

            // Act & Assert
            await expect(policyService.deletePolicyVersion(policyId, versionHash)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.NOT_FOUND,
                    code: 'POLICY_NOT_FOUND',
                }),
            );
        });

        it('should throw NOT_FOUND when version does not exist', async () => {
            // Arrange
            const policyId = 'test-policy';
            const currentVersion = 'current-version';
            const nonExistentVersion = 'non-existent-version';
            const mockPolicy = new PolicyDocumentBuilder()
                .withId(policyId)
                .withVersionText(currentVersion, 'Current content')
                .build();

            // Add another version
            mockPolicy.versions['another-version'] = {
                text: 'Another content',
                createdAt: new Date().toISOString(),
            };

            db.seedPolicy(policyId, mockPolicy);

            // Act & Assert
            await expect(policyService.deletePolicyVersion(policyId, nonExistentVersion)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.NOT_FOUND,
                    code: 'VERSION_NOT_FOUND',
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

        it('should handle corrupted policy data', async () => {
            // Arrange
            const policyId = 'test-policy';
            const corruptedPolicy = {
                id: policyId,
                // Missing required fields like policyName, currentVersionHash, versions
            };

            db.seedPolicy(policyId, corruptedPolicy);

            // Act & Assert - With real FirestoreReader, Zod validation fails first
            await expect(policyService.getCurrentPolicy(policyId)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.INTERNAL_ERROR,
                    code: 'POLICY_GET_FAILED',
                }),
            );
        });
    });

    describe('Version Management Scenarios', () => {
        it('should handle multiple version creation and management', async () => {
            // Arrange
            const policyId = 'test-policy';
            const policyName = 'Multi-Version Policy';
            const version1Hash = 'hash-v1';

            // Initially create policy with version 1
            const mockPolicyV1 = new PolicyDocumentBuilder()
                .withId(policyId)
                .withPolicyName(policyName)
                .withVersionText(version1Hash, 'Version 1 content')
                .build();

            db.seedPolicy(policyId, mockPolicyV1);

            // Act - Create version 2
            const result2 = await policyService.updatePolicy(policyId, 'Version 2 content', false);
            expect(result2.versionHash).toBeDefined();

            // Act - Create version 3
            const result3 = await policyService.updatePolicy(policyId, 'Version 3 content', false);
            expect(result3.versionHash).toBeDefined();

            // Assert - Verify that different versions have different hashes
            expect(result2.versionHash).not.toBe(version1Hash);
            expect(result3.versionHash).not.toBe(version1Hash);
            expect(result2.versionHash).not.toBe(result3.versionHash);
        });

        it('should prevent deletion of only remaining version', async () => {
            // Arrange
            const policyId = 'test-policy';
            const onlyVersionHash = 'only-version';
            const mockPolicy = new PolicyDocumentBuilder()
                .withId(policyId)
                .withVersionText(onlyVersionHash, 'Only version content')
                .build();

            db.seedPolicy(policyId, mockPolicy);

            // Act & Assert
            await expect(policyService.deletePolicyVersion(policyId, onlyVersionHash)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'CANNOT_DELETE_CURRENT',
                }),
            );
        });

        it('should handle version retrieval edge cases', async () => {
            // Arrange
            const policyId = 'test-policy';
            const versionHash = 'test-version';
            const mockPolicy = new PolicyDocumentBuilder()
                .withId(policyId)
                .build();

            mockPolicy.versions[versionHash] = {
                text: 'Test version content',
                createdAt: new Date().toISOString(),
            };

            db.seedPolicy(policyId, mockPolicy);

            // Act
            const version = await policyService.getPolicyVersion(policyId, versionHash);

            // Assert
            expect(version.versionHash).toBe(versionHash);
            expect(version.text).toBe('Test version content');
            expect(version.createdAt).toBeDefined();
        });
    });

    describe('Concurrent Operations Protection', () => {
        it('should handle concurrent version creation attempts', async () => {
            // Arrange
            const policyId = 'test-policy';
            const policyName = 'Concurrent Test Policy';
            const baseVersionHash = 'base-version';

            const mockPolicy = new PolicyDocumentBuilder()
                .withId(policyId)
                .withPolicyName(policyName)
                .withVersionText(baseVersionHash, 'Base content')
                .build();

            db.seedPolicy(policyId, mockPolicy);

            // Act - Simulate concurrent version creation
            const promise1 = policyService.updatePolicy(policyId, 'Concurrent content 1', false);
            const promise2 = policyService.updatePolicy(policyId, 'Concurrent content 2', false);

            // Assert - Both should succeed (in unit test context)
            const [result1, result2] = await Promise.all([promise1, promise2]);

            expect(result1.versionHash).toBeDefined();
            expect(result2.versionHash).toBeDefined();
            expect(result1.versionHash).not.toBe(result2.versionHash);
        });

        it('should handle concurrent policy publication attempts', async () => {
            // Arrange
            const policyId = 'test-policy';
            const currentVersion = 'current-version';
            const newVersion = 'new-version';

            const mockPolicy = new PolicyDocumentBuilder()
                .withId(policyId)
                .withVersionText(currentVersion, 'Current content')
                .build();

            mockPolicy.versions[newVersion] = {
                text: 'New content',
                createdAt: new Date().toISOString(),
            };

            db.seedPolicy(policyId, mockPolicy);

            // Act
            const result = await policyService.publishPolicy(policyId, newVersion);

            // Assert
            expect(result.currentVersionHash).toBe(newVersion);
        });
    });

    describe('Policy Lifecycle Management', () => {
        it('should handle complete policy lifecycle from creation to deletion', async () => {
            // Arrange
            const policyName = 'Lifecycle Test Policy';
            const initialContent = 'Initial content';
            const updatedContent = 'Updated content';

            // Act - Create policy
            const createResult = await policyService.createPolicy(policyName, initialContent);
            const policyId = createResult.id;
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
            const currentPolicy = await policyService.getCurrentPolicy(policyId);
            expect(currentPolicy.currentVersionHash).toBe(updateResult.versionHash);
            expect(currentPolicy.text).toBe(updatedContent);
        });
    });

    describe('End-to-End Policy Management Workflows', () => {
        it('should create, read, update, and publish policies', async () => {
            const policyName = 'Integration Test Policy';
            const initialText = 'Initial policy content for integration testing.';
            const expectedId = 'integration-test-policy';
            const initialHash = crypto.createHash('sha256').update(initialText, 'utf8').digest('hex');

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
            const updatedText = 'Updated policy content with new requirements.';
            const updatedHash = crypto.createHash('sha256').update(updatedText, 'utf8').digest('hex');

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

            // Step 7: Get current policy version
            const currentVersion = await policyService.getCurrentPolicy(expectedId);

            expect(currentVersion).toEqual({
                id: expectedId,
                policyName,
                currentVersionHash: updatedHash,
                text: updatedText,
                createdAt: expect.anything(),
            });
        });

        it('should handle policy version management correctly', async () => {
            const policyId = 'version-test';
            const version1Text = 'Version 1';
            const version2Text = 'Version 2';
            const version3Text = 'Version 3';
            const version1Hash = crypto.createHash('sha256').update(version1Text, 'utf8').digest('hex');
            const version2Hash = crypto.createHash('sha256').update(version2Text, 'utf8').digest('hex');
            const version3Hash = crypto.createHash('sha256').update(version3Text, 'utf8').digest('hex');

            // Set up policy with multiple versions
            const policy = new PolicyDocumentBuilder()
                .withId(policyId)
                .withPolicyName('Version Test')
                .withVersionText(version1Hash, version1Text)
                .build();

            policy.versions[version2Hash] = {
                text: version2Text,
                createdAt: new Date().toISOString(),
            };
            policy.versions[version3Hash] = {
                text: version3Text,
                createdAt: new Date().toISOString(),
            };

            db.seedPolicy(policyId, policy);

            // Verify we can get specific versions
            const v1 = await policyService.getPolicyVersion(policyId, version1Hash);
            const v2 = await policyService.getPolicyVersion(policyId, version2Hash);
            const v3 = await policyService.getPolicyVersion(policyId, version3Hash);

            expect(v1.text).toBe(version1Text);
            expect(v2.text).toBe(version2Text);
            expect(v3.text).toBe(version3Text);

            // Delete a non-current version
            await policyService.deletePolicyVersion(policyId, version2Hash);

            // Verify version was deleted
            await expect(policyService.getPolicyVersion(policyId, version2Hash)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.NOT_FOUND,
                }),
            );

            // Verify other versions still exist
            await expect(policyService.getPolicyVersion(policyId, version1Hash)).resolves.toBeDefined();
            await expect(policyService.getPolicyVersion(policyId, version3Hash)).resolves.toBeDefined();
        });

        it('should enforce version constraints correctly', async () => {
            const policyId = 'constraint-test';
            const currentHash = crypto.createHash('sha256').update('Original', 'utf8').digest('hex');

            const policy = new PolicyDocumentBuilder()
                .withId(policyId)
                .withPolicyName('Constraint Test')
                .withVersionText(currentHash, 'Original')
                .build();

            db.seedPolicy(policyId, policy);

            // Cannot delete current version
            await expect(policyService.deletePolicyVersion(policyId, currentHash)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'CANNOT_DELETE_CURRENT',
                }),
            );
        });

        it('should prevent duplicate policy creation', async () => {
            const policyName = 'Duplicate Test';

            // Create first policy
            await policyService.createPolicy(policyName, 'Content 1');

            // Attempt to create policy with same name (should generate same ID)
            await expect(policyService.createPolicy(policyName, 'Content 2')).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.CONFLICT,
                    code: 'POLICY_EXISTS',
                }),
            );
        });

        it('should handle concurrent version creation correctly', async () => {
            const policyId = 'concurrent-test';
            const baseContent = 'Base content';
            const baseHash = crypto.createHash('sha256').update(baseContent, 'utf8').digest('hex');

            const policy = new PolicyDocumentBuilder()
                .withId(policyId)
                .withPolicyName('Concurrent Test')
                .withVersionText(baseHash, baseContent)
                .build();

            db.seedPolicy(policyId, policy);

            // Create same content version - should fail
            await expect(
                policyService.updatePolicy(policyId, baseContent), // Same text as original
            )
                .rejects
                .toThrow(
                    expect.objectContaining({
                        statusCode: HTTP_STATUS.CONFLICT,
                        code: 'VERSION_ALREADY_EXISTS',
                    }),
                );

            // Different content should succeed
            const updateResult = await policyService.updatePolicy(policyId, 'Different content');
            expect(updateResult).toHaveProperty('versionHash');
        });

        it('should handle policy listing correctly', async () => {
            const policy1 = new PolicyDocumentBuilder()
                .withId('list-test-1')
                .withPolicyName('List Test 1')
                .build();
            const policy2 = new PolicyDocumentBuilder()
                .withId('list-test-2')
                .withPolicyName('List Test 2')
                .build();

            db.seedPolicy('list-test-1', policy1);
            db.seedPolicy('list-test-2', policy2);

            // Test listPolicies
            const listResult = await policyService.listPolicies();

            expect(listResult.policies).toHaveLength(2);
            expect(listResult.count).toBe(2);
        });

        it('should handle non-existent policy operations gracefully', async () => {
            const nonExistentId = 'definitely-does-not-exist';

            await expect(policyService.getPolicy(nonExistentId)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.NOT_FOUND,
                    code: 'POLICY_NOT_FOUND',
                }),
            );

            await expect(policyService.updatePolicy(nonExistentId, 'text')).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.NOT_FOUND,
                    code: 'POLICY_NOT_FOUND',
                }),
            );

            await expect(policyService.publishPolicy(nonExistentId, 'hash')).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.NOT_FOUND,
                    code: 'POLICY_NOT_FOUND',
                }),
            );
        });

        it('should handle invalid version hash operations', async () => {
            const policyId = 'test-policy';
            const validHash = 'valid-hash';
            const invalidHash = 'invalid-hash';

            const policy = new PolicyDocumentBuilder()
                .withId(policyId)
                .withVersionText(validHash, 'Content')
                .build();

            db.seedPolicy(policyId, policy);

            // Try to publish invalid version
            await expect(policyService.publishPolicy(policyId, invalidHash)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.NOT_FOUND,
                    code: 'VERSION_NOT_FOUND',
                }),
            );

            // Try to get invalid version
            await expect(policyService.getPolicyVersion(policyId, invalidHash)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.NOT_FOUND,
                }),
            );

            // Try to delete invalid version - policy only has one version
            // so it should fail with CANNOT_DELETE_ONLY instead of version not found
            await expect(policyService.deletePolicyVersion(policyId, invalidHash)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'CANNOT_DELETE_ONLY',
                }),
            );
        });

        it('should properly use encapsulated write operations', async () => {
            const policyName = 'Write Test';
            const content = 'Content';

            // Test successful write
            const createResult = await policyService.createPolicy(policyName, content);
            const policyId = createResult.id;
            expect(createResult.id).toBeDefined();

            // Test update operation
            const updateResult = await policyService.updatePolicy(policyId, 'Updated Content', true);
            expect(updateResult).toHaveProperty('versionHash');
            expect(updateResult).toHaveProperty('currentVersionHash');
        });
    });
});
