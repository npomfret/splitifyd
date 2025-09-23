import { describe, it, expect, beforeEach } from 'vitest';
import * as crypto from 'crypto';
import { PolicyService } from '../../../services/PolicyService';
import { StubFirestoreReader, StubFirestoreWriter, createMockPolicyDocument } from '../mocks/firestore-stubs';
import { HTTP_STATUS } from '../../../constants';
import { Timestamp } from 'firebase-admin/firestore';

/**
 * Comprehensive PolicyService Unit Tests
 *
 * This file provides comprehensive unit test coverage that replaces the integration tests
 * for PolicyService. It covers all the business logic and workflows using stub implementations
 * for fast, reliable testing without Firebase dependencies.
 *
 * These tests replace the slower integration tests while maintaining the same coverage:
 * - End-to-End Policy Management workflows
 * - Policy version management
 * - Error handling scenarios
 * - Validation logic
 * - Edge cases and constraints
 */
describe('PolicyService - Comprehensive Unit Tests (Replacing Integration)', () => {
    let policyService: PolicyService;
    let stubReader: StubFirestoreReader;
    let stubWriter: StubFirestoreWriter;

    beforeEach(() => {
        stubReader = new StubFirestoreReader();
        stubWriter = new StubFirestoreWriter();
        policyService = new PolicyService(stubReader, stubWriter);
    });

    describe('End-to-End Policy Management Workflow', () => {
        it('should create, read, update, and publish policies', async () => {
            const policyName = 'Integration Test Policy';
            const initialText = 'Initial policy content for integration testing.';
            const expectedId = 'integration-test-policy';
            const initialHash = crypto.createHash('sha256').update(initialText, 'utf8').digest('hex');

            // Step 1: Create a new policy
            stubReader.setRawDocument(expectedId, null); // Policy doesn't exist
            stubWriter.setWriteResult(expectedId, true);

            const createResult = await policyService.createPolicy(policyName, initialText);

            expect(createResult).toEqual({
                id: expectedId,
                currentVersionHash: initialHash,
            });

            // Step 2: Read the created policy - set up the created policy in reader
            const createdPolicy = createMockPolicyDocument({
                id: expectedId,
                policyName,
                currentVersionHash: initialHash,
                versions: {
                    [initialHash]: {
                        text: initialText,
                        createdAt: Timestamp.now(),
                    },
                },
            });
            stubReader.setDocument('policies', expectedId, createdPolicy);

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

            // Set up the stub to return the existing policy for the update operation
            stubReader.setRawDocument(expectedId, createdPolicy);
            stubWriter.setWriteResult(expectedId, true);
            const updateResult = await policyService.updatePolicy(expectedId, updatedText, false);

            expect(updateResult).toEqual({
                versionHash: updatedHash,
                // No currentVersionHash since it's a draft
            });

            // Step 4: Verify policy now has multiple versions but same current version
            const policyWithDraft = createMockPolicyDocument({
                id: expectedId,
                policyName,
                currentVersionHash: initialHash, // Unchanged since draft
                versions: {
                    [initialHash]: {
                        text: initialText,
                        createdAt: Timestamp.now(),
                    },
                    [updatedHash]: {
                        text: updatedText,
                        createdAt: Timestamp.now(),
                    },
                },
            });
            stubReader.setDocument('policies', expectedId, policyWithDraft);

            const policyAfterUpdate = await policyService.getPolicy(expectedId);
            expect(policyAfterUpdate.currentVersionHash).toBe(initialHash); // Unchanged
            expect(Object.keys(policyAfterUpdate.versions!)).toHaveLength(2);
            expect(policyAfterUpdate.versions![updatedHash]).toEqual(
                expect.objectContaining({
                    text: updatedText,
                }),
            );

            // Step 5: Publish the new version
            // Need to set up raw document with both versions for publish operation
            stubReader.setRawDocument(expectedId, policyWithDraft);
            stubWriter.setWriteResult(expectedId, true);
            const publishResult = await policyService.publishPolicy(expectedId, updatedHash);

            expect(publishResult.currentVersionHash).toBe(updatedHash);

            // Step 6: Verify current version was updated
            const publishedPolicy = createMockPolicyDocument({
                ...policyWithDraft,
                currentVersionHash: updatedHash, // Now published
            });
            stubReader.setDocument('policies', expectedId, publishedPolicy);

            const finalPolicy = await policyService.getPolicy(expectedId);
            expect(finalPolicy.currentVersionHash).toBe(updatedHash);

            // Step 7: Get current policy version
            const currentVersion = await policyService.getCurrentPolicy(expectedId);

            expect(currentVersion).toEqual({
                id: expectedId,
                policyName,
                currentVersionHash: updatedHash,
                text: updatedText,
                createdAt: expect.anything(), // Can be string or Timestamp depending on implementation
            });
        });
    });

    describe('Policy Version Management', () => {
        it('should handle policy version management correctly', async () => {
            const policyId = 'version-test';
            const version1Hash = crypto.createHash('sha256').update('Version 1', 'utf8').digest('hex');
            const version2Hash = crypto.createHash('sha256').update('Version 2', 'utf8').digest('hex');
            const version3Hash = crypto.createHash('sha256').update('Version 3', 'utf8').digest('hex');

            // Set up policy with multiple versions
            const policy = createMockPolicyDocument({
                id: policyId,
                policyName: 'Version Test',
                currentVersionHash: version1Hash,
                versions: {
                    [version1Hash]: {
                        text: 'Version 1',
                        createdAt: Timestamp.now(),
                    },
                    [version2Hash]: {
                        text: 'Version 2',
                        createdAt: Timestamp.now(),
                    },
                    [version3Hash]: {
                        text: 'Version 3',
                        createdAt: Timestamp.now(),
                    },
                },
            });
            stubReader.setDocument('policies', policyId, policy);
            // Also set up raw document for delete operations
            stubReader.setRawDocument(policyId, policy);

            // Verify we can get specific versions
            const v1 = await policyService.getPolicyVersion(policyId, version1Hash);
            const v2 = await policyService.getPolicyVersion(policyId, version2Hash);
            const v3 = await policyService.getPolicyVersion(policyId, version3Hash);

            expect(v1.text).toBe('Version 1');
            expect(v2.text).toBe('Version 2');
            expect(v3.text).toBe('Version 3');

            // Delete a non-current version
            stubWriter.setWriteResult(policyId, true);
            await policyService.deletePolicyVersion(policyId, version2Hash);

            // Update the policy to reflect the deletion
            const policyAfterDeletion = createMockPolicyDocument({
                ...policy,
                versions: {
                    [version1Hash]: policy.versions![version1Hash],
                    [version3Hash]: policy.versions![version3Hash],
                    // version2Hash removed
                },
            });
            stubReader.setDocument('policies', policyId, policyAfterDeletion);

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

            const policy = createMockPolicyDocument({
                id: policyId,
                policyName: 'Constraint Test',
                currentVersionHash: currentHash,
                versions: {
                    [currentHash]: {
                        text: 'Original',
                        createdAt: Timestamp.now(),
                    },
                },
            });
            stubReader.setDocument('policies', policyId, policy);

            // Cannot delete current version - need to set up raw document
            stubReader.setRawDocument(policyId, policy);
            await expect(policyService.deletePolicyVersion(policyId, currentHash)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'CANNOT_DELETE_CURRENT',
                }),
            );
        });
    });

    describe('Duplicate Prevention and Validation', () => {
        it('should prevent duplicate policy creation', async () => {
            const policyName = 'Duplicate Test';
            const policyId = 'duplicate-test';

            // Set up existing policy
            const existingPolicy = createMockPolicyDocument({
                id: policyId,
                policyName,
            });
            stubReader.setRawDocument(policyId, existingPolicy);

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

            const policy = createMockPolicyDocument({
                id: policyId,
                policyName: 'Concurrent Test',
                currentVersionHash: baseHash,
                versions: {
                    [baseHash]: {
                        text: baseContent,
                        createdAt: Timestamp.now(),
                    },
                },
            });
            stubReader.setDocument('policies', policyId, policy);

            // Create same content version - should fail (need to set up raw document)
            stubReader.setRawDocument(policyId, policy);
            await expect(
                policyService.updatePolicy(policyId, baseContent), // Same text as original
            ).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.CONFLICT,
                    code: 'VERSION_ALREADY_EXISTS',
                }),
            );

            // Different content should succeed
            stubWriter.setWriteResult(policyId, true);
            const updateResult = await policyService.updatePolicy(policyId, 'Different content');
            expect(updateResult).toHaveProperty('versionHash');
        });

        it('should validate required fields on creation', async () => {
            await expect(policyService.createPolicy('', 'content')).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'MISSING_FIELDS',
                }),
            );

            await expect(policyService.createPolicy('name', '')).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'MISSING_FIELDS',
                }),
            );
        });
    });

    describe('Policy Listing and Retrieval', () => {
        it('should handle policy listing correctly', async () => {
            const policy1 = createMockPolicyDocument({
                id: 'list-test-1',
                policyName: 'List Test 1',
                currentVersionHash: 'hash1',
            });
            const policy2 = createMockPolicyDocument({
                id: 'list-test-2',
                policyName: 'List Test 2',
                currentVersionHash: 'hash2',
            });

            stubReader.setDocument('policies', 'list-test-1', policy1);
            stubReader.setDocument('policies', 'list-test-2', policy2);

            // Mock getAllPolicies to return our test policies
            const mockPolicies = [policy1, policy2];
            stubReader.getAllPolicies = async () => mockPolicies;

            // Test listPolicies
            const listResult = await policyService.listPolicies();

            expect(listResult.policies).toHaveLength(2);
            expect(listResult.count).toBe(2);

            // Test getCurrentPolicies
            const currentResult = await policyService.getCurrentPolicies();

            expect(currentResult.policies).toHaveProperty('list-test-1');
            expect(currentResult.policies).toHaveProperty('list-test-2');
            expect(currentResult.policies['list-test-1']).toEqual({
                policyName: 'List Test 1',
                currentVersionHash: 'hash1',
            });
        });
    });

    describe('Error Handling', () => {
        it('should handle non-existent policy operations gracefully', async () => {
            const nonExistentId = 'definitely-does-not-exist';

            // Set up null returns for non-existent policy
            stubReader.setDocument('policies', nonExistentId, null);

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

            const policy = createMockPolicyDocument({
                id: policyId,
                currentVersionHash: validHash,
                versions: {
                    [validHash]: {
                        text: 'Content',
                        createdAt: Timestamp.now(),
                    },
                },
            });
            stubReader.setDocument('policies', policyId, policy);

            // Try to publish invalid version (need to set up raw document)
            stubReader.setRawDocument(policyId, policy);
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

            // Try to delete invalid version - but this policy only has one version
            // so it should fail with CANNOT_DELETE_ONLY instead of version not found
            stubReader.setRawDocument(policyId, policy);
            await expect(policyService.deletePolicyVersion(policyId, invalidHash)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'CANNOT_DELETE_ONLY',
                }),
            );
        });
    });

    describe('Hash Generation and Consistency', () => {
        it('should generate consistent hashes for same content', () => {
            const text = 'Same policy content';
            const hash1 = crypto.createHash('sha256').update(text, 'utf8').digest('hex');
            const hash2 = crypto.createHash('sha256').update(text, 'utf8').digest('hex');

            expect(hash1).toBe(hash2);
            expect(hash1).toHaveLength(64);
        });

        it('should generate different hashes for different content', () => {
            const text1 = 'First policy content';
            const text2 = 'Second policy content';

            const hash1 = crypto.createHash('sha256').update(text1, 'utf8').digest('hex');
            const hash2 = crypto.createHash('sha256').update(text2, 'utf8').digest('hex');

            expect(hash1).not.toBe(hash2);
            expect(hash1).toHaveLength(64);
            expect(hash2).toHaveLength(64);
        });
    });

    describe('Write Operation Integration', () => {
        it('should properly use encapsulated write operations', async () => {
            const policyId = 'write-test';
            const policyName = 'Write Test';
            const content = 'Content';

            // Test successful write
            stubReader.setRawDocument(policyId, null);
            stubWriter.setWriteResult(policyId, true);

            const createResult = await policyService.createPolicy(policyName, content);
            expect(createResult.id).toBe(policyId);

            // Set up policy for update test
            const policy = createMockPolicyDocument({
                id: policyId,
                policyName,
                currentVersionHash: createResult.currentVersionHash,
                versions: {
                    [createResult.currentVersionHash]: {
                        text: content,
                        createdAt: Timestamp.now(),
                    },
                },
            });
            stubReader.setDocument('policies', policyId, policy);
            stubReader.setRawDocument(policyId, policy);
            stubWriter.setWriteResult(policyId, true);

            // Test update operation
            const updateResult = await policyService.updatePolicy(policyId, 'Updated Content', true);
            expect(updateResult).toHaveProperty('versionHash');
            expect(updateResult).toHaveProperty('currentVersionHash');
        });

        it('should handle write operation failures', async () => {
            const policyId = 'write-fail-test';

            // Set up write failure
            stubReader.setRawDocument(policyId, null);
            stubWriter.setWriteResult(policyId, false, 'Write operation failed');

            // This should handle the write failure gracefully
            await expect(policyService.createPolicy('Test Policy', 'Content')).rejects.toThrow();
        });
    });
});