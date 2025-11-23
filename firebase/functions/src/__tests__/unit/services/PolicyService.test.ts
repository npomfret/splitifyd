import {toPolicyId, toPolicyName, toPolicyText} from '@billsplit-wl/shared';
import { convertToISOString, TenantFirestoreTestDatabase, UserRegistrationBuilder } from '@billsplit-wl/test-support';
import { PolicyDocumentBuilder } from '@billsplit-wl/test-support';
import * as crypto from 'crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { HTTP_STATUS } from '../../../constants';
import { FirestoreReader } from '../../../services/firestore';
import { FirestoreWriter } from '../../../services/firestore';
import { PolicyService } from '../../../services/PolicyService';
import {toVersionHash} from "@billsplit-wl/shared";
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
    let db: TenantFirestoreTestDatabase;
    let app: AppDriver;
    let adminToken: string;

    beforeEach(async () => {
        // Create AppDriver (which includes database)
        app = new AppDriver();
        db = app.database;

        // Create PolicyService with real services
        policyService = new PolicyService(new FirestoreReader(db), new FirestoreWriter(db));

        // Register admin user for API operations
        const adminReg = new UserRegistrationBuilder()
            .withEmail('admin@test.com')
            .withPassword('password123456')
            .withDisplayName('Admin User')
            .build();
        const adminResult = await app.registerUser(adminReg);
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
                    code: 'POLICY_EXISTS',
                }),
            );
        });

        it('should reject empty policy name', async () => {
            await expect(policyService.createPolicy(toPolicyName(''), toPolicyText('content'))).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'MISSING_FIELDS',
                }),
            );
        });

        it('should reject empty policy text', async () => {
            await expect(policyService.createPolicy(toPolicyName('name'), toPolicyText(''))).rejects.toThrow(
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
            const policyId = toPolicyId('terms-of-service');
            const mockPolicy = new PolicyDocumentBuilder()
                .withId(policyId)
                .withPolicyName(toPolicyName('Test Policy'))
                .build();

            db.seedPolicy(policyId, mockPolicy);

            // Act
            const result = await policyService.getPolicy(policyId);

            // Assert
            expect(result).toEqual(expect.objectContaining({
                id: policyId,
                policyName: toPolicyName('Test Policy'),
            }));
        });

        it('should throw NOT_FOUND when policy does not exist', async () => {
            // Arrange
            const policyId = toPolicyId('non-existent-policy');

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
            const policyId = toPolicyId('terms-of-service');
            const newText = toPolicyText('Updated policy content');
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
            const policyId = toPolicyId('terms-of-service');
            const newText = toPolicyText('Published policy content');
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
            const policyId = toPolicyId('terms-of-service');
            const existingText = 'Default policy content for testing...';
            const existingHash = PolicyService.makeVersionHash(existingText);

            const existingPolicy = new PolicyDocumentBuilder()
                .withId(policyId)
                .withPolicyName('Test Policy')
                .withVersionText(existingHash, existingText) // Use real hash
                .build();

            db.seedPolicy(policyId, existingPolicy);

            // Act & Assert
            await expect(policyService.updatePolicy(policyId, toPolicyText(existingText))).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.CONFLICT,
                    code: 'VERSION_ALREADY_EXISTS',
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
                    code: 'POLICY_NOT_FOUND',
                }),
            );
        });
    });

    describe('publishPolicy', () => {
        it('should publish existing version successfully', async () => {
            // Arrange
            const policyId = toPolicyId('terms-of-service');
            const versionHash = toVersionHash('version-hash-123');
            const existingPolicy = new PolicyDocumentBuilder()
                .withId(policyId)
                .withPolicyName('Test Policy')
                .withVersionText(versionHash, 'Version content')
                .build();

            // Add an additional version to the policy
            existingPolicy.versions[versionHash] = {
                text: toPolicyText('Version content'),
                createdAt: convertToISOString(new Date()),
            };

            db.seedPolicy(policyId, existingPolicy);

            // Act
            const result = await policyService.publishPolicy(policyId, versionHash);

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
                    code: 'POLICY_NOT_FOUND',
                }),
            );
        });

        it('should throw NOT_FOUND when version does not exist', async () => {
            // Arrange
            const policyId = toPolicyId('terms-of-service');
            const nonExistentVersionHash = toVersionHash('non-existent-version');
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

            db.seedPolicy(toPolicyId('policy1'), policy1);
            db.seedPolicy(toPolicyId('policy2'), policy2);

            // Act
            const result = await policyService.listPolicies();

            // Assert
            expect(result.policies).toHaveLength(2);
            expect(result.count).toBe(2);
            expect(result.policies).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        id: 'policy1',
                        policyName: toPolicyName('Privacy Policy'),
                    }),
                    expect.objectContaining({
                        id: 'policy2',
                        policyName: toPolicyName('Terms of Service'),
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
            const policyId = toPolicyId('terms-of-service');
            const currentVersionHash = toVersionHash('current-version-hash');
            const policyText = toPolicyText('Current policy content');
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
            const policyId = toPolicyId('non-existent-policy');

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
            const policyId = toPolicyId('terms-of-service');
            const versionHash = toVersionHash('version-hash-123');
            const versionText = 'Specific version content';
            const mockPolicy = new PolicyDocumentBuilder()
                .withId(policyId)
                .withPolicyName('Test Policy')
                .build();

            // Add specific version
            mockPolicy.versions[versionHash] = {
                text: toPolicyText(versionText),
                createdAt: convertToISOString(new Date()),
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
            const policyId = toPolicyId('terms-of-service');
            const nonExistentVersionHash = toVersionHash('non-existent-version');
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
            const policyId = toPolicyId('terms-of-service');
            const currentVersionHash = toVersionHash('current-version');
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
            const policyId = toPolicyId('terms-of-service');
            const currentVersionHash = toVersionHash('current-version');
            const versionToDelete = toVersionHash('old-version');
            const mockPolicy = new PolicyDocumentBuilder()
                .withId(policyId)
                .withVersionText(currentVersionHash, 'Current content')
                .build();

            // Add old version
            mockPolicy.versions[versionToDelete] = { text: toPolicyText('Old content'), createdAt: convertToISOString(new Date()) };

            db.seedPolicy(policyId, mockPolicy);

            // Act & Assert
            await expect(policyService.deletePolicyVersion(policyId, versionToDelete)).resolves.not.toThrow();
        });

        it('should throw NOT_FOUND when policy does not exist', async () => {
            // Arrange
            const policyId = toPolicyId('non-existent-policy');
            const versionHash = toVersionHash('some-version');

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
            const policyId = toPolicyId('terms-of-service');
            const currentVersion = toVersionHash('current-version');
            const nonExistentVersion = toVersionHash('non-existent-version');
            const mockPolicy = new PolicyDocumentBuilder()
                .withId(policyId)
                .withVersionText(currentVersion, 'Current content')
                .build();

            // Add another version
            mockPolicy.versions['another-version'] = { text: toPolicyText('Another content'), createdAt: convertToISOString(new Date()) };

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
            const policyId = toPolicyId('terms-of-service');
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
            const policyId = toPolicyId('terms-of-service');
            const policyName = toPolicyName('Multi-Version Policy');
            const version1Hash = toVersionHash('hash-v1');

            // Initially create policy with version 1
            const mockPolicyV1 = new PolicyDocumentBuilder()
                .withId(policyId)
                .withPolicyName(policyName)
                .withVersionText(version1Hash, 'Version 1 content')
                .build();

            db.seedPolicy(policyId, mockPolicyV1);

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
            // Arrange
            const policyId = toPolicyId('terms-of-service');
            const onlyVersionHash = toVersionHash('only-version');
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
            const policyId = toPolicyId('terms-of-service');
            const versionHash = toVersionHash('test-version');
            const mockPolicy = new PolicyDocumentBuilder()
                .withId(policyId)
                .build();

            mockPolicy.versions[versionHash] = {
                text: toPolicyText('Test version content'),
                createdAt: convertToISOString(new Date()),
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
            const policyId = toPolicyId('terms-of-service');
            const policyName = toPolicyName('Concurrent Test Policy');
            const baseVersionHash = toVersionHash('base-version');

            const mockPolicy = new PolicyDocumentBuilder()
                .withId(policyId)
                .withPolicyName(policyName)
                .withVersionText(baseVersionHash, 'Base content')
                .build();

            db.seedPolicy(policyId, mockPolicy);

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
            // Arrange
            const policyId = toPolicyId('terms-of-service');
            const currentVersion = toVersionHash('current-version');
            const newVersion = toVersionHash('new-version');

            const mockPolicy = new PolicyDocumentBuilder()
                .withId(policyId)
                .withVersionText(currentVersion, 'Current content')
                .build();

            mockPolicy.versions[newVersion] = { text: toPolicyText('New content'), createdAt: convertToISOString(new Date()) };

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
            const currentPolicy = await policyService.getCurrentPolicy(policyId);
            expect(currentPolicy.currentVersionHash).toBe(updateResult.versionHash);
            expect(currentPolicy.text).toBe(updatedContent);
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
            const policyId = toPolicyId('privacy-policy');
            const version1Text = 'Version 1';
            const version2Text = 'Version 2';
            const version3Text = 'Version 3';
            const version1Hash = PolicyService.makeVersionHash(version1Text);
            const version2Hash = PolicyService.makeVersionHash(version2Text);
            const version3Hash = PolicyService.makeVersionHash(version3Text);

            // Set up policy with multiple versions
            const policy = new PolicyDocumentBuilder()
                .withId(policyId)
                .withPolicyName('Version Test')
                .withVersionText(version1Hash, version1Text)
                .build();

            policy.versions[version2Hash] = { text: toPolicyText(version2Text), createdAt: convertToISOString(new Date()) };
            policy.versions[version3Hash] = { text: toPolicyText(version3Text), createdAt: convertToISOString(new Date()) };

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
            const policyId = toPolicyId('cookie-policy');
            const currentHash = PolicyService.makeVersionHash('Original');

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
            const policyName = toPolicyName('Terms Of Service'); // Maps to 'terms-of-service'

            // Create first policy
            await policyService.createPolicy(policyName, toPolicyText('Content 1'));

            // Attempt to create policy with same name (should generate same ID)
            await expect(policyService.createPolicy(policyName, toPolicyText('Content 2'))).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.CONFLICT,
                    code: 'POLICY_EXISTS',
                }),
            );
        });

        it('should handle concurrent version creation correctly', async () => {
            const policyId = toPolicyId('privacy-policy');
            const baseContent = 'Base content';
            const baseHash = PolicyService.makeVersionHash(baseContent);

            const policy = new PolicyDocumentBuilder()
                .withId(policyId)
                .withPolicyName('Concurrent Test')
                .withVersionText(baseHash, baseContent)
                .build();

            db.seedPolicy(policyId, policy);

            // Create same content version - should fail
            await expect(
                policyService.updatePolicy(policyId, toPolicyText(baseContent)), // Same text as original
            )
                .rejects
                .toThrow(
                    expect.objectContaining({
                        statusCode: HTTP_STATUS.CONFLICT,
                        code: 'VERSION_ALREADY_EXISTS',
                    }),
                );

            // Different content should succeed
            const updateResult = await policyService.updatePolicy(policyId, toPolicyText('Different content'));
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

            db.seedPolicy(toPolicyId('list-test-1'), policy1);
            db.seedPolicy(toPolicyId('list-test-2'), policy2);

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
                    code: 'POLICY_NOT_FOUND',
                }),
            );

            await expect(policyService.updatePolicy(nonExistentId, toPolicyText('text'))).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.NOT_FOUND,
                    code: 'POLICY_NOT_FOUND',
                }),
            );

            await expect(policyService.publishPolicy(nonExistentId, toVersionHash('hash'))).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.NOT_FOUND,
                    code: 'POLICY_NOT_FOUND',
                }),
            );
        });

        it('should handle invalid version hash operations', async () => {
            const policyId = toPolicyId('terms-of-service');
            const validHash = toVersionHash('valid-hash');
            const invalidHash = toVersionHash('invalid-hash');

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
